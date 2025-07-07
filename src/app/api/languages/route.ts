import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const languages = await prisma.language.findMany({
      orderBy: { name: 'asc' },
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
    const { name, code } = body;
    
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Language name is required' },
        { status: 400 }
      );
    }
    
    const language = await prisma.language.create({
      data: {
        name: name.trim(),
        code: code?.trim() || null,
      },
    });
    
    return NextResponse.json(language);
  } catch (error: any) {
    console.error('Error creating language:', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Language name or code already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create language' },
      { status: 500 }
    );
  }
} 