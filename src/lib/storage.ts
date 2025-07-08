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