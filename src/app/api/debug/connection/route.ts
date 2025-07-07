import { NextRequest, NextResponse } from 'next/server'
import { checkConnection, withConnection, prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now()
    
    // Test basic connection
    const isHealthy = await checkConnection()
    
    if (!isHealthy) {
      return NextResponse.json({ 
        error: 'Database connection failed',
        healthy: false 
      }, { status: 500 })
    }
    
    // Test with connection management
    const stats = await withConnection(async () => {
      const [wordCount, languageCount, categoryCount] = await Promise.all([
        prisma.word.count(),
        prisma.language.count(),
        prisma.category.count()
      ])
      
      return {
        words: wordCount,
        languages: languageCount,
        categories: categoryCount
      }
    })
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    return NextResponse.json({
      healthy: true,
      duration: `${duration}ms`,
      stats,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      vercel: !!process.env.VERCEL
    })
  } catch (error) {
    console.error('Connection test error:', error)
    return NextResponse.json({ 
      error: 'Connection test failed',
      healthy: false,
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 