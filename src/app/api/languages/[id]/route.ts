import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idString } = await params;
    const id = parseInt(idString);
    const body = await request.json();
    const { name, code, priority } = body;
    
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Language name is required' },
        { status: 400 }
      );
    }
    
    const language = await prisma.language.update({
      where: { id },
      data: {
        name: name.trim(),
        code: code?.trim() || null,
        priority: priority !== undefined ? priority : undefined,
      },
    });
    
    return NextResponse.json(language);
  } catch (error: any) {
    console.error('Error updating language:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Language not found' },
        { status: 404 }
      );
    }
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Language name or code already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update language' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idString } = await params;
    const id = parseInt(idString);
    
    await prisma.language.delete({
      where: { id },
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting language:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Language not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete language' },
      { status: 500 }
    );
  }
} 