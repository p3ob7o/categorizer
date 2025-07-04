import fs from 'fs'
import path from 'path'
import { ProcessingStatus, UploadedFiles } from '@/types'

const DATA_DIR = path.join(process.cwd(), 'data')
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')
const PROGRESS_FILE = path.join(DATA_DIR, 'progress.json')
const FILES_STATUS_FILE = path.join(DATA_DIR, 'files-status.json')

// Ensure directories exist
const ensureDirectories = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  }
}

export const saveUploadedFile = (filename: string, content: string): void => {
  ensureDirectories()
  const filePath = path.join(UPLOADS_DIR, filename)
  fs.writeFileSync(filePath, content)
}

export const getUploadedFile = (filename: string): string => {
  const filePath = path.join(UPLOADS_DIR, filename)
  if (!fs.existsSync(filePath)) {
    throw new Error(`File ${filename} not found`)
  }
  return fs.readFileSync(filePath, 'utf-8')
}

export const saveProgress = (status: ProcessingStatus): void => {
  ensureDirectories()
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(status, null, 2))
}

export const loadProgress = (): ProcessingStatus | null => {
  if (!fs.existsSync(PROGRESS_FILE)) {
    return null
  }
  try {
    const content = fs.readFileSync(PROGRESS_FILE, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error('Error loading progress:', error)
    return null
  }
}

export const saveFilesStatus = (files: UploadedFiles): void => {
  ensureDirectories()
  fs.writeFileSync(FILES_STATUS_FILE, JSON.stringify(files, null, 2))
}

export const loadFilesStatus = (): UploadedFiles | null => {
  if (!fs.existsSync(FILES_STATUS_FILE)) {
    return null
  }
  try {
    const content = fs.readFileSync(FILES_STATUS_FILE, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error('Error loading files status:', error)
    return null
  }
}

export const clearProgress = (): void => {
  if (fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE)
  }
}

export const clearFilesStatus = (): void => {
  if (fs.existsSync(FILES_STATUS_FILE)) {
    fs.unlinkSync(FILES_STATUS_FILE)
  }
}

export const exportToCSV = (results: any[]): string => {
  const headers = ['Original Word', 'Language', 'English Translation', 'Category']
  const csvContent = [
    headers.join(','),
    ...results.map(result => [
      `"${result.originalWord}"`,
      `"${result.language}"`,
      `"${result.englishTranslation}"`,
      `"${result.category}"`
    ].join(','))
  ].join('\n')
  
  const csvPath = path.join(DATA_DIR, `results-${Date.now()}.csv`)
  fs.writeFileSync(csvPath, csvContent)
  return csvPath
} 