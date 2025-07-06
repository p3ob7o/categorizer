import { NextRequest, NextResponse } from 'next/server'
import { processBatch } from '@/lib/openai'
import { getCurrentSessionId, clearSession } from '@/lib/session'
import { getSession, updateSessionStatus, saveResult, getResultsForExport, deleteSession } from '@/lib/db'
import { ProcessingStatus } from '@/types'
import { exportToCSV } from '@/lib/storage'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, model, langPrompt, catPrompt } = body;

    if (action === 'start') {
      const sessionId = await getCurrentSessionId()
      if (!sessionId) {
        return NextResponse.json({ 
          error: 'No active session. Please upload files first.' 
        }, { status: 400 })
      }

      const session = await getSession(sessionId)
      if (!session) {
        return NextResponse.json({ 
          error: 'Session not found' 
        }, { status: 404 })
      }

      if (!session.words.length || !session.categories.length) {
        return NextResponse.json({ 
          error: 'Please upload categories and words files first' 
        }, { status: 400 })
      }

      // Check if already processing
      if (session.status === 'processing') {
        return NextResponse.json({ 
          error: 'Already processing' 
        }, { status: 400 })
      }

      // Get words and categories
      const words = session.words.map(w => w.originalWord)
      const categories = session.categories.map(c => c.name)
      const languages = session.languages.map(l => l.name)

      // Determine start index based on existing results
      const startIndex = session.results.length

      // Update session status to processing
      await updateSessionStatus(sessionId, {
        status: 'processing',
        processedWords: startIndex,
        error: null
      })

      // Start processing in background
      console.log(`🚀 Starting batch processing for ${words.length} words`)
      console.log(`📊 Categories: ${categories.length}`)
      console.log(`🌍 Languages: ${languages.length}`)
      
      processBatch(
        words,
        categories,
        languages,
        startIndex,
        async (result, currentIndex, totalWords) => {
          // Save result to database
          await saveResult(sessionId, result)
          
          // Update progress
          await updateSessionStatus(sessionId, {
            processedWords: currentIndex,
            currentWord: words[currentIndex] || '',
          })
        },
        model,
        langPrompt,
        catPrompt
      ).then(async () => {
        console.log(`✅ Batch processing completed`)
        await updateSessionStatus(sessionId, {
          status: 'completed',
          processedWords: words.length,
          currentWord: null,
        })
      }).catch(async (error) => {
        console.error(`❌ Batch processing failed:`, error)
        await updateSessionStatus(sessionId, {
          status: 'error',
          error: error.message,
        })
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'export') {
      const sessionId = await getCurrentSessionId()
      if (!sessionId) {
        return NextResponse.json({ error: 'No active session' }, { status: 400 })
      }

      const results = await getResultsForExport(sessionId)
      if (!results.length) {
        return NextResponse.json({ error: 'No results to export' }, { status: 400 })
      }

      const csvPath = exportToCSV(results)
      return NextResponse.json({ success: true, csvPath })
    }

    if (action === 'reset') {
      const sessionId = await getCurrentSessionId()
      if (sessionId) {
        await deleteSession(sessionId)
      }
      await clearSession()
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Process error:', error)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
} 