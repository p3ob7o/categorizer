'use client'

import { useState, useEffect } from 'react'
import ResultsFeed from '@/components/ResultsFeed'
import { PromptModal } from '@/components/PromptModal'
import { ProcessingResult } from '@/types'
import { Play, Download, Settings, Database, Zap, Layers, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import WizardLogo from '@/components/WizardLogo'

const DEFAULT_MODEL = 'gpt-4o-mini'
const DEFAULT_LANG_PROMPT = `You are a language detection and translation expert. Given a word and a list of languages, determine:\n1. The primary language of the word (if it exists in English, that's always primary)\n2. If the word is not in English, provide an English translation\n3. If the word exists in multiple languages from the list, choose the first one in the order provided\n\nLanguages to consider: English, {languages}\n\nRespond with JSON format:\n{\n  "language": "detected_language",\n  "englishTranslation": "english_translation_or_same_word_if_already_english"\n}`
const DEFAULT_CAT_PROMPT = `You are a categorization expert. Given a word and a list of categories, determine which category the word best fits into. Be fuzzy in your matching - if the word kind of belongs to a category, that's fine. If it doesn't fit any category well, return an empty string.\n\nAvailable categories: {categories}\n\nRespond with just the category name or an empty string if no good match.`

type ProcessingMode = 'batch' | 'parallel'

export default function Home() {
  const [databaseStatus, setDatabaseStatus] = useState<{ categories: number; words: number; languages: number } | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('batch')
  const [processedCount, setProcessedCount] = useState(0)
  const [totalWords, setTotalWords] = useState(0)
  const [results, setResults] = useState<ProcessingResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [langPrompt, setLangPrompt] = useState(DEFAULT_LANG_PROMPT)
  const [catPrompt, setCatPrompt] = useState(DEFAULT_CAT_PROMPT)
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false)

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
      
      setDatabaseStatus({
        categories: Array.isArray(categories) ? categories.length : 0,
        words: Array.isArray(words) ? words.length : 0,
        languages: Array.isArray(languages) ? languages.length : 0
      })
      
      // Set total words for processing
      if (Array.isArray(words)) {
        setTotalWords(words.length)
      }
    } catch (error) {
      console.error('Failed to load database status:', error)
    }
  }

  const handleStartProcessing = async () => {
    try {
      setError(null)
      setIsProcessing(true)
      setProcessedCount(0)
      setResults([])
      
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          mode: processingMode,
          model: DEFAULT_MODEL,
          langPrompt,
          catPrompt
        })
      })

      const data = await response.json()
      
      if (response.ok && data.success) {
        setProcessedCount(data.processed || 0)
        setResults(data.results || [])
        // Refresh database status to show updated words
        await loadDatabaseStatus()
      } else {
        setError(data.error || 'Failed to process words')
      }
    } catch (error) {
      setError('Failed to process words')
    } finally {
      setIsProcessing(false)
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
            Domain Categorizer
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
                  className={`relative p-4 rounded-md border transition-all ${
                    processingMode === 'batch'
                      ? 'border-zinc-900 dark:border-white bg-zinc-50 dark:bg-zinc-900'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
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
                  className={`relative p-4 rounded-md border transition-all ${
                    processingMode === 'parallel'
                      ? 'border-zinc-900 dark:border-white bg-zinc-50 dark:bg-zinc-900'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
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

              {/* Start Processing Button */}
              <button
                onClick={handleStartProcessing}
                disabled={!canStartProcessing}
                className="btn btn-primary w-full"
              >
                {isProcessing ? (
                  <>
                    <div className="h-3 w-3 border-2 border-zinc-300 border-t-transparent rounded-full animate-spin mr-2" />
                    Processing {processedCount} of {totalWords}
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
                    <span>{processingMode === 'parallel' ? 'Parallel' : 'Batch'} processing</span>
                    <span>{Math.round((processedCount / totalWords) * 100)}%</span>
                  </div>
                  <div className="h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-zinc-900 dark:bg-white transition-all duration-300"
                      style={{ width: `${(processedCount / totalWords) * 100}%` }}
                    />
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

        {/* Results Feed */}
        {results.length > 0 && (
          <div className="max-w-3xl mx-auto">
            <div className="card p-6">
              <h2 className="text-sm font-semibold mb-4">Processing Results</h2>
              <ResultsFeed results={results} />
            </div>
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