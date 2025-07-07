import { NextRequest, NextResponse } from 'next/server'
import { cleanupDuplicateWords, withConnection } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    // Only allow this in development or with a secret key
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')
    
    if (process.env.NODE_ENV === 'production' && secret !== process.env.CLEANUP_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    await withConnection(async () => {
      await cleanupDuplicateWords()
    })
    
    return NextResponse.json({ 
      success: true, 
      message: 'Duplicate words cleaned up successfully' 
    })
  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json({ 
      error: 'Cleanup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 