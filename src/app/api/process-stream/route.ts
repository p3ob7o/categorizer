import { NextRequest, NextResponse } from 'next/server'
import { processWord } from '@/lib/openai'
import { prisma, withRetry, withConnection, safeDisconnect } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mode = 'batch', model = 'gpt-4o-mini', langPrompt, catPrompt, wordIds, onlyUnprocessed = false } = body

    // Get data from database with connection management and retry logic
    const [categories, languages] = await withConnection(async () => {
      return Promise.all([
        prisma.category.findMany({ orderBy: { name: 'asc' } }),
        prisma.language.findMany({ orderBy: [{ priority: 'asc' }, { name: 'asc' }] })
      ])
    })

    if (!categories.length) {
      return NextResponse.json({ 
        error: 'Please add categories to the database first' 
      }, { status: 400 })
    }

    // Get words based on filters
    const words = await withConnection(async () => {
      let whereClause: any = {}
      
      if (wordIds && wordIds.length > 0) {
        whereClause.id = { in: wordIds }
      }
      
      if (onlyUnprocessed) {
        whereClause.OR = [
          { languageId: null },
          { englishTranslation: null },
          { category: null },
          { englishTranslation: '' },
          { category: '' }
        ]
      }
      
      return prisma.word.findMany({
        where: whereClause,
        include: { language: true },
        orderBy: { word: 'asc' }
      })
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

    // Create a readable stream for Server-Sent Events
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        
        const sendEvent = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }

        // Send initial status
        sendEvent({
          type: 'status',
          totalWords: words.length,
          processedWords: 0,
          isProcessing: true
        })

        try {
          if (mode === 'parallel') {
            // Process in parallel batches
            const BATCH_SIZE = 10
            let processedCount = 0
            
            for (let i = 0; i < words.length; i += BATCH_SIZE) {
              const batch = words.slice(i, i + BATCH_SIZE)
              
              const batchPromises = batch.map(async (word) => {
                try {
                  const result = await processWord(
                    word.word,
                    categoryNames,
                    languageNames,
                    model,
                    finalLangPrompt,
                    finalCatPrompt
                  )
                  
                  // Update database
                  const detectedLanguage = languages.find(l => 
                    l.name.toLowerCase() === result.language.toLowerCase()
                  )
                  
                  const detectedCategory = categories.find(c => 
                    c.name.toLowerCase() === result.category.toLowerCase()
                  )
                  
                  await withConnection(async () => {
                    // Handle potential unique constraint violation
                    try {
                      return await prisma.word.update({
                        where: { id: word.id },
                        data: {
                          languageId: detectedLanguage?.id || null,
                          englishTranslation: result.englishTranslation,
                          category: detectedCategory?.name || null
                        }
                      })
                    } catch (updateError: any) {
                      // If unique constraint violation, try to find existing word and update it
                      if (updateError.code === 'P2002') {
                        console.log(`Unique constraint violation for word "${word.word}", attempting to resolve...`)
                        
                        // Find the existing word with the same word and languageId
                        const existingWord = await prisma.word.findFirst({
                          where: {
                            word: word.word,
                            languageId: detectedLanguage?.id || null
                          }
                        })
                        
                        if (existingWord && existingWord.id !== word.id) {
                          // Update the existing word and delete the current one
                          await prisma.word.update({
                            where: { id: existingWord.id },
                            data: {
                              englishTranslation: result.englishTranslation,
                              category: detectedCategory?.name || null
                            }
                          })
                          
                          // Delete the duplicate word
                          await prisma.word.delete({
                            where: { id: word.id }
                          })
                          
                          return existingWord
                        }
                      }
                      throw updateError
                    }
                  })
                  
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
              
              // Send each result individually
              for (const result of batchResults) {
                processedCount++
                sendEvent({
                  type: 'result',
                  result,
                  processedWords: processedCount,
                  totalWords: words.length
                })
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
                const result = await processWord(
                  word.word,
                  categoryNames,
                  languageNames,
                  model,
                  finalLangPrompt,
                  finalCatPrompt
                )
                
                // Update database
                const detectedLanguage = languages.find(l => 
                  l.name.toLowerCase() === result.language.toLowerCase()
                )
                
                const detectedCategory = categories.find(c => 
                  c.name.toLowerCase() === result.category.toLowerCase()
                )
                
                await withConnection(async () => {
                  // Handle potential unique constraint violation
                  try {
                    return await prisma.word.update({
                      where: { id: word.id },
                      data: {
                        languageId: detectedLanguage?.id || null,
                        englishTranslation: result.englishTranslation,
                        category: detectedCategory?.name || null
                      }
                    })
                  } catch (updateError: any) {
                    // If unique constraint violation, try to find existing word and update it
                    if (updateError.code === 'P2002') {
                      console.log(`Unique constraint violation for word "${word.word}", attempting to resolve...`)
                      
                      // Find the existing word with the same word and languageId
                      const existingWord = await prisma.word.findFirst({
                        where: {
                          word: word.word,
                          languageId: detectedLanguage?.id || null
                        }
                      })
                      
                      if (existingWord && existingWord.id !== word.id) {
                        // Update the existing word and delete the current one
                        await prisma.word.update({
                          where: { id: existingWord.id },
                          data: {
                            englishTranslation: result.englishTranslation,
                            category: detectedCategory?.name || null
                          }
                        })
                        
                        // Delete the duplicate word
                        await prisma.word.delete({
                          where: { id: word.id }
                        })
                        
                        return existingWord
                      }
                    }
                    throw updateError
                  }
                })
                
                // Send result
                sendEvent({
                  type: 'result',
                  result,
                  processedWords: i + 1,
                  totalWords: words.length
                })
                
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
                
                sendEvent({
                  type: 'result',
                  result: errorResult,
                  processedWords: i + 1,
                  totalWords: words.length
                })
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
          sendEvent({
            type: 'error',
            error: 'Processing failed'
          })
        } finally {
          // Ensure database connection is cleaned up
          await safeDisconnect()
          controller.close()
        }
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