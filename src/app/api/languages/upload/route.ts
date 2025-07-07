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
    const hasHeader = lines[0] && lines[0].toLowerCase().includes('language');
    const dataLines = hasHeader ? lines.slice(1) : lines;
    
    const results = {
      created: 0,
      skipped: 0,
      errors: [] as string[],
    };
    
    for (const line of dataLines) {
      const parts = line.split(',').map(p => p.trim());
      const languageName = parts[0];
      const languageCode = parts[1] || null;
      
      if (!languageName) continue;
      
      try {
        await prisma.language.create({
          data: {
            name: languageName,
            code: languageCode,
          },
        });
        results.created++;
      } catch (error: any) {
        if (error.code === 'P2002') {
          results.skipped++;
        } else {
          results.errors.push(`Failed to create language "${languageName}"`);
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