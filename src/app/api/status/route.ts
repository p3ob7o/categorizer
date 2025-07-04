import { NextRequest, NextResponse } from 'next/server'
import { loadFilesStatus, loadProgress } from '@/lib/storage'

export async function GET() {
  try {
    const filesStatus = loadFilesStatus()
    const progress = loadProgress()

    return NextResponse.json({ 
      filesStatus, 
      progress 
    })
  } catch (error) {
    console.error('Status error:', error)
    return NextResponse.json({ error: 'Failed to load status' }, { status: 500 })
  }
} 