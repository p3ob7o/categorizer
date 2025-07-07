'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  Clock, 
  DollarSign, 
  Zap, 
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Settings,
  BarChart3
} from 'lucide-react'

interface ProcessingStats {
  totalWords: number
  processedWords: number
  successfulWords: number
  failedWords: number
  currentChunk: number
  totalChunks: number
  estimatedTimeRemaining: number
  averageProcessingTime: number
  totalCost: number
  processingRate: number
}

interface ProcessingConfig {
  mode: 'batch' | 'parallel'
  model: string
  chunkSize: number
  maxRetries: number
  langPrompt?: string
  catPrompt?: string
}

interface ProcessingSession {
  id: string
  status: string
  config: ProcessingConfig
  stats: ProcessingStats
  error?: string
  canResume?: boolean
}

export default function EnhancedProcessing() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [session, setSession] = useState<ProcessingSession | null>(null)
  const [results, setResults] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedWords, setSelectedWords] = useState<number[]>([])
  const [allWords, setAllWords] = useState<any[]>([])
  
  // Configuration state
  const [config, setConfig] = useState<ProcessingConfig>({
    mode: 'batch',
    model: 'gpt-4o-mini',
    chunkSize: 10,
    maxRetries: 3
  })

  // Analytics state
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [analytics, setAnalytics] = useState<any>(null)

  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    loadWords()
  }, [])

  const loadWords = async () => {
    try {
      const response = await fetch('/api/words')
      if (response.ok) {
        const words = await response.json()
        setAllWords(words)
        // Select unprocessed words by default
        const unprocessedWords = words.filter((w: any) => !w.languageId || !w.category)
        setSelectedWords(unprocessedWords.map((w: any) => w.id))
      }
    } catch (error) {
      console.error('Error loading words:', error)
    }
  }

  const startProcessing = async () => {
    if (selectedWords.length === 0) {
      setError('Please select words to process')
      return
    }

    setIsProcessing(true)
    setIsPaused(false)
    setError(null)
    setResults([])

    try {
      const response = await fetch('/api/process-enhanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...config,
          wordIds: selectedWords
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to start processing')
      }

      const sessionId = response.headers.get('X-Session-ID')
      if (sessionId) {
        setSession(prev => prev ? { ...prev, id: sessionId } : null)
      }

      // Set up event source for real-time updates
      eventSourceRef.current = new EventSource(`/api/process-enhanced`)
      
      eventSourceRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data)
        handleProcessingEvent(data)
      }

      eventSourceRef.current.onerror = () => {
        setIsProcessing(false)
        setError('Connection lost. You can resume processing later.')
      }

    } catch (error) {
      setIsProcessing(false)
      setError(error instanceof Error ? error.message : 'Processing failed')
    }
  }

  const handleProcessingEvent = (event: any) => {
    switch (event.type) {
      case 'started':
        setSession({
          id: event.sessionId,
          status: 'processing',
          config: event.data.config,
          stats: event.data.stats
        })
        break

      case 'chunk_complete':
        if (session) {
          setSession(prev => prev ? {
            ...prev,
            stats: event.data.stats
          } : null)
        }
        break

      case 'result':
        setResults(prev => [...prev, event.data])
        break

      case 'complete':
        setIsProcessing(false)
        setSession(prev => prev ? {
          ...prev,
          status: 'completed',
          stats: event.data.stats
        } : null)
        eventSourceRef.current?.close()
        loadWords() // Refresh word list
        break

      case 'error':
        setIsProcessing(false)
        setError(event.data.error)
        setSession(prev => prev ? {
          ...prev,
          status: 'failed',
          error: event.data.error,
          canResume: event.data.canResume
        } : null)
        eventSourceRef.current?.close()
        break
    }
  }

  const pauseProcessing = async () => {
    if (session) {
      try {
        await fetch(`/api/processing-sessions/${session.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'pause' })
        })
        setIsPaused(true)
        setIsProcessing(false)
        eventSourceRef.current?.close()
      } catch (error) {
        console.error('Error pausing session:', error)
      }
    }
  }

  const resumeProcessing = async () => {
    if (session) {
      try {
        setIsProcessing(true)
        setIsPaused(false)
        setError(null)

        const response = await fetch('/api/process-enhanced', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: session.id })
        })

        if (!response.ok) {
          throw new Error('Failed to resume processing')
        }

        // Set up event source for resumed processing
        eventSourceRef.current = new EventSource(`/api/process-enhanced`)
        eventSourceRef.current.onmessage = (event) => {
          const data = JSON.parse(event.data)
          handleProcessingEvent(data)
        }

      } catch (error) {
        setIsProcessing(false)
        setError(error instanceof Error ? error.message : 'Resume failed')
      }
    }
  }

  const stopProcessing = async () => {
    if (session) {
      try {
        await fetch(`/api/processing-sessions/${session.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'cancel' })
        })
        setIsProcessing(false)
        setIsPaused(false)
        eventSourceRef.current?.close()
      } catch (error) {
        console.error('Error stopping session:', error)
      }
    }
  }

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`
  }

  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(4)}`
  }

  const getProgressPercentage = (): number => {
    if (!session?.stats.totalWords) return 0
    return (session.stats.processedWords / session.stats.totalWords) * 100
  }

  const getSuccessRate = (): number => {
    if (!session?.stats.processedWords) return 0
    return (session.stats.successfulWords / session.stats.processedWords) * 100
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Enhanced Bulk Processing
          </CardTitle>
          <CardDescription>
            Process large datasets with chunked processing, ETA calculations, and resume capability
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="process" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="process">Process</TabsTrigger>
              <TabsTrigger value="config">Configuration</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="process" className="space-y-4">
              {/* Word Selection */}
              <div className="space-y-2">
                <Label>Words to Process ({selectedWords.length} selected)</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const unprocessed = allWords.filter(w => !w.languageId || !w.category)
                      setSelectedWords(unprocessed.map(w => w.id))
                    }}
                  >
                    Select Unprocessed ({allWords.filter(w => !w.languageId || !w.category).length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedWords(allWords.map(w => w.id))}
                  >
                    Select All ({allWords.length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedWords([])}
                  >
                    Clear Selection
                  </Button>
                </div>
              </div>

              {/* Processing Controls */}
              <div className="flex gap-2">
                {!isProcessing && !isPaused && (
                  <Button 
                    onClick={startProcessing} 
                    disabled={selectedWords.length === 0}
                    className="flex items-center gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Start Processing
                  </Button>
                )}

                {isProcessing && (
                  <Button 
                    onClick={pauseProcessing} 
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Pause className="h-4 w-4" />
                    Pause
                  </Button>
                )}

                {isPaused && session?.canResume && (
                  <Button 
                    onClick={resumeProcessing}
                    className="flex items-center gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Resume
                  </Button>
                )}

                {(isProcessing || isPaused) && (
                  <Button 
                    onClick={stopProcessing} 
                    variant="destructive"
                    className="flex items-center gap-2"
                  >
                    <Square className="h-4 w-4" />
                    Stop
                  </Button>
                )}
              </div>

              {/* Progress Display */}
              {session && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {/* Progress Bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span>{session.stats.processedWords} / {session.stats.totalWords} words</span>
                        </div>
                        <Progress value={getProgressPercentage()} className="w-full" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Chunk {session.stats.currentChunk} / {session.stats.totalChunks}</span>
                          <span>{getProgressPercentage().toFixed(1)}% complete</span>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <div>
                            <div className="text-sm font-medium">{session.stats.successfulWords}</div>
                            <div className="text-xs text-muted-foreground">Successful</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-500" />
                          <div>
                            <div className="text-sm font-medium">{session.stats.failedWords}</div>
                            <div className="text-xs text-muted-foreground">Failed</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-blue-500" />
                          <div>
                            <div className="text-sm font-medium">
                              {formatTime(session.stats.estimatedTimeRemaining)}
                            </div>
                            <div className="text-xs text-muted-foreground">ETA</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <div>
                            <div className="text-sm font-medium">{formatCost(session.stats.totalCost)}</div>
                            <div className="text-xs text-muted-foreground">Cost</div>
                          </div>
                        </div>
                      </div>

                      {/* Performance Metrics */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Success Rate:</span>
                          <Badge variant={getSuccessRate() > 90 ? "default" : "secondary"} className="ml-2">
                            {getSuccessRate().toFixed(1)}%
                          </Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Processing Rate:</span>
                          <span className="ml-2 font-medium">
                            {session.stats.processingRate.toFixed(1)} words/min
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Error Display */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Recent Results */}
              {results.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Recent Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {results.slice(-10).map((result, index) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center gap-2">
                            {result.success ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="font-medium">{result.originalWord}</span>
                            {result.detectedLanguage && (
                              <Badge variant="outline">{result.detectedLanguage}</Badge>
                            )}
                            {result.assignedCategory && (
                              <Badge variant="secondary">{result.assignedCategory}</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {result.processingTime}ms • {formatCost(result.cost)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="config" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mode">Processing Mode</Label>
                  <Select value={config.mode} onValueChange={(value: 'batch' | 'parallel') => 
                    setConfig(prev => ({ ...prev, mode: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="batch">Sequential (Batch)</SelectItem>
                      <SelectItem value="parallel">Parallel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">AI Model</Label>
                  <Select value={config.model} onValueChange={(value) => 
                    setConfig(prev => ({ ...prev, model: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o-mini">GPT-4O Mini (Recommended)</SelectItem>
                      <SelectItem value="gpt-4o">GPT-4O</SelectItem>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="chunkSize">Chunk Size</Label>
                  <Input
                    id="chunkSize"
                    type="number"
                    min="1"
                    max="50"
                    value={config.chunkSize}
                    onChange={(e) => setConfig(prev => ({ 
                      ...prev, 
                      chunkSize: parseInt(e.target.value) || 10 
                    }))}
                  />
                  <div className="text-xs text-muted-foreground">
                    Number of words processed per chunk (1-50)
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxRetries">Max Retries</Label>
                  <Input
                    id="maxRetries"
                    type="number"
                    min="0"
                    max="10"
                    value={config.maxRetries}
                    onChange={(e) => setConfig(prev => ({ 
                      ...prev, 
                      maxRetries: parseInt(e.target.value) || 3 
                    }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="langPrompt">Custom Language Prompt (Optional)</Label>
                <Textarea
                  id="langPrompt"
                  placeholder="Custom prompt for language detection..."
                  value={config.langPrompt || ''}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    langPrompt: e.target.value || undefined 
                  }))}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="catPrompt">Custom Category Prompt (Optional)</Label>
                <Textarea
                  id="catPrompt"
                  placeholder="Custom prompt for categorization..."
                  value={config.catPrompt || ''}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    catPrompt: e.target.value || undefined 
                  }))}
                  rows={3}
                />
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Processing Analytics</h3>
              </div>
              
              <Alert>
                <TrendingUp className="h-4 w-4" />
                <AlertDescription>
                  Analytics dashboard will show detailed processing statistics, cost analysis, 
                  and performance metrics. This feature is coming soon!
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
} 