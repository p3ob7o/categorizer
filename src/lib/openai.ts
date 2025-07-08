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

// New optimized function that combines both language detection and categorization
export const processWordOptimized = async (
  word: string,
  categories: string[],
  languages: string[],
  model: string = 'gpt-4o-mini'
): Promise<ProcessingResult> => {
  try {
    console.log(`🔍 Processing word optimized: "${word}"`)
    
    const openai = createOpenAI()
    
    // Combined prompt for both language detection and categorization
    const combinedPrompt = `You are a language detection, translation, and categorization expert. Given a word, a list of languages (in priority order), and a list of categories, perform the following tasks:

1. Detect the primary language of the word from the provided list (languages are listed in priority order - choose the highest priority match)
2. If the word is not in English, provide an English translation
3. Determine which category the word (or its English translation) best fits into

Languages to consider (in priority order): ${languages.join(', ')}
Available categories: ${categories.join(', ')}

Instructions:
- For language detection: If the word exists in multiple languages, choose the one with the highest priority (first in the list)
- For categorization: Be fuzzy in your matching - if the word kind of belongs to a category, that's fine. If it doesn't fit any category well, leave it empty
- If the word is already in English, keep it as the translation

Respond with JSON format:
{
  "language": "detected_language",
  "englishTranslation": "english_translation_or_same_word_if_already_english",
  "category": "category_name_or_empty_string"
}`

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: combinedPrompt
        },
        {
          role: "user",
          content: `Word: "${word}"`
        }
      ],
      temperature: 0.2,
    })

    console.log(`✅ Combined API Response:`, response.choices[0].message.content)
    
    let content = response.choices[0].message.content || '{}'
    content = content.trim()
    
    // Clean up any markdown formatting
    if (content.startsWith('```')) {
      content = content.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim()
    }
    
    const result = JSON.parse(content)
    
    const finalResult = {
      originalWord: word,
      language: result.language || 'Unknown',
      englishTranslation: result.englishTranslation || word,
      category: result.category || ''
    }
    
    console.log(`✅ Final optimized result for "${word}":`, finalResult)
    return finalResult
  } catch (error) {
    console.error(`❌ Error processing word optimized "${word}":`, error)
    return {
      originalWord: word,
      language: 'Error',
      englishTranslation: word,
      category: ''
    }
  }
}

// Legacy function - kept for backward compatibility but now uses optimized version
export const processWord = async (
  word: string,
  categories: string[],
  languages: string[],
  model: string,
  langPrompt: string,
  catPrompt: string
): Promise<ProcessingResult> => {
  // Use optimized version if no custom prompts are provided
  if (!langPrompt && !catPrompt) {
    return processWordOptimized(word, categories, languages, model)
  }
  
  // Original implementation for custom prompts
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