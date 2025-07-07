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

 