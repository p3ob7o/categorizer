'use client'

import { useEffect, useRef } from 'react'
import { ProcessingResult } from '@/types'
import { CheckCircle, XCircle, Clock, Globe, Tag } from 'lucide-react'

interface RealTimeResultsFeedProps {
  results: ProcessingResult[]
  isProcessing: boolean
  processedCount: number
  totalWords: number
}

export default function RealTimeResultsFeed({ 
  results, 
  isProcessing, 
  processedCount, 
  totalWords 
}: RealTimeResultsFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new results arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [results.length])

  const getStatusIcon = (result: ProcessingResult) => {
    if (result.language === 'Error') {
      return <XCircle className="h-4 w-4 text-red-500" />
    }
    return <CheckCircle className="h-4 w-4 text-emerald-500" />
  }

  const getLanguageColor = (language: string) => {
    if (language === 'Error') return 'text-red-600 dark:text-red-400'
    if (language === 'English') return 'text-blue-600 dark:text-blue-400'
    return 'text-zinc-600 dark:text-zinc-400'
  }

  const getCategoryColor = (category: string) => {
    if (!category) return 'text-zinc-400 dark:text-zinc-500'
    return 'text-purple-600 dark:text-purple-400'
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">Processing Results</h2>
        <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          {isProcessing && <Clock className="h-3 w-3 animate-pulse" />}
          <span>
            {processedCount} of {totalWords} processed
          </span>
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {results.length === 0 && !isProcessing && (
          <div className="text-center py-8">
            <p className="text-zinc-500 text-sm">No results yet</p>
          </div>
        )}

        {results.map((result, index) => (
          <div
            key={index}
            className="flex items-center gap-3 p-3 rounded-md bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800"
          >
            <div className="flex-shrink-0">
              {getStatusIcon(result)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm truncate">
                  {result.originalWord}
                </span>
                {result.originalWord !== result.englishTranslation && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    → {result.englishTranslation}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  <span className={getLanguageColor(result.language)}>
                    {result.language}
                  </span>
                </div>
                
                <div className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  <span className={getCategoryColor(result.category)}>
                    {result.category || 'No category'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {isProcessing && (
          <div className="flex items-center gap-3 p-3 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <div className="flex-shrink-0">
              <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="flex-1">
              <span className="text-sm text-blue-600 dark:text-blue-400">
                Processing...
              </span>
            </div>
          </div>
        )}
        
        <div ref={bottomRef} />
      </div>

      {results.length > 0 && (
        <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
            <span>
              {results.filter(r => r.language !== 'Error').length} successful, {' '}
              {results.filter(r => r.language === 'Error').length} errors
            </span>
            <span>
              {Math.round((processedCount / totalWords) * 100)}% complete
            </span>
          </div>
        </div>
      )}
    </div>
  )
} 