'use client'

import { useState, useRef } from 'react'
import { Upload, X } from 'lucide-react'

interface FileUploadProps {
  onFileUpload: (content: string) => void
  accept?: string
  placeholder?: string
  label: string
  className?: string
}

const FileUpload = ({ onFileUpload, accept = '.txt', placeholder = 'Upload a text file', label, className = '' }: FileUploadProps) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileRead = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      onFileUpload(content)
      setFileName(file.name)
    }
    reader.readAsText(file)
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'text/plain') {
      handleFileRead(file)
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)
    
    const file = event.dataTransfer.files[0]
    if (file && file.type === 'text/plain') {
      handleFileRead(file)
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleClick()
    }
  }

  const clearFile = () => {
    setFileName('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className={`w-full ${className}`}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label.split(' (one per line)')[0]}
      </label>
      
      {!fileName ? (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragOver 
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="button"
          aria-label={`Upload ${label.toLowerCase()} file`}
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {placeholder.includes(' (one per line)') ? (
              <span>
                {placeholder.split(' (one per line)')[0]}
                <br />
                <span className="text-xs text-gray-500 dark:text-gray-400">(one per line)</span>
              </span>
            ) : placeholder}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">Click to browse or drag and drop</p>
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      ) : (
        <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Upload className="h-5 w-5 text-green-500 mr-2" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{fileName}</span>
            </div>
            <button
              onClick={clearFile}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default FileUpload 