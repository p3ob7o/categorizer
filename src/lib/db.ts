import { PrismaClient } from '@prisma/client'

// Global variable to hold the Prisma client instance
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Function to optimize database URL for serverless environments
const optimizeDatabaseUrl = (url: string): string => {
  if (!url) return url
  
  // Parse the URL to add connection pooling parameters
  const urlObj = new URL(url)
  
  // Add connection pooling parameters for serverless environments
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    // Set connection pool parameters for serverless
    urlObj.searchParams.set('connection_limit', '5')
    urlObj.searchParams.set('pool_timeout', '10')
    urlObj.searchParams.set('connect_timeout', '10')
    urlObj.searchParams.set('sslmode', 'require')
  }
  
  return urlObj.toString()
}

// Create a function to initialize Prisma with proper configuration for serverless
const createPrismaClient = () => {
  const databaseUrl = optimizeDatabaseUrl(process.env.DATABASE_URL || '')
  
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })
}

// Singleton pattern - reuse the same client instance
export const prisma = globalForPrisma.prisma ?? createPrismaClient()

// In development, store the client globally to avoid creating multiple instances
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Connection management for serverless environments
let isConnected = false
let connectionPromise: Promise<void> | null = null

// Function to ensure connection is established
export const ensureConnection = async (): Promise<void> => {
  if (isConnected) return
  
  if (connectionPromise) {
    return connectionPromise
  }
  
  connectionPromise = (async () => {
    try {
      await prisma.$connect()
      isConnected = true
      console.log('Database connected successfully')
    } catch (error) {
      console.error('Failed to connect to database:', error)
      connectionPromise = null
      throw error
    }
  })()
  
  return connectionPromise
}

// Function to safely disconnect
export const safeDisconnect = async (): Promise<void> => {
  if (!isConnected) return
  
  try {
    await prisma.$disconnect()
    isConnected = false
    connectionPromise = null
    console.log('Database disconnected successfully')
  } catch (error) {
    console.error('Error disconnecting from database:', error)
  }
}

// For Vercel serverless functions, we need to handle connections properly
if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
  // Set up graceful shutdown handlers
  const gracefulShutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`)
    await safeDisconnect()
    process.exit(0)
  }
  
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('beforeExit', async () => {
    await safeDisconnect()
  })
}

// Enhanced retry logic with exponential backoff and connection management
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> => {
  // Ensure connection before attempting operation
  await ensureConnection()
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error: any) {
      console.error(`Database operation failed (attempt ${attempt}/${maxRetries}):`, error.message)
      
      if (attempt === maxRetries) {
        throw error
      }
      
      // Check if it's a connection error that we should retry
      const isRetryableError = 
        error.code === 'P1001' || // Connection error
        error.code === 'P1002' || // Connection timeout
        error.code === 'P1008' || // Operations timed out
        error.code === 'P1017' || // Server has closed the connection
        error.code === 'P2037' || // Too many database connections
        error.message?.includes('too many connections') ||
        error.message?.includes('connection') ||
        error.message?.includes('timeout') ||
        error.message?.includes('ECONNRESET') ||
        error.message?.includes('ETIMEDOUT')
      
      if (isRetryableError) {
        console.log(`Retrying in ${delayMs}ms... (attempt ${attempt + 1}/${maxRetries})`)
        
        // Reset connection state on connection errors
        if (error.code === 'P2037' || error.message?.includes('too many connections')) {
          isConnected = false
          connectionPromise = null
          // Force disconnect and reconnect
          try {
            await prisma.$disconnect()
          } catch (disconnectError) {
            console.error('Error during forced disconnect:', disconnectError)
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, delayMs))
        delayMs *= 2 // Exponential backoff
        
        // Ensure connection is re-established
        await ensureConnection()
      } else {
        throw error // Don't retry for other types of errors
      }
    }
  }
  
  throw new Error('Max retries exceeded')
}

// Helper function for database operations with automatic connection management
export const withConnection = async <T>(
  operation: () => Promise<T>
): Promise<T> => {
  return withRetry(operation)
}

// Connection health check
export const checkConnection = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error('Connection health check failed:', error)
    return false
  }
}

// Cleanup function for API routes
export const cleanupConnection = async (): Promise<void> => {
  // For serverless environments, we want to disconnect after each request
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    await safeDisconnect()
  }
}

// Wrapper function for API routes with automatic connection management
export const withApiConnection = <T extends any[], R>(
  handler: (...args: T) => Promise<R>
) => {
  return async (...args: T): Promise<R> => {
    try {
      const result = await handler(...args)
      return result
    } finally {
      await cleanupConnection()
    }
  }
}

// Function to clean up duplicate words
export const cleanupDuplicateWords = async (): Promise<void> => {
  try {
    console.log('Starting duplicate word cleanup...')
    
    // Find duplicate words (same word and languageId)
    const duplicates = await prisma.$queryRaw<Array<{
      word: string
      languageId: number | null
      count: number
    }>>`
      SELECT word, "languageId", COUNT(*) as count
      FROM "Word"
      GROUP BY word, "languageId"
      HAVING COUNT(*) > 1
    `
    
    console.log(`Found ${duplicates.length} sets of duplicate words`)
    
    for (const duplicate of duplicates) {
      // Get all words with the same word and languageId
      const words = await prisma.word.findMany({
        where: {
          word: duplicate.word,
          languageId: duplicate.languageId
        },
        orderBy: { createdAt: 'asc' } // Keep the oldest one
      })
      
      if (words.length > 1) {
        // Keep the first (oldest) word and delete the rest
        const [keepWord, ...deleteWords] = words
        
        console.log(`Keeping word "${keepWord.word}" (ID: ${keepWord.id}), deleting ${deleteWords.length} duplicates`)
        
        // Update the kept word with the latest information from duplicates
        const latestWord = words[words.length - 1]
        if (latestWord.englishTranslation || latestWord.category) {
          await prisma.word.update({
            where: { id: keepWord.id },
            data: {
              englishTranslation: latestWord.englishTranslation || keepWord.englishTranslation,
              category: latestWord.category || keepWord.category
            }
          })
        }
        
        // Delete the duplicate words
        await prisma.word.deleteMany({
          where: {
            id: {
              in: deleteWords.map(w => w.id)
            }
          }
        })
      }
    }
    
    console.log('Duplicate word cleanup completed')
  } catch (error) {
    console.error('Error during duplicate cleanup:', error)
    throw error
  }
}

// Normalized language matching utility
export const findMatchingLanguage = (
  detectedLanguage: string,
  availableLanguages: Array<{ id: number; name: string; code?: string | null }>
): { id: number; name: string; code?: string | null } | null => {
  if (!detectedLanguage) return null
  
  const normalizedDetected = detectedLanguage.toLowerCase().trim()
  
  // Direct name match (highest priority)
  for (const lang of availableLanguages) {
    if (lang.name.toLowerCase() === normalizedDetected) {
      return lang
    }
  }
  
  // Language code match
  for (const lang of availableLanguages) {
    if (lang.code && lang.code.toLowerCase() === normalizedDetected) {
      return lang
    }
  }
  
  // Common language variations and aliases
  const languageAliases: Record<string, string[]> = {
    'english': ['en', 'eng', 'english'],
    'spanish': ['es', 'esp', 'spanish', 'español'],
    'french': ['fr', 'fra', 'french', 'français'],
    'german': ['de', 'deu', 'german', 'deutsch'],
    'italian': ['it', 'ita', 'italian', 'italiano'],
    'portuguese': ['pt', 'por', 'portuguese', 'português'],
    'dutch': ['nl', 'nld', 'dutch', 'nederlands'],
    'russian': ['ru', 'rus', 'russian', 'русский'],
    'chinese': ['zh', 'chi', 'chinese', 'mandarin', '中文'],
    'japanese': ['ja', 'jpn', 'japanese', '日本語'],
    'korean': ['ko', 'kor', 'korean', '한국어'],
    'arabic': ['ar', 'ara', 'arabic', 'العربية'],
    'hindi': ['hi', 'hin', 'hindi', 'हिन्दी'],
  }
  
  // Check aliases
  for (const lang of availableLanguages) {
    const langKey = lang.name.toLowerCase()
    const aliases = languageAliases[langKey] || []
    
    if (aliases.includes(normalizedDetected)) {
      return lang
    }
  }
  
  // Partial match (starts with)
  for (const lang of availableLanguages) {
    if (lang.name.toLowerCase().startsWith(normalizedDetected) || 
        normalizedDetected.startsWith(lang.name.toLowerCase())) {
      return lang
    }
  }
  
  return null
}

// Normalized category matching utility
export const findMatchingCategory = (
  detectedCategory: string,
  availableCategories: Array<{ id: number; name: string }>
): { id: number; name: string } | null => {
  if (!detectedCategory) return null
  
  const normalizedDetected = detectedCategory.toLowerCase().trim()
  
  // Direct match
  for (const cat of availableCategories) {
    if (cat.name.toLowerCase() === normalizedDetected) {
      return cat
    }
  }
  
  // Partial match
  for (const cat of availableCategories) {
    if (cat.name.toLowerCase().includes(normalizedDetected) ||
        normalizedDetected.includes(cat.name.toLowerCase())) {
      return cat
    }
  }
  
  return null
}

// Cache for frequently accessed data
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

const cache = new Map<string, CacheEntry<any>>()

// Cache TTL in milliseconds (5 minutes)
const DEFAULT_CACHE_TTL = 5 * 60 * 1000

// Cache utilities
export const getCachedData = <T>(key: string): T | null => {
  const entry = cache.get(key)
  if (!entry) return null
  
  if (Date.now() - entry.timestamp > entry.ttl) {
    cache.delete(key)
    return null
  }
  
  return entry.data
}

export const setCachedData = <T>(key: string, data: T, ttl: number = DEFAULT_CACHE_TTL): void => {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl
  })
}

export const clearCache = (pattern?: string): void => {
  if (pattern) {
    for (const key of cache.keys()) {
      if (key.includes(pattern)) {
        cache.delete(key)
      }
    }
  } else {
    cache.clear()
  }
}

// Cached database queries
export const getCachedCategories = async () => {
  const cached = getCachedData<any[]>('categories')
  if (cached) return cached
  
  const categories = await withConnection(async () => {
    return prisma.category.findMany({ orderBy: { name: 'asc' } })
  })
  
  setCachedData('categories', categories)
  return categories
}

export const getCachedLanguages = async () => {
  const cached = getCachedData<any[]>('languages')
  if (cached) return cached
  
  const languages = await withConnection(async () => {
    return prisma.language.findMany({ orderBy: [{ priority: 'asc' }, { name: 'asc' }] })
  })
  
  setCachedData('languages', languages)
  return languages
}

// Batch database operations
export const batchUpdateWords = async (updates: Array<{ id: number; data: any }>) => {
  return withConnection(async () => {
    const promises = updates.map(update => 
      prisma.word.update({
        where: { id: update.id },
        data: update.data
      })
    )
    return Promise.all(promises)
  })
}

// Safe upsert operation for words to handle duplicates
export const upsertWord = async (
  wordText: string,
  languageId: number | null,
  englishTranslation: string,
  category: string | null
) => {
  return withConnection(async () => {
    return prisma.$transaction(async (tx) => {
      // Try to find existing word first
      const existingWord = await tx.word.findFirst({
        where: {
          word: wordText,
          languageId: languageId
        }
      })

      if (existingWord) {
        // Update existing word
        return tx.word.update({
          where: { id: existingWord.id },
          data: {
            englishTranslation,
            category
          },
          include: { language: true }
        })
      } else {
        // Create new word
        return tx.word.create({
          data: {
            word: wordText,
            languageId,
            englishTranslation,
            category
          },
          include: { language: true }
        })
      }
    })
  })
}

// Batch upsert for better performance
export const batchUpsertWords = async (
  updates: Array<{
    word: string
    languageId: number | null
    englishTranslation: string
    category: string | null
  }>
) => {
  return withConnection(async () => {
    return prisma.$transaction(async (tx) => {
      const results = []
      
      for (const update of updates) {
        const existingWord = await tx.word.findFirst({
          where: {
            word: update.word,
            languageId: update.languageId
          }
        })

        if (existingWord) {
          const updated = await tx.word.update({
            where: { id: existingWord.id },
            data: {
              englishTranslation: update.englishTranslation,
              category: update.category
            },
            include: { language: true }
          })
          results.push(updated)
        } else {
          const created = await tx.word.create({
            data: update,
            include: { language: true }
          })
          results.push(created)
        }
      }
      
      return results
    })
  })
}

 