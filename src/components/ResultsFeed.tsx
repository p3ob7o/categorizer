'use client'

import { ProcessingStatus } from '@/types'

interface ResultsFeedProps {
  status: ProcessingStatus
  words: string[]
}

const ResultsFeed = ({ status, words }: ResultsFeedProps) => {
  const { results, processedWords, totalWords } = status
  
  // Get the last 10 results
  const lastResults = results.slice(-10)
  
  // Get the next 4 upcoming words
  const upcomingWords = words.slice(processedWords, processedWords + 4)
  
  // Calculate which results to show (last 5 visible, next 4 upcoming)
  const visibleResults = lastResults.slice(-5)
  const previousResults = lastResults.slice(0, -5)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Results Feed
      </h2>
      
      <div className="space-y-2">
        {/* Previous results (collapsed) */}
        {previousResults.length > 0 && (
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-2 border-b border-gray-100 dark:border-gray-700">
            +{previousResults.length} previous results
          </div>
        )}
        
        {/* Visible results */}
        {visibleResults.map((result, index) => (
          <div 
            key={`${result.originalWord}-${index}`}
            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-4 border-green-500"
          >
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <span className="font-medium text-gray-900 dark:text-white">{result.originalWord}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">({result.language})</span>
                {result.englishTranslation !== result.originalWord && (
                  <span className="text-sm text-blue-600 dark:text-blue-400">→ {result.englishTranslation}</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {result.category || 'No category'}
              </span>
            </div>
          </div>
        ))}
        
        {/* Current word being processed */}
        {status.currentWord && (
          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500 animate-pulse">
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <span className="font-medium text-blue-900 dark:text-blue-100">{status.currentWord}</span>
                <span className="text-sm text-blue-600 dark:text-blue-400">Processing...</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm text-blue-600 dark:text-blue-400">⏳</span>
            </div>
          </div>
        )}
        
        {/* Upcoming words */}
        {upcomingWords.map((word, index) => (
          <div 
            key={`upcoming-${word}-${index}`}
            className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-600 rounded-lg border-l-4 border-gray-300 dark:border-gray-500 opacity-60"
          >
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <span className="font-medium text-gray-600 dark:text-gray-300">{word}</span>
                <span className="text-sm text-gray-400 dark:text-gray-500">Pending</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm text-gray-400 dark:text-gray-500">⏸️</span>
            </div>
          </div>
        ))}
        
        {/* Progress summary */}
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
          {processedWords} of {totalWords} words processed
        </div>
      </div>
    </div>
  )
}

export default ResultsFeed 