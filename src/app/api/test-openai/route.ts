import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 400 })
    }

    console.log(`🔑 Testing API key: ${apiKey.substring(0, 10)}...`)
    
    const openai = new OpenAI({
      apiKey,
    })

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: "Say 'Hello, API is working!'"
        }
      ],
      max_tokens: 10,
    })

    const result = response.choices[0].message.content

    return NextResponse.json({ 
      success: true, 
      message: result,
      apiKeyPreview: apiKey.substring(0, 10) + '...'
    })
  } catch (error: any) {
    console.error('OpenAI test error:', error)
    return NextResponse.json({ 
      error: error.message,
      code: error.code,
      type: error.type
    }, { status: 500 })
  }
} 