import { NextResponse } from 'next/server'
import { getCurrentSessionId } from '@/lib/session'
import { getSession } from '@/lib/db'

export async function GET() {
  try {
    const sessionId = await getCurrentSessionId()
    
    if (!sessionId) {
      return NextResponse.json({
        filesStatus: null,
        progress: null
      })
    }

    const session = await getSession(sessionId)
    
    if (!session) {
      return NextResponse.json({
        filesStatus: null,
        progress: null
      })
    }

    // Convert session data to the expected format
    const filesStatus = {
      categories: session.categories.map(c => c.name),
      languages: session.languages.map(l => l.name),
      words: session.words.map(w => w.originalWord),
    }

    const progress = {
      totalWords: session.totalWords,
      processedWords: session.processedWords,
      currentWord: session.currentWord || '',
      isProcessing: session.status === 'processing',
      error: session.error,
      results: session.results.map(r => ({
        originalWord: r.originalWord,
        language: r.language || '',
        englishTranslation: r.englishTranslation || '',
        category: r.category || ''
      }))
    }

    return NextResponse.json({
      filesStatus: filesStatus.categories.length || filesStatus.words.length ? filesStatus : null,
      progress: session.totalWords > 0 ? progress : null
    })
  } catch (error) {
    console.error('Status error:', error)
    return NextResponse.json({
      filesStatus: null,
      progress: null
    })
  }
} 