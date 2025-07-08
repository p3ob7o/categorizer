import { NextRequest, NextResponse } from 'next/server'
import { processWord, processWordOptimized } from '@/lib/openai'
import { prisma, withRetry, withConnection, safeDisconnect, getCachedCategories, getCachedLanguages, upsertWord, findMatchingLanguage, findMatchingCategory } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mode = 'batch', model = 'gpt-4o-mini', langPrompt, catPrompt, wordIds } = body

    // Get data from database with caching to reduce queries
    const [categories, languages] = await Promise.all([
      getCachedCategories(),
      getCachedLanguages()
    ])

    if (!categories.length) {
      return NextResponse.json({ 
        error: 'Please add categories to the database first' 
      }, { status: 400 })
    }

    // Get words based on filters
    const words = await withConnection(async () => {
      if (wordIds && wordIds.length > 0) {
        return prisma.word.findMany({
          where: { id: { in: wordIds } },
          include: { language: true },
          orderBy: { word: 'asc' }
        })
      } else {
        return prisma.word.findMany({
          include: { language: true },
          orderBy: { word: 'asc' }
        })
      }
    })

    if (!words.length) {
      return NextResponse.json({ 
        error: 'No words found to process' 
      }, { status: 400 })
    }

    const categoryNames = categories.map(c => c.name)
    const languageNames = languages.map(l => l.name)

    // Default prompts if not provided
    const finalLangPrompt = langPrompt || `You are a language detection and translation expert. Given a word and a list of languages, determine:
1. The primary language of the word using the priority order provided (languages are listed in priority order)
2. If the word is not in English, provide an English translation
3. If the word exists in multiple languages from the list, choose the one with the highest priority (first in the list)

Languages to consider (in priority order): {languages}

Respond with JSON format:
{
  "language": "detected_language",
  "englishTranslation": "english_translation_or_same_word_if_already_english"
}`

    const finalCatPrompt = catPrompt || `You are a categorization expert. Given a word and a list of categories, determine which category the word best fits into. Be fuzzy in your matching - if the word kind of belongs to a category, that's fine. If it doesn't fit any category well, return an empty string.

Available categories: {categories}

Respond with just the category name or an empty string if no good match.`

    // Create a readable stream for Server-Sent Events with memory management
    let isAborted = false
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        let processedResults = 0
        const MEMORY_CLEANUP_INTERVAL = 50 // Clean up every 50 results
        
        const sendEvent = (data: any) => {
          if (isAborted) return
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
          } catch (error) {
            console.log('Stream already closed, stopping event sending')
            isAborted = true
          }
        }
        
        // Memory cleanup function
        const cleanupMemory = () => {
          if (global.gc) {
            global.gc()
          }
        }
        
        // Cleanup function for graceful shutdown
        const cleanup = async () => {
          isAborted = true
          await safeDisconnect()
          cleanupMemory()
        }

        // Send initial status
        sendEvent({
          type: 'status',
          totalWords: words.length,
          processedWords: 0,
          isProcessing: true
        })

        // Handle client disconnection
        const handleAbort = () => {
          console.log('Client disconnected, cleaning up...')
          cleanup()
        }
        
        try {
          if (mode === 'parallel') {
            // Process in parallel batches
            const BATCH_SIZE = 10
            let processedCount = 0
            
            for (let i = 0; i < words.length; i += BATCH_SIZE) {
              const batch = words.slice(i, i + BATCH_SIZE)
              
              const batchPromises = batch.map(async (word) => {
                try {
                  // Use optimized version if using default prompts
                  const isUsingDefaultPrompts = !langPrompt && !catPrompt
                  const result = isUsingDefaultPrompts 
                    ? await processWordOptimized(word.word, categoryNames, languageNames, model)
                    : await processWord(
                        word.word,
                        categoryNames,
                        languageNames,
                        model,
                        finalLangPrompt,
                        finalCatPrompt
                      )
                  
                  // Update database with improved matching
                  const detectedLanguage = findMatchingLanguage(result.language, languages)
                  const detectedCategory = findMatchingCategory(result.category, categories)
                  
                  // Use safe upsert to handle duplicates properly
                  await upsertWord(
                    word.word,
                    detectedLanguage?.id || null,
                    result.englishTranslation,
                    detectedCategory?.name || null
                  )
                  
                  return result
                } catch (error) {
                  console.error(`Error processing word "${word.word}":`, error)
                  return {
                    originalWord: word.word,
                    language: 'Error',
                    englishTranslation: word.word,
                    category: ''
                  }
                }
              })
              
              const batchResults = await Promise.all(batchPromises)
              
              // Send each result individually with memory management
              for (const result of batchResults) {
                processedCount++
                processedResults++
                
                sendEvent({
                  type: 'result',
                  result,
                  processedWords: processedCount,
                  totalWords: words.length
                })
                
                // Periodic memory cleanup
                if (processedResults % MEMORY_CLEANUP_INTERVAL === 0) {
                  cleanupMemory()
                }
              }
              
              // Small delay between batches
              if (i + BATCH_SIZE < words.length) {
                await new Promise(resolve => setTimeout(resolve, 500))
              }
            }
          } else {
            // Sequential processing
            for (let i = 0; i < words.length; i++) {
              const word = words[i]
              
              try {
                // Use optimized version if using default prompts
                const isUsingDefaultPrompts = !langPrompt && !catPrompt
                const result = isUsingDefaultPrompts 
                  ? await processWordOptimized(word.word, categoryNames, languageNames, model)
                  : await processWord(
                      word.word,
                      categoryNames,
                      languageNames,
                      model,
                      finalLangPrompt,
                      finalCatPrompt
                    )
                
                // Update database with improved matching
                const detectedLanguage = findMatchingLanguage(result.language, languages)
                const detectedCategory = findMatchingCategory(result.category, categories)
                
                // Use safe upsert to handle duplicates properly
                await upsertWord(
                  word.word,
                  detectedLanguage?.id || null,
                  result.englishTranslation,
                  detectedCategory?.name || null
                )
                
                // Send result with memory management
                processedResults++
                sendEvent({
                  type: 'result',
                  result,
                  processedWords: i + 1,
                  totalWords: words.length
                })
                
                // Periodic memory cleanup
                if (processedResults % MEMORY_CLEANUP_INTERVAL === 0) {
                  cleanupMemory()
                }
                
                // Small delay to avoid rate limiting
                if (i < words.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 100))
                }
              } catch (error) {
                console.error(`Error processing word "${word.word}":`, error)
                const errorResult = {
                  originalWord: word.word,
                  language: 'Error',
                  englishTranslation: word.word,
                  category: ''
                }
                
                processedResults++
                sendEvent({
                  type: 'result',
                  result: errorResult,
                  processedWords: i + 1,
                  totalWords: words.length
                })
                
                // Periodic memory cleanup
                if (processedResults % MEMORY_CLEANUP_INTERVAL === 0) {
                  cleanupMemory()
                }
              }
            }
          }
          
          // Send completion event
          sendEvent({
            type: 'complete',
            totalWords: words.length,
            processedWords: words.length,
            isProcessing: false
          })
          
        } catch (error) {
          console.error('Stream processing error:', error)
          if (!isAborted) {
            sendEvent({
              type: 'error',
              error: 'Processing failed'
            })
          }
        } finally {
          await cleanup()
          if (!isAborted) {
            try {
              controller.close()
            } catch (closeError) {
              console.log('Controller already closed')
            }
          }
        }
      },
      
      cancel() {
        console.log('Stream cancelled by client')
        isAborted = true
        return safeDisconnect()
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Process stream error:', error)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
} 