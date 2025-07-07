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
    
    // Remove header if present
    const hasHeader = lines[0] && lines[0].toLowerCase().includes('category');
    const dataLines = hasHeader ? lines.slice(1) : lines;
    
    const results = {
      created: 0,
      skipped: 0,
      errors: [] as string[],
    };
    
    for (const line of dataLines) {
      const categoryName = line.trim();
      
      if (!categoryName) continue;
      
      try {
        await prisma.category.create({
          data: { name: categoryName },
        });
        results.created++;
      } catch (error: any) {
        if (error.code === 'P2002') {
          results.skipped++;
        } else {
          results.errors.push(`Failed to create category "${categoryName}"`);
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