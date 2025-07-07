import { NextRequest, NextResponse } from 'next/server'
import { ProcessingService, ProcessingConfig } from '@/lib/processing'
import { withConnection, prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      mode = 'batch', 
      model = 'gpt-4o-mini', 
      chunkSize = 10,
      maxRetries = 3,
      langPrompt, 
      catPrompt, 
      wordIds 
    } = body

    if (!wordIds || !Array.isArray(wordIds) || wordIds.length === 0) {
      return NextResponse.json({ 
        error: 'wordIds array is required and cannot be empty' 
      }, { status: 400 })
    }

    // Generate unique session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Create processing configuration
    const config: ProcessingConfig = {
      mode,
      model,
      chunkSize: Math.max(1, Math.min(50, chunkSize)), // Limit chunk size between 1-50
      maxRetries,
      languagePrompt: langPrompt,
      categoryPrompt: catPrompt,
      wordIds
    }

    // Create processing service
    const processingService = new ProcessingService(sessionId, config)

    // Create session in database
    await processingService.createSession(wordIds)

    // Create a readable stream for Server-Sent Events
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        
        const sendEvent = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }

        // Set up event callback
        processingService.setEventCallback((event) => {
          sendEvent({
            type: event.type,
            sessionId: event.sessionId,
            data: event.data,
            timestamp: event.timestamp
          })
        })

        try {
          // Send initial status
          const initialStats = await processingService.getProcessingStats()
          sendEvent({
            type: 'started',
            sessionId,
            data: {
              stats: initialStats,
              config: {
                mode,
                model,
                chunkSize: config.chunkSize,
                totalWords: wordIds.length
              }
            },
            timestamp: new Date()
          })

          // Start processing
          await processingService.processWords()

        } catch (error) {
          console.error('Enhanced processing error:', error)
          sendEvent({
            type: 'error',
            sessionId,
            data: {
              error: error instanceof Error ? error.message : 'Processing failed',
              canResume: true
            },
            timestamp: new Date()
          })
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Session-ID': sessionId,
      },
    })
  } catch (error) {
    console.error('Enhanced process error:', error)
    return NextResponse.json({ 
      error: 'Failed to start processing',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Resume a paused or failed session
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId } = body

    if (!sessionId) {
      return NextResponse.json({ 
        error: 'sessionId is required' 
      }, { status: 400 })
    }

    // Get existing session to determine configuration
    const existingSession = await withConnection(async () => {
      return prisma.processingSession.findUnique({
        where: { id: sessionId }
      })
    })

    if (!existingSession) {
      return NextResponse.json({ 
        error: 'Session not found' 
      }, { status: 404 })
    }

    if (existingSession.status === 'completed') {
      return NextResponse.json({ 
        error: 'Session already completed' 
      }, { status: 400 })
    }

    // Create processing service with existing configuration
    const config: ProcessingConfig = {
      mode: existingSession.mode as 'batch' | 'parallel',
      model: existingSession.model,
      chunkSize: existingSession.chunkSize,
      maxRetries: existingSession.maxRetries,
      languagePrompt: existingSession.languagePrompt || undefined,
      categoryPrompt: existingSession.categoryPrompt || undefined
    }

    const processingService = new ProcessingService(sessionId, config)

    // Create a readable stream for resuming
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        
        const sendEvent = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }

        // Set up event callback
        processingService.setEventCallback((event) => {
          sendEvent({
            type: event.type,
            sessionId: event.sessionId,
            data: event.data,
            timestamp: event.timestamp
          })
        })

        try {
          // Send resume status
          const stats = await processingService.getProcessingStats()
          sendEvent({
            type: 'resumed',
            sessionId,
            data: {
              stats,
              resumedFrom: {
                chunk: existingSession.currentChunk,
                processedWords: existingSession.processedWords
              }
            },
            timestamp: new Date()
          })

          // Resume processing
          await processingService.processWords()

        } catch (error) {
          console.error('Resume processing error:', error)
          sendEvent({
            type: 'error',
            sessionId,
            data: {
              error: error instanceof Error ? error.message : 'Resume failed',
              canResume: true
            },
            timestamp: new Date()
          })
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Session-ID': sessionId,
      },
    })
  } catch (error) {
    console.error('Resume process error:', error)
    return NextResponse.json({ 
      error: 'Failed to resume processing',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 