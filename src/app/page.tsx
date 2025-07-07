'use client'

import { useState, useEffect } from 'react'
import RealTimeResultsFeed from '@/components/RealTimeResultsFeed'
import { PromptModal } from '@/components/PromptModal'
import { ProcessingResult } from '@/types'
import { Play, Download, Settings, Database, Zap, Layers, ArrowRight, Sparkles, Pause, Square, Clock, DollarSign, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'
import WizardLogo from '@/components/WizardLogo'

const DEFAULT_MODEL = 'gpt-4o-mini'
const DEFAULT_LANG_PROMPT = `You are a language detection and translation expert. Given a word and a list of languages, determine:\n1. The primary language of the word using the priority order provided (languages are listed in priority order)\n2. If the word is not in English, provide an English translation\n3. If the word exists in multiple languages from the list, choose the one with the highest priority (first in the list)\n\nLanguages to consider (in priority order): {languages}\n\nRespond with JSON format:\n{\n  "language": "detected_language",\n  "englishTranslation": "english_translation_or_same_word_if_already_english"\n}`
const DEFAULT_CAT_PROMPT = `You are a categorization expert. Given a word and a list of categories, determine which category the word best fits into. Be fuzzy in your matching - if the word kind of belongs to a category, that's fine. If it doesn't fit any category well, return an empty string.\n\nAvailable categories: {categories}\n\nRespond with just the category name or an empty string if no good match.`

type ProcessingMode = 'batch' | 'parallel'

interface ProcessingConfig {
  mode: ProcessingMode
  model: string
  chunkSize: number
  maxRetries: number
  langPrompt?: string
  catPrompt?: string
}

interface ProcessingStats {
  totalWords: number
  processedWords: number
  successfulWords: number
  failedWords: number
  currentChunk: number
  totalChunks: number
  estimatedTimeRemaining: number
  averageProcessingTime: number
  totalCost: number
  processingRate: number
}

interface ProcessingSession {
  id: string
  status: string
  config: ProcessingConfig
  stats: ProcessingStats
  error?: string
  canResume?: boolean
}

export default function Home() {
  const [databaseStatus, setDatabaseStatus] = useState<{ categories: number; words: number; languages: number } | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [session, setSession] = useState<ProcessingSession | null>(null)
  const [processedCount, setProcessedCount] = useState(0)
  const [totalWords, setTotalWords] = useState(0)
  const [results, setResults] = useState<ProcessingResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [langPrompt, setLangPrompt] = useState(DEFAULT_LANG_PROMPT)
  const [catPrompt, setCatPrompt] = useState(DEFAULT_CAT_PROMPT)
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false)
  const [selectedWords, setSelectedWords] = useState<number[]>([])
  const [allWords, setAllWords] = useState<any[]>([])
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false)
  
  // Configuration state
  const [config, setConfig] = useState<ProcessingConfig>({
    mode: 'batch',
    model: DEFAULT_MODEL,
    chunkSize: 10,
    maxRetries: 3,
    langPrompt: DEFAULT_LANG_PROMPT,
    catPrompt: DEFAULT_CAT_PROMPT
  })

  // Load initial status
  useEffect(() => {
    loadDatabaseStatus()
    loadWords()
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

  const loadWords = async () => {
    try {
      const response = await fetch('/api/words')
      if (response.ok) {
        const words = await response.json()
        setAllWords(words)
        // Select unprocessed words by default
        const unprocessedWords = words.filter((w: any) => !w.languageId || !w.category)
        setSelectedWords(unprocessedWords.map((w: any) => w.id))
      }
    } catch (error) {
      console.error('Error loading words:', error)
    }
  }

  const handleStartProcessing = async () => {
    if (selectedWords.length === 0) {
      setError('Please select words to process')
      return
    }

    try {
      setError(null)
      setIsProcessing(true)
      setIsPaused(false)
      setProcessedCount(0)
      setResults([])
      
      const response = await fetch('/api/process-enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          wordIds: selectedWords
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

      // Process the stream
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
              } else if (data.type === 'chunk_complete') {
                if (data.data.stats) {
                  setSession(prev => prev ? {
                    ...prev,
                    stats: data.data.stats
                  } : null)
                }
                setProcessedCount(data.data.processedWords)
              } else if (data.type === 'complete') {
                setIsProcessing(false)
                setProcessedCount(data.processedWords)
                // Refresh database status to show updated words
                await loadDatabaseStatus()
                await loadWords()
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
    } catch (error) {
      console.error('Streaming error:', error)
      setError('Failed to process words')
      setIsProcessing(false)
    }
  }

  const handlePauseProcessing = async () => {
    if (session) {
      try {
        await fetch(`/api/processing-sessions/${session.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'pause' })
        })
        setIsPaused(true)
        setIsProcessing(false)
      } catch (error) {
        console.error('Error pausing session:', error)
      }
    }
  }

  const handleStopProcessing = async () => {
    if (session) {
      try {
        await fetch(`/api/processing-sessions/${session.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'cancel' })
        })
        setIsProcessing(false)
        setIsPaused(false)
      } catch (error) {
        console.error('Error stopping session:', error)
      }
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
    setConfig(prev => ({
      ...prev,
      langPrompt: newLangPrompt,
      catPrompt: newCatPrompt
    }))
  }

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`
  }

  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(4)}`
  }

  const getProgressPercentage = (): number => {
    if (!session?.stats.totalWords) return 0
    return (session.stats.processedWords / session.stats.totalWords) * 100
  }

  const getSuccessRate = (): number => {
    if (!session?.stats.processedWords) return 0
    return (session.stats.successfulWords / session.stats.processedWords) * 100
  }

  const canStartProcessing = databaseStatus && databaseStatus.categories > 0 && databaseStatus.words > 0 && !isProcessing && selectedWords.length > 0

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
                    Choose words and configure processing settings
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

              {/* Word Selection */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium">Words to Process ({selectedWords.length} selected)</h3>
                  <button
                    onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
                    className="btn btn-ghost text-xs"
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    {showAdvancedConfig ? 'Hide' : 'Show'} Advanced
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const unprocessed = allWords.filter(w => !w.languageId || !w.category)
                      setSelectedWords(unprocessed.map(w => w.id))
                    }}
                    className="btn btn-outline btn-sm"
                  >
                    Select Unprocessed ({allWords.filter(w => !w.languageId || !w.category).length})
                  </button>
                  <button
                    onClick={() => setSelectedWords(allWords.map(w => w.id))}
                    className="btn btn-outline btn-sm"
                  >
                    Select All ({allWords.length})
                  </button>
                  <button
                    onClick={() => setSelectedWords([])}
                    className="btn btn-outline btn-sm"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>

              {/* Advanced Configuration */}
              {showAdvancedConfig && (
                <div className="mb-6 p-4 border rounded-md bg-zinc-50 dark:bg-zinc-900/50">
                  <h3 className="text-sm font-medium mb-4">Advanced Configuration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">Processing Mode</label>
                      <select
                        value={config.mode}
                        onChange={(e) => setConfig(prev => ({ ...prev, mode: e.target.value as ProcessingMode }))}
                        className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800"
                      >
                        <option value="batch">Sequential (Batch)</option>
                        <option value="parallel">Parallel</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">AI Model</label>
                      <select
                        value={config.model}
                        onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800"
                      >
                        <option value="gpt-4o-mini">GPT-4O Mini (Recommended)</option>
                        <option value="gpt-4o">GPT-4O</option>
                        <option value="gpt-4">GPT-4</option>
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">Chunk Size</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={config.chunkSize}
                        onChange={(e) => setConfig(prev => ({ ...prev, chunkSize: parseInt(e.target.value) || 10 }))}
                        className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800"
                      />
                      <p className="text-xs text-zinc-500 mt-1">Number of words processed per chunk (1-50)</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">Max Retries</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={config.maxRetries}
                        onChange={(e) => setConfig(prev => ({ ...prev, maxRetries: parseInt(e.target.value) || 3 }))}
                        className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Processing Mode Selection */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  onClick={() => setConfig(prev => ({ ...prev, mode: 'batch' }))}
                  className={`relative p-4 rounded-md border transition-all ${
                    config.mode === 'batch'
                      ? 'border-zinc-900 dark:border-white bg-zinc-50 dark:bg-zinc-900'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <Layers className="h-5 w-5 mb-2 text-zinc-700 dark:text-zinc-300" />
                  <h3 className="text-sm font-medium mb-1">Batch</h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    Sequential processing
                  </p>
                  {config.mode === 'batch' && (
                    <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-zinc-900 dark:bg-white" />
                  )}
                </button>
                <button
                  onClick={() => setConfig(prev => ({ ...prev, mode: 'parallel' }))}
                  className={`relative p-4 rounded-md border transition-all ${
                    config.mode === 'parallel'
                      ? 'border-zinc-900 dark:border-white bg-zinc-50 dark:bg-zinc-900'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <Zap className="h-5 w-5 mb-2 text-zinc-700 dark:text-zinc-300" />
                  <h3 className="text-sm font-medium mb-1">Parallel</h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    Faster batch processing
                  </p>
                  {config.mode === 'parallel' && (
                    <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-zinc-900 dark:bg-white" />
                  )}
                </button>
              </div>

              {/* Processing Controls */}
              <div className="flex gap-2 mb-4">
                {!isProcessing && !isPaused && (
                  <button
                    onClick={handleStartProcessing}
                    disabled={!canStartProcessing}
                    className="btn btn-primary flex-1"
                  >
                    <Play className="h-3 w-3 mr-1.5" />
                    Start Processing
                  </button>
                )}

                {isProcessing && (
                  <button
                    onClick={handlePauseProcessing}
                    className="btn btn-secondary flex-1"
                  >
                    <Pause className="h-3 w-3 mr-1.5" />
                    Pause
                  </button>
                )}

                {(isProcessing || isPaused) && (
                  <button
                    onClick={handleStopProcessing}
                    className="btn btn-outline"
                  >
                    <Square className="h-3 w-3 mr-1.5" />
                    Stop
                  </button>
                )}
              </div>

              {/* Enhanced Progress Display */}
              {session && (
                <div className="mb-4 p-4 border rounded-md bg-zinc-50 dark:bg-zinc-900/50">
                  <div className="space-y-4">
                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>{session.stats.processedWords} / {session.stats.totalWords} words</span>
                      </div>
                      <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500 ease-out"
                          style={{ width: `${getProgressPercentage()}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
                        <span>Chunk {session.stats.currentChunk} / {session.stats.totalChunks}</span>
                        <span>{getProgressPercentage().toFixed(1)}% complete</span>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <div>
                          <div className="text-sm font-medium">{session.stats.successfulWords}</div>
                          <div className="text-xs text-zinc-500">Successful</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <div>
                          <div className="text-sm font-medium">{session.stats.failedWords}</div>
                          <div className="text-xs text-zinc-500">Failed</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <div>
                          <div className="text-sm font-medium">
                            {formatTime(session.stats.estimatedTimeRemaining)}
                          </div>
                          <div className="text-xs text-zinc-500">ETA</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <div>
                          <div className="text-sm font-medium">{formatCost(session.stats.totalCost)}</div>
                          <div className="text-xs text-zinc-500">Cost</div>
                        </div>
                      </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-zinc-500">Success Rate:</span>
                        <span className={`ml-2 font-medium ${getSuccessRate() > 90 ? 'text-green-600' : 'text-zinc-700 dark:text-zinc-300'}`}>
                          {getSuccessRate().toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Processing Rate:</span>
                        <span className="ml-2 font-medium">
                          {session.stats.processingRate.toFixed(1)} words/min
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Simple Progress Display (fallback) */}
              {isProcessing && !session && (
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400 mb-2">
                    <span>
                      {config.mode === 'parallel' ? 'Parallel' : 'Sequential'} processing
                      {processedCount > 0 && ` • ${processedCount}/${totalWords} words`}
                    </span>
                    <span>{Math.round((processedCount / totalWords) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500 ease-out"
                      style={{ width: `${(processedCount / totalWords) * 100}%` }}
                    />
                  </div>
                  {processedCount > 0 && (
                    <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      Processing in real-time • Results appear below as they complete
                    </div>
                  )}
                </div>
              )}

              {/* Results Summary */}
              {!isProcessing && processedCount > 0 && (
                <div className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/50">
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