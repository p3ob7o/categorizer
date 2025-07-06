import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Session management
export async function createSession() {
  return await prisma.session.create({
    data: {
      status: 'pending',
    },
  })
}

export async function getSession(sessionId: string) {
  return await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      categories: true,
      languages: true,
      words: true,
      results: {
        orderBy: { processedAt: 'desc' },
      },
    },
  })
}

export async function updateSessionStatus(
  sessionId: string,
  data: {
    status?: string
    totalWords?: number
    processedWords?: number
    currentWord?: string
    error?: string | null
  }
) {
  return await prisma.session.update({
    where: { id: sessionId },
    data,
  })
}

// File uploads
export async function saveCategories(sessionId: string, categories: string[]) {
  await prisma.category.deleteMany({
    where: { sessionId },
  })
  
  await prisma.category.createMany({
    data: categories.map(name => ({
      sessionId,
      name,
    })),
  })
}

export async function saveLanguages(sessionId: string, languages: string[]) {
  await prisma.language.deleteMany({
    where: { sessionId },
  })
  
  await prisma.language.createMany({
    data: languages.map(name => ({
      sessionId,
      name,
    })),
  })
}

export async function saveWords(sessionId: string, words: string[]) {
  await prisma.word.deleteMany({
    where: { sessionId },
  })
  
  await prisma.word.createMany({
    data: words.map(originalWord => ({
      sessionId,
      originalWord,
    })),
  })
  
  // Update session with total words
  await prisma.session.update({
    where: { id: sessionId },
    data: { totalWords: words.length },
  })
}

// Results
export async function saveResult(
  sessionId: string,
  result: {
    originalWord: string
    language: string
    englishTranslation: string
    category: string
  }
) {
  return await prisma.result.create({
    data: {
      sessionId,
      ...result,
    },
  })
}

// Export functionality
export async function getResultsForExport(sessionId: string) {
  return await prisma.result.findMany({
    where: { sessionId },
    orderBy: { processedAt: 'asc' },
  })
}

// Cleanup
export async function deleteSession(sessionId: string) {
  return await prisma.session.delete({
    where: { id: sessionId },
  })
} 