import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    const hasApiKey = !!apiKey
    const apiKeyPreview = apiKey ? `${apiKey.substring(0, 10)}...` : 'None'
    
    return NextResponse.json({
      hasApiKey,
      apiKeyPreview,
      nodeEnv: process.env.NODE_ENV,
      allEnvVars: Object.keys(process.env).filter(key => key.includes('OPENAI') || key.includes('API'))
    })
  } catch (error) {
    return NextResponse.json({ error: 'Debug failed' }, { status: 500 })
  }
} 