import { NextRequest, NextResponse } from 'next/server'
import { saveUploadedFile, saveFilesStatus } from '@/lib/storage'
import { UploadedFiles } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const { fileType, content } = await request.json()
    
    if (!fileType || !content) {
      return NextResponse.json({ error: 'Missing fileType or content' }, { status: 400 })
    }

    // Save the uploaded file
    const filename = `${fileType}-${Date.now()}.txt`
    saveUploadedFile(filename, content)

    // Parse content into lines
    const lines = content.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 0)

    // Load existing files status or create new one
    const existingStatus = await import('@/lib/storage').then(m => m.loadFilesStatus()) || {
      categories: [],
      languages: [],
      words: []
    }

    // Update the appropriate array
    const updatedStatus: UploadedFiles = {
      ...existingStatus,
      [fileType]: lines
    }

    // Save updated status
    saveFilesStatus(updatedStatus)

    return NextResponse.json({ 
      success: true, 
      filename,
      lineCount: lines.length,
      status: updatedStatus
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
} 