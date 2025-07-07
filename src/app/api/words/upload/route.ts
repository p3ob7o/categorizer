import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }
    
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    // Check for header
    const hasHeader = lines[0] && lines[0].toLowerCase().includes('word');
    const dataLines = hasHeader ? lines.slice(1) : lines;
    
    const results = {
      created: 0,
      skipped: 0,
      errors: [] as string[],
    };
    
    // Cache languages to avoid repeated queries
    const languageCache = new Map<string, number>();
    const languages = await prisma.language.findMany();
    languages.forEach(lang => {
      languageCache.set(lang.name.toLowerCase(), lang.id);
      if (lang.code) {
        languageCache.set(lang.code.toLowerCase(), lang.id);
      }
    });
    
    for (const line of dataLines) {
      const word = line.trim();
      
      if (!word) continue;
      
      try {
        await prisma.word.create({
          data: {
            word,
            languageId: null,
            englishTranslation: null,
            category: null,
          },
        });
        results.created++;
      } catch (error: any) {
        if (error.code === 'P2002') {
          results.skipped++;
        } else {
          results.errors.push(`Failed to create word "${word}"`);
        }
      }
    }
    
    return NextResponse.json({
      message: 'Upload completed',
      results,
    });
  } catch (error) {
    console.error('Error processing CSV:', error);
    return NextResponse.json(
      { error: 'Failed to process CSV file' },
      { status: 500 }
    );
  }
} 