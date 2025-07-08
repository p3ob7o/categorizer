import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')

// Ensure directories exist
const ensureDirectories = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

export const exportToCSV = (results: any[]): string => {
  ensureDirectories()
  
  const headers = ['Original Word', 'Language', 'English Translation', 'Category']
  const csvContent = [
    headers.join(','),
    ...results.map(result => [
      `"${(result.originalWord || '').replace(/"/g, '""')}"`,
      `"${(result.language || '').replace(/"/g, '""')}"`,
      `"${(result.englishTranslation || '').replace(/"/g, '""')}"`,
      `"${(result.category || '').replace(/"/g, '""')}"`
    ].join(','))
  ].join('\n')
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
  const csvPath = path.join(DATA_DIR, `categorized-words-${timestamp}.csv`)
  fs.writeFileSync(csvPath, csvContent)
  return csvPath
} 