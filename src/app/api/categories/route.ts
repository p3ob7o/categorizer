import { NextRequest, NextResponse } from 'next/server';
import { prisma, withConnection } from '@/lib/db';

export async function GET() {
  try {
    const categories = await withConnection(async () => {
      return prisma.category.findMany({
        orderBy: { name: 'asc' },
      });
    });
    
    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;
    
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }
    
    const newCategory = await withConnection(async () => {
      return prisma.category.create({
        data: {
          name: name.trim(),
        },
      });
    });
    
    return NextResponse.json(newCategory);
  } catch (error: any) {
    console.error('Error creating category:', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'This category already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { confirmation } = body;
    
    if (confirmation !== 'categories') {
      return NextResponse.json(
        { error: 'Invalid confirmation. You must type "categories" to confirm deletion.' },
        { status: 400 }
      );
    }
    
    const deletedCount = await withConnection(async () => {
      const result = await prisma.category.deleteMany({});
      return result.count;
    });
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully deleted ${deletedCount} categories` 
    });
  } catch (error: any) {
    console.error('Error deleting all categories:', error);
    
    return NextResponse.json(
      { error: 'Failed to delete categories' },
      { status: 500 }
    );
  }
} 