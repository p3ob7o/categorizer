'use client'

import { useState, useEffect } from 'react'
import FileUpload from '@/components/FileUpload'
import ProgressBar from '@/components/ProgressBar'
import ResultsFeed from '@/components/ResultsFeed'
import { PromptModal } from '@/components/PromptModal'
import { ProcessingStatus, UploadedFiles } from '@/types'
import { Play, Download, RefreshCw, CheckCircle, AlertCircle, Settings } from 'lucide-react'

const DEFAULT_MODEL = 'gpt-4o-mini'
const DEFAULT_LANG_PROMPT = `You are a language detection and translation expert. Given a word and a list of languages, determine:\n1. The primary language of the word (if it exists in English, that's always primary)\n2. If the word is not in English, provide an English translation\n3. If the word exists in multiple languages from the list, choose the first one in the order provided\n\nLanguages to consider: English, {languages}\n\nRespond with JSON format:\n{\n  "language": "detected_language",\n  "englishTranslation": "english_translation_or_same_word_if_already_english"\n}`
const DEFAULT_CAT_PROMPT = `You are a categorization expert. Given a word and a list of categories, determine which category the word best fits into. Be fuzzy in your matching - if the word kind of belongs to a category, that's fine. If it doesn't fit any category well, return an empty string.\n\nAvailable categories: {categories}\n\nRespond with just the category name or an empty string if no good match.`

export default function Home() {
  const [filesStatus, setFilesStatus] = useState<UploadedFiles | null>(null)
  const [progress, setProgress] = useState<ProcessingStatus | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [langPrompt, setLangPrompt] = useState(DEFAULT_LANG_PROMPT)
  const [catPrompt, setCatPrompt] = useState(DEFAULT_CAT_PROMPT)
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false)

  // Load initial status
  useEffect(() => {
    loadStatus()
  }, [])

  // Poll for status updates when processing
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isProcessing) {
      interval = setInterval(loadStatus, 500) // Poll every 500ms for real-time updates
    }
    return () => clearInterval(interval)
  }, [isProcessing])

  const loadStatus = async () => {
    try {
      const response = await fetch('/api/status')
      const data = await response.json()
      
      if (data.filesStatus) {
        setFilesStatus(data.filesStatus)
      }
      
      if (data.progress) {
        setProgress(data.progress)
        setIsProcessing(data.progress.isProcessing)
      }
    } catch (error) {
      console.error('Failed to load status:', error)
    }
  }

  const handleFileUpload = async (fileType: string, content: string) => {
    try {
      setError(null)
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileType, content })
      })

      const data = await response.json()
      
      if (data.success) {
        setFilesStatus(data.status)
      } else {
        setError(data.error || 'Upload failed')
      }
    } catch (error) {
      setError('Upload failed')
    }
  }

  const handleStartProcessing = async () => {
    try {
      setError(null)
      setIsProcessing(true)
      
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          model: DEFAULT_MODEL,
          langPrompt,
          catPrompt
        })
      })

      const data = await response.json()
      
      if (!data.success) {
        setError(data.error || 'Failed to start processing')
        setIsProcessing(false)
      }
    } catch (error) {
      setError('Failed to start processing')
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

  const handleReset = async () => {
    try {
      setError(null)
      await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      })
      setProgress(null)
      setIsProcessing(false)
      setFilesStatus(null)
      await loadStatus()
    } catch (error) {
      setError('Reset failed')
    }
  }

  const handleSavePrompts = (newLangPrompt: string, newCatPrompt: string) => {
    setLangPrompt(newLangPrompt)
    setCatPrompt(newCatPrompt)
  }

  const canStartProcessing = filesStatus?.categories.length && filesStatus?.words.length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Domain Categorizer
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            AI-powered domain name categorization tool
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1">
            <FileUpload
              label="Categories"
              placeholder="Upload categories file (one per line)"
              onFileUpload={(content) => handleFileUpload('categories', content)}
              className="min-h-[180px] flex flex-col justify-between"
            />
            {filesStatus?.categories.length && (
              <div className="mt-2 text-sm text-green-600 dark:text-green-400 flex items-center">
                <CheckCircle className="h-4 w-4 mr-1" />
                {filesStatus.categories.length} categories loaded
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <FileUpload
              label="Languages (Optional)"
              placeholder="Upload languages file (one per line)"
              onFileUpload={(content) => handleFileUpload('languages', content)}
              className="min-h-[180px] flex flex-col justify-between"
            />
            {filesStatus?.languages.length && (
              <div className="mt-2 text-sm text-green-600 dark:text-green-400 flex items-center">
                <CheckCircle className="h-4 w-4 mr-1" />
                {filesStatus.languages.length} languages loaded
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <FileUpload
              label="Words"
              placeholder="Upload words file (one per line)"
              onFileUpload={(content) => handleFileUpload('words', content)}
              className="min-h-[180px] flex flex-col justify-between"
            />
            {filesStatus?.words.length && (
              <div className="mt-2 text-sm text-green-600 dark:text-green-400 flex items-center">
                <CheckCircle className="h-4 w-4 mr-1" />
                {filesStatus.words.length} words loaded
              </div>
            )}
          </div>
        </div>

        {canStartProcessing && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Processing
              </h2>
              <div className="flex space-x-2">
                {!isProcessing && progress?.results.length && (
                  <button
                    onClick={handleExportResults}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </button>
                )}
                {!isProcessing && (
                  <button
                    onClick={handleReset}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reset
                  </button>
                )}
                {!isProcessing && (
                  <button
                    onClick={() => setIsPromptModalOpen(true)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    aria-label="Edit prompts"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Edit Prompts
                  </button>
                )}
                {!isProcessing && (
                  <button
                    onClick={handleStartProcessing}
                    disabled={!canStartProcessing}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Start Processing
                  </button>
                )}
              </div>
            </div>

            {progress && (
              <div className="space-y-4">
                <ProgressBar status={progress} />
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>
                    Processed: {progress.processedWords} / {progress.totalWords}
                  </span>
                  <span>
                    {Math.round((progress.processedWords / progress.totalWords) * 100)}%
                  </span>
                </div>
                {progress.currentWord && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Currently processing: <span className="font-medium">{progress.currentWord}</span>
                  </div>
                )}
                {progress.error && (
                  <div className="text-sm text-red-600 dark:text-red-400">
                    Error: {progress.error}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {progress && filesStatus?.words && (
          <ResultsFeed status={progress} words={filesStatus.words} />
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