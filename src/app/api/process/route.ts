import { NextRequest, NextResponse } from 'next/server'
import { processBatch } from '@/lib/openai'
import { saveProgress, loadProgress, exportToCSV } from '@/lib/storage'
import { loadFilesStatus } from '@/lib/storage'
import { ProcessingStatus } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, model, langPrompt, catPrompt } = body;

    if (action === 'start') {
      // Load uploaded files
      const filesStatus = loadFilesStatus()
      if (!filesStatus || !filesStatus.words.length || !filesStatus.categories.length) {
        return NextResponse.json({ 
          error: 'Please upload categories and words files first' 
        }, { status: 400 })
      }

      // Check for existing progress
      const existingProgress = loadProgress()
      const startIndex = existingProgress ? existingProgress.processedWords : 0
      const existingResults = existingProgress ? existingProgress.results : []

      // Initialize or update progress
      const progress: ProcessingStatus = {
        totalWords: filesStatus.words.length,
        processedWords: startIndex,
        currentWord: filesStatus.words[startIndex] || '',
        isProcessing: true,
        results: existingResults
      }

      saveProgress(progress)

      // Start processing in background
      console.log(`🚀 Starting batch processing for ${filesStatus.words.length} words`)
      console.log(`📊 Categories: ${filesStatus.categories.length}`)
      console.log(`🌍 Languages: ${filesStatus.languages?.length || 0}`)
      
      // Fix: accumulate results as we go
      const currentResults: any[] = []
      processBatch(
        filesStatus.words,
        filesStatus.categories,
        filesStatus.languages || [],
        startIndex,
        (result, currentIndex, totalWords) => {
          currentResults.push(result)
          const updatedResults = [...existingResults, ...currentResults]
          const updatedProgress: ProcessingStatus = {
            totalWords,
            processedWords: currentIndex,
            currentWord: filesStatus.words[currentIndex] || '',
            isProcessing: true,
            results: updatedResults
          }
          saveProgress(updatedProgress)
        },
        model,
        langPrompt,
        catPrompt
      ).then((results) => {
        console.log(`✅ Batch processing completed. Processed ${results.length} words`)
        const finalProgress: ProcessingStatus = {
          totalWords: filesStatus.words.length,
          processedWords: filesStatus.words.length,
          currentWord: '',
          isProcessing: false,
          results: [...existingResults, ...results]
        }
        saveProgress(finalProgress)
      }).catch((error) => {
        console.error(`❌ Batch processing failed:`, error)
        const errorProgress: ProcessingStatus = {
          totalWords: filesStatus.words.length,
          processedWords: startIndex,
          currentWord: '',
          isProcessing: false,
          error: error.message,
          results: existingResults
        }
        saveProgress(errorProgress)
      })

      return NextResponse.json({ success: true, progress })
    }

    if (action === 'status') {
      const progress = loadProgress()
      return NextResponse.json({ progress })
    }

    if (action === 'export') {
      const progress = loadProgress()
      if (!progress || !progress.results.length) {
        return NextResponse.json({ error: 'No results to export' }, { status: 400 })
      }

      const csvPath = exportToCSV(progress.results)
      return NextResponse.json({ success: true, csvPath })
    }

    if (action === 'reset') {
      const { clearProgress, clearFilesStatus } = await import('@/lib/storage')
      clearProgress()
      clearFilesStatus()
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Process error:', error)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
} 