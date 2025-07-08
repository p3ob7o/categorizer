import { NextRequest, NextResponse } from 'next/server';
import { prisma, withConnection } from '@/lib/db';

export async function GET() {
  try {
    const languages = await withConnection(async () => {
      return prisma.language.findMany({
        orderBy: [
          { priority: 'asc' },
          { name: 'asc' }
        ],
      });
    });
    
    return NextResponse.json(languages);
  } catch (error) {
    console.error('Error fetching languages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch languages' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, code, priority } = body;
    
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Language name is required' },
        { status: 400 }
      );
    }
    
    const languageData: any = {
      name: name.trim(),
      code: code?.trim() || null,
      priority: priority ? parseInt(priority) : 0,
    };
    
    const newLanguage = await withConnection(async () => {
      return prisma.language.create({
        data: languageData,
      });
    });
    
    return NextResponse.json(newLanguage);
  } catch (error: any) {
    console.error('Error creating language:', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'This language already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create language' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { confirmation } = body;
    
    if (confirmation !== 'languages') {
      return NextResponse.json(
        { error: 'Invalid confirmation. You must type "languages" to confirm deletion.' },
        { status: 400 }
      );
    }
    
    const deletedCount = await withConnection(async () => {
      const result = await prisma.language.deleteMany({});
      return result.count;
    });
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully deleted ${deletedCount} languages` 
    });
  } catch (error: any) {
    console.error('Error deleting all languages:', error);
    
    return NextResponse.json(
      { error: 'Failed to delete languages' },
      { status: 500 }
    );
  }
} 