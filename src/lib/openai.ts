import OpenAI from 'openai'
import { ProcessingResult } from '@/types'

const createOpenAI = () => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  return new OpenAI({
    apiKey,
  })
}

export const processWord = async (
  word: string,
  categories: string[],
  languages: string[],
  model: string,
  langPrompt: string,
  catPrompt: string
): Promise<ProcessingResult> => {
  try {
    console.log(`🔍 Processing word: "${word}"`)
    console.log(`📝 API Key check: ${process.env.OPENAI_API_KEY ? 'Present' : 'Missing'} (${process.env.OPENAI_API_KEY?.substring(0, 10)}...)`)
    
    // Step 1: Determine language and translate if needed
    console.log(`🌍 Step 1: Language detection for "${word}"`)
    const openai = createOpenAI()
    const langPromptFilled = langPrompt.replace('{languages}', languages.join(', '))
    const languageResponse = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: langPromptFilled
        },
        {
          role: "user",
          content: `Word: "${word}"`
        }
      ],
      temperature: 0.1,
    })

    console.log(`✅ Language API Response:`, languageResponse.choices[0].message.content)
    let langContent = languageResponse.choices[0].message.content || '{}'
    langContent = langContent.trim()
    if (langContent.startsWith('```')) {
      langContent = langContent.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim()
    }
    const languageResult = JSON.parse(langContent)
    const detectedLanguage = languageResult.language || 'Unknown'
    const englishTranslation = languageResult.englishTranslation || word
    console.log(`🌍 Detected language: ${detectedLanguage}, Translation: ${englishTranslation}`)

    // Step 2: Categorize the English translation
    console.log(`🏷️ Step 2: Categorization for "${englishTranslation}"`)
    const catPromptFilled = catPrompt.replace('{categories}', categories.join(', '))
    const categoryResponse = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: catPromptFilled
        },
        {
          role: "user",
          content: `Word: "${englishTranslation}"`
        }
      ],
      temperature: 0.3,
    })

    console.log(`✅ Category API Response:`, categoryResponse.choices[0].message.content)
    let catContent = categoryResponse.choices[0].message.content?.trim() || ''
    if (catContent.startsWith('```')) {
      catContent = catContent.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim()
    }
    const category = catContent
    console.log(`🏷️ Assigned category: ${category || 'None'}`)

    const result = {
      originalWord: word,
      language: detectedLanguage,
      englishTranslation,
      category
    }
    
    console.log(`✅ Final result for "${word}":`, result)
    return result
  } catch (error) {
    console.error(`❌ Error processing word "${word}":`, error)
    console.error(`🔑 API Key status: ${process.env.OPENAI_API_KEY ? 'Present' : 'Missing'}`)
    if (process.env.OPENAI_API_KEY) {
      console.error(`🔑 API Key preview: ${process.env.OPENAI_API_KEY.substring(0, 20)}...`)
    }
    return {
      originalWord: word,
      language: 'Error',
      englishTranslation: word,
      category: ''
    }
  }
}

export const processBatch = async (
  words: string[],
  categories: string[],
  languages: string[],
  startIndex: number = 0,
  onProgress?: (result: ProcessingResult, currentIndex: number, totalWords: number) => void,
  model: string = 'gpt-4o-mini',
  langPrompt: string = '',
  catPrompt: string = ''
): Promise<ProcessingResult[]> => {
  const results: ProcessingResult[] = []
  
  for (let i = startIndex; i < words.length; i++) {
    const word = words[i].trim()
    if (!word) continue
    
    try {
      const result = await processWord(word, categories, languages, model, langPrompt, catPrompt)
      results.push(result)
      
      // Call progress callback if provided
      if (onProgress) {
        onProgress(result, i + 1, words.length)
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      console.error(`Error processing word at index ${i}:`, error)
      const errorResult = {
        originalWord: word,
        language: 'Error',
        englishTranslation: word,
        category: ''
      }
      results.push(errorResult)
      
      // Call progress callback for error result too
      if (onProgress) {
        onProgress(errorResult, i + 1, words.length)
      }
    }
  }
  
  return results
} 