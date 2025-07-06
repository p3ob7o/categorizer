import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateSession } from '@/lib/session'
import { saveCategories, saveLanguages, saveWords, getSession } from '@/lib/db'

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

    // Get updated session with all relations
    const updatedSession = await getSession(session.id)
    
    if (!updatedSession) {
      return NextResponse.json({ 
        error: 'Session not found' 
      }, { status: 404 })
    }

    // Return updated session status
    const status = {
      categories: updatedSession.categories.map(c => c.name),
      languages: updatedSession.languages.map(l => l.name),
      words: updatedSession.words.map(w => w.originalWord),
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