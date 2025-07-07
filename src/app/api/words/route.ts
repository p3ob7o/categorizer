import { NextRequest, NextResponse } from 'next/server';
import { prisma, withConnection } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const languageIds = searchParams.getAll('languageId');
    const search = searchParams.get('search');
    
    const where: any = {};
    
    if (languageIds.length > 0) {
      const validLanguageIds = languageIds.map(id => parseInt(id)).filter(id => !isNaN(id));
      if (validLanguageIds.length > 0) {
        where.languageId = {
          in: validLanguageIds
        };
      }
    }
    
    if (search) {
      where.word = {
        contains: search,
        mode: 'insensitive',
      };
    }
    
    const words = await withConnection(async () => {
      return prisma.word.findMany({
        where,
        include: {
          language: true,
        },
        orderBy: { word: 'asc' },
      });
    });
    
    return NextResponse.json(words);
  } catch (error) {
    console.error('Error fetching words:', error);
    return NextResponse.json(
      { error: 'Failed to fetch words' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { word, languageId, englishTranslation, category } = body;
    
    if (!word || typeof word !== 'string') {
      return NextResponse.json(
        { error: 'Word is required' },
        { status: 400 }
      );
    }
    
    const wordData: any = {
      word: word.trim(),
      englishTranslation: englishTranslation?.trim() || null,
      category: category?.trim() || null,
    };
    
    if (languageId) {
      wordData.languageId = parseInt(languageId);
    }
    
    const newWord = await withConnection(async () => {
      return prisma.word.create({
        data: wordData,
        include: {
          language: true,
        },
      });
    });
    
    return NextResponse.json(newWord);
  } catch (error: any) {
    console.error('Error creating word:', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'This word already exists for the selected language' },
        { status: 409 }
      );
    }
    
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Invalid language ID' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create word' },
      { status: 500 }
    );
  }
} 