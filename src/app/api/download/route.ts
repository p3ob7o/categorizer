import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('file')
    
    if (!filePath) {
      return NextResponse.json({ error: 'File path is required' }, { status: 400 })
    }

    // Security check: ensure the file is within the data directory
    const dataDir = path.join(process.cwd(), 'data')
    const fullPath = path.resolve(filePath)
    
    if (!fullPath.startsWith(dataDir)) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 403 })
    }

    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const fileContent = fs.readFileSync(fullPath, 'utf-8')
    const filename = path.basename(fullPath)

    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json({ error: 'Download failed' }, { status: 500 })
  }
} 