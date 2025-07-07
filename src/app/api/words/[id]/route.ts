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
    const { word, languageId, englishTranslation, category } = body;
    
    if (!word || typeof word !== 'string') {
      return NextResponse.json(
        { error: 'Word is required' },
        { status: 400 }
      );
    }
    
    const updateData: any = {
      word: word.trim(),
      englishTranslation: englishTranslation?.trim() || null,
      category: category?.trim() || null,
    };
    
    if (languageId !== undefined) {
      updateData.languageId = languageId ? parseInt(languageId) : null;
    }
    
    const updatedWord = await prisma.word.update({
      where: { id },
      data: updateData,
      include: {
        language: true,
      },
    });
    
    return NextResponse.json(updatedWord);
  } catch (error: any) {
    console.error('Error updating word:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Word not found' },
        { status: 404 }
      );
    }
    
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
      { error: 'Failed to update word' },
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
    
    await prisma.word.delete({
      where: { id },
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting word:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Word not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete word' },
      { status: 500 }
    );
  }
} 