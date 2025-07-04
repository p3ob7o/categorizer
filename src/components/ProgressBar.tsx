'use client'

import { ProcessingStatus } from '@/types'

interface ProgressBarProps {
  status: ProcessingStatus
}

const ProgressBar = ({ status }: ProgressBarProps) => {
  const progress = status.totalWords > 0 ? (status.processedWords / status.totalWords) * 100 : 0

  return (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mb-4">
      <div 
        className="bg-blue-600 h-4 rounded-full transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

export default ProgressBar 