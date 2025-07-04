'use client'

import { useState, useEffect } from 'react'
import { X, Save, RotateCcw } from 'lucide-react'

interface PromptModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (langPrompt: string, catPrompt: string) => void
  currentLangPrompt: string
  currentCatPrompt: string
  defaultLangPrompt: string
  defaultCatPrompt: string
}

export const PromptModal = ({
  isOpen,
  onClose,
  onSave,
  currentLangPrompt,
  currentCatPrompt,
  defaultLangPrompt,
  defaultCatPrompt
}: PromptModalProps) => {
  const [langPrompt, setLangPrompt] = useState(currentLangPrompt)
  const [catPrompt, setCatPrompt] = useState(currentCatPrompt)

  useEffect(() => {
    if (isOpen) {
      setLangPrompt(currentLangPrompt)
      setCatPrompt(currentCatPrompt)
    }
  }, [isOpen, currentLangPrompt, currentCatPrompt])

  const handleSave = () => {
    onSave(langPrompt, catPrompt)
    onClose()
  }

  const handleReset = () => {
    setLangPrompt(defaultLangPrompt)
    setCatPrompt(defaultCatPrompt)
  }

  const handleCancel = () => {
    setLangPrompt(currentLangPrompt)
    setCatPrompt(currentCatPrompt)
    onClose()
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      handleCancel()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Edit Prompts
          </h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-6">
            {/* Language/Translation Prompt */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Language Detection & Translation Prompt
              </label>
              <textarea
                value={langPrompt}
                onChange={(e) => setLangPrompt(e.target.value)}
                className="w-full h-48 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your language detection prompt..."
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Use {'{languages}'} to insert the list of languages
              </p>
            </div>

            {/* Categorization Prompt */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Categorization Prompt
              </label>
              <textarea
                value={catPrompt}
                onChange={(e) => setCatPrompt(e.target.value)}
                className="w-full h-32 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your categorization prompt..."
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Use {'{categories}'} to insert the list of categories
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={handleReset}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </button>
          
          <div className="flex space-x-3">
            <button
              onClick={handleCancel}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 