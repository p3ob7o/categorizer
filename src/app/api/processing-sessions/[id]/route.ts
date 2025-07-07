import { NextRequest, NextResponse } from 'next/server'
import { withConnection, prisma } from '@/lib/db'
import { ProcessingService, ProcessingConfig } from '@/lib/processing'

// Get session details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id

    const session = await withConnection(async () => {
      return prisma.processingSession.findUnique({
        where: { id: sessionId },
        include: {
          results: {
            orderBy: { processedAt: 'desc' },
            take: 50 // Get latest 50 results
          },
          analytics: {
            orderBy: { createdAt: 'desc' },
            take: 1 // Get latest analytics
          }
        }
      })
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Calculate additional statistics
    const stats = {
      successRate: session.totalWords > 0 
        ? (session.successfulWords / session.processedWords) * 100 
        : 0,
      failureRate: session.totalWords > 0 
        ? (session.failedWords / session.processedWords) * 100 
        : 0,
      completionRate: session.totalWords > 0 
        ? (session.processedWords / session.totalWords) * 100 
        : 0,
      averageCostPerWord: session.processedWords > 0 
        ? session.estimatedCost / session.processedWords 
        : 0,
      processingDuration: session.startedAt && session.completedAt
        ? session.completedAt.getTime() - session.startedAt.getTime()
        : session.startedAt
        ? Date.now() - session.startedAt.getTime()
        : 0
    }

    return NextResponse.json({
      ...session,
      stats
    })
  } catch (error) {
    console.error('Error fetching session:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch session' 
    }, { status: 500 })
  }
}

// Update session (pause, resume, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id
    const body = await request.json()
    const { action } = body

    const session = await withConnection(async () => {
      return prisma.processingSession.findUnique({
        where: { id: sessionId }
      })
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    switch (action) {
      case 'pause':
        if (session.status !== 'processing') {
          return NextResponse.json({ 
            error: 'Can only pause processing sessions' 
          }, { status: 400 })
        }

        const pausedSession = await withConnection(async () => {
          return prisma.processingSession.update({
            where: { id: sessionId },
            data: { status: 'paused' }
          })
        })

        return NextResponse.json(pausedSession)

      case 'cancel':
        if (!['processing', 'paused', 'pending'].includes(session.status)) {
          return NextResponse.json({ 
            error: 'Cannot cancel completed or failed sessions' 
          }, { status: 400 })
        }

        const cancelledSession = await withConnection(async () => {
          return prisma.processingSession.update({
            where: { id: sessionId },
            data: { 
              status: 'failed',
              error: 'Cancelled by user',
              completedAt: new Date()
            }
          })
        })

        return NextResponse.json(cancelledSession)

      case 'reset':
        if (session.status === 'processing') {
          return NextResponse.json({ 
            error: 'Cannot reset a processing session' 
          }, { status: 400 })
        }

        const resetSession = await withConnection(async () => {
          return prisma.processingSession.update({
            where: { id: sessionId },
            data: {
              status: 'pending',
              processedWords: 0,
              successfulWords: 0,
              failedWords: 0,
              currentChunk: 0,
              totalTokensUsed: 0,
              estimatedCost: 0,
              startedAt: null,
              completedAt: null,
              estimatedEndTime: null,
              lastProcessedAt: null,
              error: null,
              retryCount: 0,
              lastProcessedWordId: null
            }
          })
        })

        // Also delete existing results
        await withConnection(async () => {
          await prisma.processingResult.deleteMany({
            where: { sessionId }
          })
        })

        return NextResponse.json(resetSession)

      default:
        return NextResponse.json({ 
          error: 'Invalid action. Supported actions: pause, cancel, reset' 
        }, { status: 400 })
    }
  } catch (error) {
    console.error('Error updating session:', error)
    return NextResponse.json({ 
      error: 'Failed to update session' 
    }, { status: 500 })
  }
}

// Delete session
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id

    const session = await withConnection(async () => {
      return prisma.processingSession.findUnique({
        where: { id: sessionId }
      })
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.status === 'processing') {
      return NextResponse.json({ 
        error: 'Cannot delete a processing session. Pause or cancel it first.' 
      }, { status: 400 })
    }

    // Delete session and all related data (cascade will handle results and analytics)
    await withConnection(async () => {
      await prisma.processingSession.delete({
        where: { id: sessionId }
      })
    })

    return NextResponse.json({ message: 'Session deleted successfully' })
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json({ 
      error: 'Failed to delete session' 
    }, { status: 500 })
  }
} 