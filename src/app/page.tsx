'use client'

import { useState, useEffect, useRef } from 'react'
import RealTimeResultsFeed from '@/components/RealTimeResultsFeed'
import { PromptModal } from '@/components/PromptModal'
import { ProcessingResult } from '@/types'
import { Play, Square, Download, Settings, Database, Zap, Layers, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import WizardLogo from '@/components/WizardLogo'

const DEFAULT_MODEL = 'gpt-4o-mini'
const DEFAULT_LANG_PROMPT = `You are a language detection and translation expert. Given a word and a list of languages, determine:\n1. The primary language of the word using the priority order provided (languages are listed in priority order)\n2. If the word is not in English, provide an English translation\n3. If the word exists in multiple languages from the list, choose the one with the highest priority (first in the list)\n\nLanguages to consider (in priority order): {languages}\n\nRespond with JSON format:\n{\n  "language": "detected_language",\n  "englishTranslation": "english_translation_or_same_word_if_already_english"\n}`
const DEFAULT_CAT_PROMPT = `You are a categorization expert. Given a word and a list of categories, determine which category the word best fits into. Be fuzzy in your matching - if the word kind of belongs to a category, that's fine. If it doesn't fit any category well, return an empty string.\n\nAvailable categories: {categories}\n\nRespond with just the category name or an empty string if no good match.`

type ProcessingMode = 'batch' | 'parallel'

export default function Home() {
  const [databaseStatus, setDatabaseStatus] = useState<{ categories: number; words: number; languages: number; unprocessedWords: number } | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('batch')
  const [processedCount, setProcessedCount] = useState(0)
  const [totalWords, setTotalWords] = useState(0)
  const [results, setResults] = useState<ProcessingResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [langPrompt, setLangPrompt] = useState(DEFAULT_LANG_PROMPT)
  const [catPrompt, setCatPrompt] = useState(DEFAULT_CAT_PROMPT)
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false)
  const [processOnlyUnprocessed, setProcessOnlyUnprocessed] = useState(false)
  
  // Ref to store the stream reader for cancellation
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)

  // Load initial status
  useEffect(() => {
    loadDatabaseStatus()
  }, [])

  const loadDatabaseStatus = async () => {
    try {
      const [categoriesRes, wordsRes, languagesRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/words'),
        fetch('/api/languages')
      ])
      
      const categories = await categoriesRes.json()
      const words = await wordsRes.json()
      const languages = await languagesRes.json()
      
      // Count unprocessed words (missing language, translation, or category)
      const unprocessedWords = Array.isArray(words) 
        ? words.filter(word => !word.languageId || !word.englishTranslation || !word.category).length
        : 0
      
      setDatabaseStatus({
        categories: Array.isArray(categories) ? categories.length : 0,
        words: Array.isArray(words) ? words.length : 0,
        languages: Array.isArray(languages) ? languages.length : 0,
        unprocessedWords
      })
      
      // Set total words for processing
      if (Array.isArray(words)) {
        setTotalWords(words.length)
      }
    } catch (error) {
      console.error('Failed to load database status:', error)
    }
  }

  const handleStopProcessing = () => {
    if (readerRef.current) {
      readerRef.current.cancel()
      readerRef.current = null
    }
    setIsProcessing(false)
    setError('Processing stopped by user')
  }

  const handleStartProcessing = async () => {
    try {
      setError(null)
      setIsProcessing(true)
      setProcessedCount(0)
      setResults([])
      
      const response = await fetch('/api/process-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: processingMode,
          model: DEFAULT_MODEL,
          langPrompt,
          catPrompt,
          onlyUnprocessed: processOnlyUnprocessed
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to start processing')
        setIsProcessing(false)
        return
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      
      if (!reader) {
        setError('Failed to create stream reader')
        setIsProcessing(false)
        return
      }

      // Store reader for cancellation
      readerRef.current = reader

      // Process the stream
      try {
        while (true) {
          const { done, value } = await reader.read()
          
          if (done) {
            break
          }

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                
                if (data.type === 'result') {
                  setResults(prev => [...prev, data.result])
                  setProcessedCount(data.processedWords)
                } else if (data.type === 'status') {
                  setProcessedCount(data.processedWords)
                  setTotalWords(data.totalWords)
                } else if (data.type === 'complete') {
                  setIsProcessing(false)
                  setProcessedCount(data.processedWords)
                  // Refresh database status to show updated words
                  await loadDatabaseStatus()
                } else if (data.type === 'error') {
                  setError(data.error)
                  setIsProcessing(false)
                }
              } catch (parseError) {
                console.error('Error parsing stream data:', parseError)
              }
            }
          }
        }
      } catch (streamError: any) {
        if (streamError.name !== 'AbortError') {
          console.error('Streaming error:', streamError)
          setError('Failed to process words')
        }
        setIsProcessing(false)
      } finally {
        readerRef.current = null
      }
    } catch (error) {
      console.error('Processing error:', error)
      setError('Failed to start processing')
      setIsProcessing(false)
      readerRef.current = null
    }
  }

  const handleExportResults = async () => {
    try {
      setError(null)
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export' })
      })

      const data = await response.json()
      
      if (data.success) {
        // Create download link
        const link = document.createElement('a')
        link.href = `/api/download?file=${encodeURIComponent(data.csvPath)}`
        link.download = 'categorized-words.csv'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        setError(data.error || 'Export failed')
      }
    } catch (error) {
      setError('Export failed')
    }
  }

  const handleSavePrompts = (newLangPrompt: string, newCatPrompt: string) => {
    setLangPrompt(newLangPrompt)
    setCatPrompt(newCatPrompt)
  }

  const canStartProcessing = databaseStatus && databaseStatus.categories > 0 && databaseStatus.words > 0 && !isProcessing

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="max-w-3xl mx-auto text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <WizardLogo className="h-16 w-16 text-zinc-900 dark:text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Categorizator
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm">
            AI-powered categorization for domain names and word lists
          </p>
        </div>

        {error && (
          <div className="max-w-3xl mx-auto mb-6">
            <div className="rounded-md bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/50 p-3">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        )}

        {/* Database Status */}
        <div className="max-w-3xl mx-auto mb-8">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-sm font-semibold mb-1">Database Overview</h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Current data in your categorization system
                </p>
              </div>
              <Link
                href="/db-management"
                className="btn btn-secondary group"
              >
                <Database className="h-3 w-3 mr-1.5" />
                Manage
                <ArrowRight className="h-3 w-3 ml-1 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-md bg-zinc-50 dark:bg-zinc-900/50">
                <p className="text-2xl font-semibold">{databaseStatus?.categories || 0}</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">Categories</p>
              </div>
              <div className="text-center p-4 rounded-md bg-zinc-50 dark:bg-zinc-900/50">
                <p className="text-2xl font-semibold">{databaseStatus?.languages || 0}</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">Languages</p>
              </div>
              <div className="text-center p-4 rounded-md bg-zinc-50 dark:bg-zinc-900/50">
                <p className="text-2xl font-semibold">{databaseStatus?.words || 0}</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">Words</p>
              </div>
            </div>
            
            {(!databaseStatus?.categories || !databaseStatus?.words) && (
              <div className="mt-4 p-3 rounded-md bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/50">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Add at least one category and one word to start processing
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Processing Section */}
        {databaseStatus && databaseStatus.categories > 0 && databaseStatus.words > 0 && (
          <div className="max-w-3xl mx-auto mb-8">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-sm font-semibold mb-1">Processing Options</h2>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    Choose how to process your word list
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsPromptModalOpen(true)}
                    className="btn btn-ghost"
                  >
                    <Settings className="h-3 w-3 mr-1.5" />
                    Prompts
                  </button>
                  <button
                    onClick={handleExportResults}
                    className="btn btn-secondary"
                  >
                    <Download className="h-3 w-3 mr-1.5" />
                    Export
                  </button>
                </div>
              </div>

              {/* Processing Mode Selection */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  onClick={() => setProcessingMode('batch')}
                  disabled={isProcessing}
                  className={`relative p-4 rounded-md border transition-all ${
                    processingMode === 'batch'
                      ? 'border-zinc-900 dark:border-white bg-zinc-50 dark:bg-zinc-900'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                  } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Layers className="h-5 w-5 mb-2 text-zinc-700 dark:text-zinc-300" />
                  <h3 className="text-sm font-medium mb-1">Batch</h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    Sequential processing
                  </p>
                  {processingMode === 'batch' && (
                    <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-zinc-900 dark:bg-white" />
                  )}
                </button>
                <button
                  onClick={() => setProcessingMode('parallel')}
                  disabled={isProcessing}
                  className={`relative p-4 rounded-md border transition-all ${
                    processingMode === 'parallel'
                      ? 'border-zinc-900 dark:border-white bg-zinc-50 dark:bg-zinc-900'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                  } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Zap className="h-5 w-5 mb-2 text-zinc-700 dark:text-zinc-300" />
                  <h3 className="text-sm font-medium mb-1">Parallel</h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    Faster batch processing
                  </p>
                  {processingMode === 'parallel' && (
                    <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-zinc-900 dark:bg-white" />
                  )}
                </button>
              </div>

              {/* Processing Options */}
              <div className="mb-6">
                <label className="flex items-center gap-3 p-3 rounded-md border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={processOnlyUnprocessed}
                    onChange={(e) => setProcessOnlyUnprocessed(e.target.checked)}
                    disabled={isProcessing}
                    className="rounded border-zinc-300 dark:border-zinc-600 text-zinc-900 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Process only unprocessed words</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      Skip words that already have language, translation, and category assigned
                      {databaseStatus?.unprocessedWords !== undefined && (
                        <span className="ml-1">({databaseStatus.unprocessedWords} unprocessed)</span>
                      )}
                    </p>
                  </div>
                </label>
              </div>

              {/* Start/Stop Processing Button */}
              <button
                onClick={isProcessing ? handleStopProcessing : handleStartProcessing}
                disabled={!isProcessing && !canStartProcessing}
                className={`btn w-full ${isProcessing ? 'btn-secondary' : 'btn-primary'}`}
              >
                {isProcessing ? (
                  <>
                    <Square className="h-3 w-3 mr-1.5" />
                    Stop Processing
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3 mr-1.5" />
                    Start Processing
                  </>
                )}
              </button>

              {/* Progress Display */}
              {isProcessing && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400 mb-2">
                    <span>
                      {processingMode === 'parallel' ? 'Parallel' : 'Sequential'} processing
                      {processOnlyUnprocessed && ' (unprocessed only)'}
                      {processedCount > 0 && ` • ${processedCount}/${totalWords} words`}
                    </span>
                    <span>{totalWords > 0 ? Math.round((processedCount / totalWords) * 100) : 0}%</span>
                  </div>
                  <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500 ease-out"
                      style={{ width: `${totalWords > 0 ? (processedCount / totalWords) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      Processing in real-time • Results appear below as they complete
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">Running</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Results Summary */}
              {!isProcessing && processedCount > 0 && (
                <div className="mt-4 p-3 rounded-md bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/50">
                  <p className="text-xs text-emerald-800 dark:text-emerald-200">
                    Successfully processed {processedCount} words
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Real-time Results Feed */}
        {(results.length > 0 || isProcessing) && (
          <div className="max-w-3xl mx-auto">
            <RealTimeResultsFeed 
              results={results}
              isProcessing={isProcessing}
              processedCount={processedCount}
              totalWords={totalWords}
            />
          </div>
        )}

        {/* Prompt Modal */}
        <PromptModal
          isOpen={isPromptModalOpen}
          onClose={() => setIsPromptModalOpen(false)}
          onSave={handleSavePrompts}
          currentLangPrompt={langPrompt}
          currentCatPrompt={catPrompt}
          defaultLangPrompt={DEFAULT_LANG_PROMPT}
          defaultCatPrompt={DEFAULT_CAT_PROMPT}
        />
      </div>
    </div>
  )
} 