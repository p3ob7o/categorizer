import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const [categoriesCount, wordsCount, languagesCount] = await Promise.all([
      prisma.category.count(),
      prisma.word.count(),
      prisma.language.count()
    ])

    return NextResponse.json({
      categories: categoriesCount,
      words: wordsCount,
      languages: languagesCount
    })
  } catch (error) {
    console.error('Status error:', error)
    return NextResponse.json({
      categories: 0,
      words: 0,
      languages: 0
    })
  }
} 