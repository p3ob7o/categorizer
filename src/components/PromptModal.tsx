'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

interface PromptModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (langPrompt: string, catPrompt: string) => void
  currentLangPrompt: string
  currentCatPrompt: string
  defaultLangPrompt: string
  defaultCatPrompt: string
}

export function PromptModal({
  isOpen,
  onClose,
  onSave,
  currentLangPrompt,
  currentCatPrompt,
  defaultLangPrompt,
  defaultCatPrompt,
}: PromptModalProps) {
  const [langPrompt, setLangPrompt] = useState(currentLangPrompt)
  const [catPrompt, setCatPrompt] = useState(currentCatPrompt)

  useEffect(() => {
    if (isOpen) {
      setLangPrompt(currentLangPrompt)
      setCatPrompt(currentCatPrompt)
    }
  }, [isOpen, currentLangPrompt, currentCatPrompt])

  if (!isOpen) return null

  const handleSave = () => {
    onSave(langPrompt, catPrompt)
    onClose()
  }

  const handleReset = () => {
    setLangPrompt(defaultLangPrompt)
    setCatPrompt(defaultCatPrompt)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in">
      <div className="w-full max-w-2xl mx-4 bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">AI Prompts</h2>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-md flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Language Detection Prompt */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Language Detection Prompt
            </label>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3">
              This prompt determines how the AI detects languages and translates words.
            </p>
            <textarea
              value={langPrompt}
              onChange={(e) => setLangPrompt(e.target.value)}
              rows={6}
              className="w-full p-3 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-300 resize-none"
              placeholder="Enter language detection prompt..."
            />
          </div>

          {/* Categorization Prompt */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Categorization Prompt
            </label>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3">
              This prompt determines how the AI categorizes words into your defined categories.
            </p>
            <textarea
              value={catPrompt}
              onChange={(e) => setCatPrompt(e.target.value)}
              rows={6}
              className="w-full p-3 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-300 resize-none"
              placeholder="Enter categorization prompt..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={handleReset}
            className="btn btn-ghost"
          >
            Reset to Defaults
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="btn btn-primary"
            >
              Save Prompts
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 