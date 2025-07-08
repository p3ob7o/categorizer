export interface ProcessingStatus {
  totalWords: number
  processedWords: number
  currentWord: string
  isProcessing: boolean
  error?: string
  results: ProcessedWord[]
}

export interface ProcessedWord {
  originalWord: string
  language: string
  englishTranslation: string
  category: string
}

export interface Language {
  id: number
  name: string
  code: string | null
  priority: number
  createdAt: string
  updatedAt: string
}



export interface ProcessingResult {
  originalWord: string
  language: string
  englishTranslation: string
  category: string
} 