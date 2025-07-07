'use client'

import React from 'react'
import { ProcessingResult } from '@/types'
import { Check, X, Globe, Languages } from 'lucide-react'

interface ResultsFeedProps {
  results: ProcessingResult[]
}

export default function ResultsFeed({ results }: ResultsFeedProps) {
  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500 dark:text-zinc-400 text-sm">
        No results yet
      </div>
    )
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
      {results.map((result, index) => (
        <div
          key={index}
          className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm truncate">
                  {result.originalWord}
                </span>
                {result.englishTranslation !== result.originalWord && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    → {result.englishTranslation}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
                  <Globe className="h-3 w-3" />
                  <span>{result.language}</span>
                </div>
                {result.category ? (
                  <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                    <Check className="h-3 w-3" />
                    <span>{result.category}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-zinc-500 dark:text-zinc-500">
                    <X className="h-3 w-3" />
                    <span>Uncategorized</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
} 