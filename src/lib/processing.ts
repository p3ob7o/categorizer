import { processWord } from './openai'
import { prisma, withConnection } from './db'
import type { ProcessingSession, ProcessingResult, Word, Language, Category } from '@prisma/client'

export interface ProcessingConfig {
  mode: 'batch' | 'parallel'
  model: string
  chunkSize: number
  maxRetries: number
  languagePrompt?: string
  categoryPrompt?: string
  wordIds?: number[]
}

export interface ProcessingStats {
  totalWords: number
  processedWords: number
  successfulWords: number
  failedWords: number
  currentChunk: number
  totalChunks: number
  estimatedTimeRemaining: number
  averageProcessingTime: number
  totalCost: number
  processingRate: number // words per minute
}

export interface ProcessingEvent {
  type: 'progress' | 'result' | 'error' | 'complete' | 'chunk_complete'
  sessionId: string
  data: any
  timestamp: Date
}

export class ProcessingService {
  private sessionId: string
  private config: ProcessingConfig
  private startTime: number = 0
  private processingTimes: number[] = []
  private eventCallback?: (event: ProcessingEvent) => void

  constructor(sessionId: string, config: ProcessingConfig) {
    this.sessionId = sessionId
    this.config = config
  }

  setEventCallback(callback: (event: ProcessingEvent) => void) {
    this.eventCallback = callback
  }

  private emit(event: ProcessingEvent) {
    if (this.eventCallback) {
      this.eventCallback(event)
    }
  }

  private calculateETA(processedWords: number, totalWords: number): number {
    if (processedWords === 0 || this.processingTimes.length === 0) {
      return 0
    }

    const averageTime = this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
    const remainingWords = totalWords - processedWords
    return Math.round((remainingWords * averageTime) / 1000) // in seconds
  }

  private calculateCost(tokensUsed: number, model: string): number {
    // OpenAI pricing (as of 2024)
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 }, // per 1K tokens
      'gpt-4o': { input: 0.005, output: 0.015 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 }
    }

    const modelPricing = pricing[model] || pricing['gpt-4o-mini']
    // Estimate 70% input, 30% output tokens
    const inputTokens = Math.round(tokensUsed * 0.7)
    const outputTokens = Math.round(tokensUsed * 0.3)
    
    return (inputTokens / 1000 * modelPricing.input) + (outputTokens / 1000 * modelPricing.output)
  }

  async createSession(wordIds: number[]): Promise<ProcessingSession> {
    return withConnection(async () => {
      const totalWords = wordIds.length
      const totalChunks = Math.ceil(totalWords / this.config.chunkSize)

      const session = await prisma.processingSession.create({
        data: {
          id: this.sessionId,
          status: 'pending',
          totalWords,
          totalChunks,
          chunkSize: this.config.chunkSize,
          mode: this.config.mode,
          model: this.config.model,
          maxRetries: this.config.maxRetries,
          languagePrompt: this.config.languagePrompt,
          categoryPrompt: this.config.categoryPrompt,
          resumeData: { wordIds }
        }
      })

      return session
    })
  }

  async resumeSession(): Promise<ProcessingSession | null> {
    return withConnection(async () => {
      const session = await prisma.processingSession.findUnique({
        where: { id: this.sessionId },
        include: {
          results: {
            orderBy: { processedAt: 'desc' },
            take: 1
          }
        }
      })

      if (!session || session.status === 'completed') {
        return null
      }

      // Update session status to processing
      await prisma.processingSession.update({
        where: { id: this.sessionId },
        data: {
          status: 'processing',
          startedAt: new Date()
        }
      })

      return session
    })
  }

  async processWords(): Promise<void> {
    const session = await this.resumeSession()
    if (!session) {
      throw new Error('Session not found or already completed')
    }

    this.startTime = Date.now()
    const wordIds = (session.resumeData as any)?.wordIds || []
    
    try {
      // Get categories and languages
      const [categories, languages] = await withConnection(async () => {
        return Promise.all([
          prisma.category.findMany({ orderBy: { name: 'asc' } }),
          prisma.language.findMany({ orderBy: [{ priority: 'asc' }, { name: 'asc' }] })
        ])
      })

      if (!categories.length) {
        throw new Error('No categories found in database')
      }

      // Get words to process (resume from last processed if applicable)
      const words = await withConnection(async () => {
        let whereClause: any = { id: { in: wordIds } }
        
        // If resuming, start from last processed word
        if (session.lastProcessedWordId) {
          const lastProcessedIndex = wordIds.indexOf(session.lastProcessedWordId)
          if (lastProcessedIndex !== -1) {
            whereClause = { id: { in: wordIds.slice(lastProcessedIndex + 1) } }
          }
        }

        return prisma.word.findMany({
          where: whereClause,
          include: { language: true },
          orderBy: { id: 'asc' }
        })
      })

      const categoryNames = categories.map(c => c.name)
      const languageNames = languages.map(l => l.name)

      // Process words in chunks
      const chunks = this.chunkArray(words, this.config.chunkSize)
      let processedWords = session.processedWords

      for (let chunkIndex = session.currentChunk; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex]
        
        // Update session progress
        await this.updateSessionProgress(chunkIndex, processedWords)

        // Process chunk
        const chunkResults = await this.processChunk(
          chunk,
          categoryNames,
          languageNames,
          categories,
          languages
        )

        // Update statistics
        processedWords += chunkResults.length
        const successfulInChunk = chunkResults.filter(r => r.success).length
        const failedInChunk = chunkResults.filter(r => !r.success).length

        await this.updateSessionStats(successfulInChunk, failedInChunk, chunkResults)

        // Emit progress event
        this.emit({
          type: 'chunk_complete',
          sessionId: this.sessionId,
          data: {
            chunkIndex: chunkIndex + 1,
            totalChunks: chunks.length,
            processedWords,
            totalWords: session.totalWords,
            stats: await this.getProcessingStats()
          },
          timestamp: new Date()
        })

        // Small delay between chunks to prevent overwhelming the system
        if (chunkIndex < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      // Mark session as completed
      await this.completeSession()

      this.emit({
        type: 'complete',
        sessionId: this.sessionId,
        data: {
          stats: await this.getProcessingStats()
        },
        timestamp: new Date()
      })

    } catch (error) {
      await this.handleSessionError(error)
      throw error
    }
  }

  private async processChunk(
    words: (Word & { language: Language | null })[],
    categoryNames: string[],
    languageNames: string[],
    categories: Category[],
    languages: Language[]
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = []

    if (this.config.mode === 'parallel') {
      // Process words in parallel
      const promises = words.map(word => this.processWordWithTracking(
        word,
        categoryNames,
        languageNames,
        categories,
        languages
      ))

      const chunkResults = await Promise.all(promises)
      results.push(...chunkResults)
    } else {
      // Process words sequentially
      for (const word of words) {
        const result = await this.processWordWithTracking(
          word,
          categoryNames,
          languageNames,
          categories,
          languages
        )
        results.push(result)

        // Emit individual result
        this.emit({
          type: 'result',
          sessionId: this.sessionId,
          data: result,
          timestamp: new Date()
        })
      }
    }

    return results
  }

  private async processWordWithTracking(
    word: Word & { language: Language | null },
    categoryNames: string[],
    languageNames: string[],
    categories: Category[],
    languages: Language[]
  ): Promise<ProcessingResult> {
    const startTime = Date.now()
    let result: ProcessingResult

    try {
      // Process the word
      const processedWord = await processWord(
        word.word,
        categoryNames,
        languageNames,
        this.config.model,
        this.config.languagePrompt,
        this.config.categoryPrompt
      )

      const processingTime = Date.now() - startTime
      this.processingTimes.push(processingTime)

      // Keep only last 100 processing times for moving average
      if (this.processingTimes.length > 100) {
        this.processingTimes.shift()
      }

      // Find detected language and category
      const detectedLanguage = languages.find(l => 
        l.name.toLowerCase() === processedWord.language.toLowerCase()
      )
      const detectedCategory = categories.find(c => 
        c.name.toLowerCase() === processedWord.category.toLowerCase()
      )

      // Estimate tokens and cost
      const estimatedTokens = this.estimateTokens(word.word, processedWord.englishTranslation || '')
      const cost = this.calculateCost(estimatedTokens, this.config.model)

      // Update the word in database
      await withConnection(async () => {
        await prisma.word.update({
          where: { id: word.id },
          data: {
            languageId: detectedLanguage?.id || null,
            englishTranslation: processedWord.englishTranslation,
            category: detectedCategory?.name || null
          }
        })
      })

      // Create processing result
      result = await withConnection(async () => {
        return prisma.processingResult.create({
          data: {
            sessionId: this.sessionId,
            wordId: word.id,
            originalWord: word.word,
            detectedLanguage: processedWord.language,
            englishTranslation: processedWord.englishTranslation,
            assignedCategory: processedWord.category,
            processingTime,
            tokensUsed: estimatedTokens,
            cost,
            success: true
          }
        })
      })

    } catch (error) {
      const processingTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      result = await withConnection(async () => {
        return prisma.processingResult.create({
          data: {
            sessionId: this.sessionId,
            wordId: word.id,
            originalWord: word.word,
            processingTime,
            success: false,
            error: errorMessage
          }
        })
      })
    }

    return result
  }

  private estimateTokens(originalWord: string, translation: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English
    // Add some overhead for prompts and responses
    const wordTokens = Math.ceil(originalWord.length / 4)
    const translationTokens = Math.ceil(translation.length / 4)
    const promptOverhead = 50 // Estimated prompt tokens
    
    return wordTokens + translationTokens + promptOverhead
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  private async updateSessionProgress(currentChunk: number, processedWords: number): Promise<void> {
    await withConnection(async () => {
      await prisma.processingSession.update({
        where: { id: this.sessionId },
        data: {
          currentChunk,
          processedWords,
          lastProcessedAt: new Date()
        }
      })
    })
  }

  private async updateSessionStats(
    successfulWords: number,
    failedWords: number,
    results: ProcessingResult[]
  ): Promise<void> {
    const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0)
    const totalCost = results.reduce((sum, r) => sum + r.cost, 0)

    await withConnection(async () => {
      await prisma.processingSession.update({
        where: { id: this.sessionId },
        data: {
          successfulWords: { increment: successfulWords },
          failedWords: { increment: failedWords },
          totalTokensUsed: { increment: totalTokens },
          estimatedCost: { increment: totalCost }
        }
      })
    })
  }

  private async completeSession(): Promise<void> {
    await withConnection(async () => {
      await prisma.processingSession.update({
        where: { id: this.sessionId },
        data: {
          status: 'completed',
          completedAt: new Date()
        }
      })
    })
  }

  private async handleSessionError(error: any): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    await withConnection(async () => {
      await prisma.processingSession.update({
        where: { id: this.sessionId },
        data: {
          status: 'failed',
          error: errorMessage,
          retryCount: { increment: 1 }
        }
      })
    })
  }

  async getProcessingStats(): Promise<ProcessingStats> {
    const session = await withConnection(async () => {
      return prisma.processingSession.findUnique({
        where: { id: this.sessionId }
      })
    })

    if (!session) {
      throw new Error('Session not found')
    }

    const averageProcessingTime = this.processingTimes.length > 0
      ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
      : 0

    const estimatedTimeRemaining = this.calculateETA(session.processedWords, session.totalWords)
    
    const elapsedTime = session.startedAt 
      ? (Date.now() - session.startedAt.getTime()) / 1000 / 60 // in minutes
      : 0
    
    const processingRate = elapsedTime > 0 ? session.processedWords / elapsedTime : 0

    return {
      totalWords: session.totalWords,
      processedWords: session.processedWords,
      successfulWords: session.successfulWords,
      failedWords: session.failedWords,
      currentChunk: session.currentChunk,
      totalChunks: session.totalChunks,
      estimatedTimeRemaining,
      averageProcessingTime,
      totalCost: session.estimatedCost,
      processingRate
    }
  }

  async pauseSession(): Promise<void> {
    await withConnection(async () => {
      await prisma.processingSession.update({
        where: { id: this.sessionId },
        data: {
          status: 'paused'
        }
      })
    })
  }

  async getSession(): Promise<ProcessingSession | null> {
    return withConnection(async () => {
      return prisma.processingSession.findUnique({
        where: { id: this.sessionId },
        include: {
          results: {
            orderBy: { processedAt: 'desc' },
            take: 10
          }
        }
      })
    })
  }
} 