import { NextRequest, NextResponse } from 'next/server'
import { withConnection, prisma } from '@/lib/db'

// Get all processing sessions with optional filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {}
    if (status) {
      where.status = status
    }

    const [sessions, total] = await withConnection(async () => {
      return Promise.all([
        prisma.processingSession.findMany({
          where,
          include: {
            _count: {
              select: {
                results: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset
        }),
        prisma.processingSession.count({ where })
      ])
    })

    return NextResponse.json({
      sessions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    })
  } catch (error) {
    console.error('Error fetching processing sessions:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch processing sessions' 
    }, { status: 500 })
  }
}

// Create a new processing session (for manual session creation)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      mode = 'batch',
      model = 'gpt-4o-mini',
      chunkSize = 10,
      maxRetries = 3,
      languagePrompt,
      categoryPrompt,
      wordIds
    } = body

    if (!wordIds || !Array.isArray(wordIds) || wordIds.length === 0) {
      return NextResponse.json({ 
        error: 'wordIds array is required and cannot be empty' 
      }, { status: 400 })
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const totalWords = wordIds.length
    const totalChunks = Math.ceil(totalWords / chunkSize)

    const session = await withConnection(async () => {
      return prisma.processingSession.create({
        data: {
          id: sessionId,
          status: 'pending',
          totalWords,
          totalChunks,
          chunkSize,
          mode,
          model,
          maxRetries,
          languagePrompt,
          categoryPrompt,
          resumeData: { wordIds }
        }
      })
    })

    return NextResponse.json(session)
  } catch (error) {
    console.error('Error creating processing session:', error)
    return NextResponse.json({ 
      error: 'Failed to create processing session' 
    }, { status: 500 })
  }
} 