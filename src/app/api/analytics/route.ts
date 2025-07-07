import { NextRequest, NextResponse } from 'next/server'
import { withConnection, prisma } from '@/lib/db'

// Get analytics data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '7d' // 1d, 7d, 30d, 90d, all
    const sessionId = searchParams.get('sessionId')

    // Calculate date range
    let dateFilter: any = {}
    if (timeRange !== 'all') {
      const days = parseInt(timeRange.replace('d', ''))
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      dateFilter = {
        createdAt: {
          gte: startDate
        }
      }
    }

    // Session-specific analytics
    if (sessionId) {
      const sessionAnalytics = await getSessionAnalytics(sessionId)
      return NextResponse.json(sessionAnalytics)
    }

    // Global analytics
    const analytics = await getGlobalAnalytics(dateFilter)
    return NextResponse.json(analytics)
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch analytics' 
    }, { status: 500 })
  }
}

async function getSessionAnalytics(sessionId: string) {
  return withConnection(async () => {
    const session = await prisma.processingSession.findUnique({
      where: { id: sessionId },
      include: {
        results: true
      }
    })

    if (!session) {
      throw new Error('Session not found')
    }

    const results = session.results

    // Language breakdown
    const languageBreakdown: Record<string, number> = {}
    results.forEach(result => {
      if (result.detectedLanguage) {
        languageBreakdown[result.detectedLanguage] = 
          (languageBreakdown[result.detectedLanguage] || 0) + 1
      }
    })

    // Category breakdown
    const categoryBreakdown: Record<string, number> = {}
    results.forEach(result => {
      if (result.assignedCategory) {
        categoryBreakdown[result.assignedCategory] = 
          (categoryBreakdown[result.assignedCategory] || 0) + 1
      }
    })

    // Error breakdown
    const errorBreakdown: Record<string, number> = {}
    results.filter(r => !r.success).forEach(result => {
      if (result.error) {
        const errorType = result.error.includes('timeout') ? 'timeout' :
                         result.error.includes('rate') ? 'rate_limit' :
                         result.error.includes('api') ? 'api_error' : 'other'
        errorBreakdown[errorType] = (errorBreakdown[errorType] || 0) + 1
      }
    })

    // Processing time analysis
    const processingTimes = results.map(r => r.processingTime)
    const avgProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length 
      : 0

    const minProcessingTime = processingTimes.length > 0 ? Math.min(...processingTimes) : 0
    const maxProcessingTime = processingTimes.length > 0 ? Math.max(...processingTimes) : 0

    // Cost analysis
    const totalCost = results.reduce((sum, r) => sum + r.cost, 0)
    const avgCostPerWord = results.length > 0 ? totalCost / results.length : 0
    const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0)

    return {
      sessionId,
      summary: {
        totalWords: session.totalWords,
        processedWords: session.processedWords,
        successfulWords: session.successfulWords,
        failedWords: session.failedWords,
        successRate: session.processedWords > 0 
          ? (session.successfulWords / session.processedWords) * 100 
          : 0,
        completionRate: session.totalWords > 0 
          ? (session.processedWords / session.totalWords) * 100 
          : 0
      },
      performance: {
        averageProcessingTime: avgProcessingTime,
        minProcessingTime,
        maxProcessingTime,
        processingRate: session.startedAt && session.lastProcessedAt
          ? session.processedWords / ((session.lastProcessedAt.getTime() - session.startedAt.getTime()) / 1000 / 60)
          : 0 // words per minute
      },
      cost: {
        totalCost,
        averageCostPerWord: avgCostPerWord,
        totalTokensUsed: totalTokens,
        model: session.model
      },
      breakdowns: {
        languages: languageBreakdown,
        categories: categoryBreakdown,
        errors: errorBreakdown
      },
      timeline: results.map(r => ({
        timestamp: r.processedAt,
        success: r.success,
        processingTime: r.processingTime,
        cost: r.cost
      }))
    }
  })
}

async function getGlobalAnalytics(dateFilter: any) {
  return withConnection(async () => {
    // Get sessions in date range
    const sessions = await prisma.processingSession.findMany({
      where: dateFilter,
      include: {
        results: true
      }
    })

    // Get all results in date range
    const allResults = await prisma.processingResult.findMany({
      where: {
        processedAt: dateFilter.createdAt
      }
    })

    // Overall statistics
    const totalSessions = sessions.length
    const completedSessions = sessions.filter(s => s.status === 'completed').length
    const failedSessions = sessions.filter(s => s.status === 'failed').length
    const processingSessions = sessions.filter(s => s.status === 'processing').length
    const pausedSessions = sessions.filter(s => s.status === 'paused').length

    const totalWords = sessions.reduce((sum, s) => sum + s.totalWords, 0)
    const processedWords = sessions.reduce((sum, s) => sum + s.processedWords, 0)
    const successfulWords = sessions.reduce((sum, s) => sum + s.successfulWords, 0)
    const failedWords = sessions.reduce((sum, s) => sum + s.failedWords, 0)

    // Cost analysis
    const totalCost = sessions.reduce((sum, s) => sum + s.estimatedCost, 0)
    const totalTokens = sessions.reduce((sum, s) => sum + s.totalTokensUsed, 0)

    // Model usage
    const modelUsage: Record<string, number> = {}
    sessions.forEach(session => {
      modelUsage[session.model] = (modelUsage[session.model] || 0) + 1
    })

    // Language detection accuracy (based on successful results)
    const languageBreakdown: Record<string, number> = {}
    allResults.forEach(result => {
      if (result.success && result.detectedLanguage) {
        languageBreakdown[result.detectedLanguage] = 
          (languageBreakdown[result.detectedLanguage] || 0) + 1
      }
    })

    // Category assignment breakdown
    const categoryBreakdown: Record<string, number> = {}
    allResults.forEach(result => {
      if (result.success && result.assignedCategory) {
        categoryBreakdown[result.assignedCategory] = 
          (categoryBreakdown[result.assignedCategory] || 0) + 1
      }
    })

    // Processing performance over time
    const dailyStats = await getDailyProcessingStats(dateFilter)

    // Error analysis
    const errorBreakdown: Record<string, number> = {}
    allResults.filter(r => !r.success).forEach(result => {
      if (result.error) {
        const errorType = result.error.includes('timeout') ? 'timeout' :
                         result.error.includes('rate') ? 'rate_limit' :
                         result.error.includes('api') ? 'api_error' : 'other'
        errorBreakdown[errorType] = (errorBreakdown[errorType] || 0) + 1
      }
    })

    // Processing time statistics
    const processingTimes = allResults.map(r => r.processingTime)
    const avgProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length 
      : 0

    return {
      summary: {
        totalSessions,
        completedSessions,
        failedSessions,
        processingSessions,
        pausedSessions,
        totalWords,
        processedWords,
        successfulWords,
        failedWords,
        overallSuccessRate: processedWords > 0 ? (successfulWords / processedWords) * 100 : 0,
        sessionCompletionRate: totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0
      },
      cost: {
        totalCost,
        averageCostPerWord: processedWords > 0 ? totalCost / processedWords : 0,
        averageCostPerSession: totalSessions > 0 ? totalCost / totalSessions : 0,
        totalTokensUsed: totalTokens,
        averageTokensPerWord: processedWords > 0 ? totalTokens / processedWords : 0
      },
      performance: {
        averageProcessingTime,
        averageWordsPerSession: totalSessions > 0 ? processedWords / totalSessions : 0,
        averageSessionDuration: calculateAverageSessionDuration(sessions)
      },
      usage: {
        modelUsage,
        languageBreakdown,
        categoryBreakdown,
        errorBreakdown
      },
      trends: {
        dailyStats
      }
    }
  })
}

async function getDailyProcessingStats(dateFilter: any) {
  return withConnection(async () => {
    const results = await prisma.processingResult.findMany({
      where: {
        processedAt: dateFilter.createdAt
      },
      select: {
        processedAt: true,
        success: true,
        cost: true,
        tokensUsed: true,
        processingTime: true
      }
    })

    // Group by day
    const dailyStats: Record<string, any> = {}
    
    results.forEach(result => {
      const date = result.processedAt.toISOString().split('T')[0]
      
      if (!dailyStats[date]) {
        dailyStats[date] = {
          date,
          totalWords: 0,
          successfulWords: 0,
          failedWords: 0,
          totalCost: 0,
          totalTokens: 0,
          totalProcessingTime: 0
        }
      }
      
      dailyStats[date].totalWords++
      if (result.success) {
        dailyStats[date].successfulWords++
      } else {
        dailyStats[date].failedWords++
      }
      dailyStats[date].totalCost += result.cost
      dailyStats[date].totalTokens += result.tokensUsed
      dailyStats[date].totalProcessingTime += result.processingTime
    })

    return Object.values(dailyStats).map((day: any) => ({
      ...day,
      successRate: day.totalWords > 0 ? (day.successfulWords / day.totalWords) * 100 : 0,
      averageProcessingTime: day.totalWords > 0 ? day.totalProcessingTime / day.totalWords : 0,
      averageCostPerWord: day.totalWords > 0 ? day.totalCost / day.totalWords : 0
    }))
  })
}

function calculateAverageSessionDuration(sessions: any[]): number {
  const completedSessions = sessions.filter(s => s.startedAt && s.completedAt)
  
  if (completedSessions.length === 0) return 0
  
  const totalDuration = completedSessions.reduce((sum, session) => {
    return sum + (session.completedAt.getTime() - session.startedAt.getTime())
  }, 0)
  
  return totalDuration / completedSessions.length / 1000 // Convert to seconds
} 