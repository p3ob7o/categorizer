import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateSession } from '@/lib/session'
import { saveCategories, saveLanguages, saveWords } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { fileType, content } = await request.json()
    
    if (!fileType || !content) {
      return NextResponse.json({ 
        error: 'Missing fileType or content' 
      }, { status: 400 })
    }

    // Get or create session
    const session = await getOrCreateSession()
    
    // Parse content into lines
    const lines = content.split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)

    // Save to database based on file type
    switch (fileType) {
      case 'categories':
        await saveCategories(session.id, lines)
        break
      case 'languages':
        await saveLanguages(session.id, lines)
        break
      case 'words':
        await saveWords(session.id, lines)
        break
      default:
        return NextResponse.json({ 
          error: 'Invalid fileType' 
        }, { status: 400 })
    }

    // Return updated session status
    const status = {
      categories: session.categories.map(c => c.name),
      languages: session.languages.map(l => l.name),
      words: session.words.map(w => w.originalWord),
    }

    // If this is a new upload of the same type, we need to refresh the data
    if (fileType === 'categories') {
      status.categories = lines
    } else if (fileType === 'languages') {
      status.languages = lines
    } else if (fileType === 'words') {
      status.words = lines
    }

    return NextResponse.json({ 
      success: true, 
      status,
      sessionId: session.id
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ 
      error: 'Upload failed' 
    }, { status: 500 })
  }
} 