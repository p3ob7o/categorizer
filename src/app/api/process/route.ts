import { NextRequest, NextResponse } from 'next/server'
import { processBatch, processWord } from '@/lib/openai'
import { prisma } from '@/lib/db'
import { ProcessingResult } from '@/types'
import { exportToCSV } from '@/lib/storage'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, mode = 'batch', model = 'gpt-4o-mini', langPrompt, catPrompt, wordIds } = body;

    if (action === 'start') {
      // Get data from database
      const [categories, languages] = await Promise.all([
        prisma.category.findMany({ orderBy: { name: 'asc' } }),
        prisma.language.findMany({ orderBy: [{ priority: 'asc' }, { name: 'asc' }] })
      ])

      if (!categories.length) {
        return NextResponse.json({ 
          error: 'Please add categories to the database first' 
        }, { status: 400 })
      }

      // Get words based on mode and filters
      let words;
      if (wordIds && wordIds.length > 0) {
        // Process specific words
        words = await prisma.word.findMany({
          where: { id: { in: wordIds } },
          include: { language: true },
          orderBy: { word: 'asc' }
        });
      } else {
        // Process all words
        words = await prisma.word.findMany({
          include: { language: true },
          orderBy: { word: 'asc' }
        });
      }

      if (!words.length) {
        return NextResponse.json({ 
          error: 'No words found to process' 
        }, { status: 400 })
      }

      const categoryNames = categories.map(c => c.name)
      const languageNames = languages.map(l => l.name)

      // Default prompts if not provided
      const finalLangPrompt = langPrompt || `You are a language detection and translation expert. Given a word and a list of languages, determine:
1. The primary language of the word (if it exists in English, that's always primary)
2. If the word is not in English, provide an English translation
3. If the word exists in multiple languages from the list, choose the first one in the order provided

Languages to consider: English, {languages}

Respond with JSON format:
{
  "language": "detected_language",
  "englishTranslation": "english_translation_or_same_word_if_already_english"
}`;

      const finalCatPrompt = catPrompt || `You are a categorization expert. Given a word and a list of categories, determine which category the word best fits into. Be fuzzy in your matching - if the word kind of belongs to a category, that's fine. If it doesn't fit any category well, return an empty string.

Available categories: {categories}

Respond with just the category name or an empty string if no good match.`;

      if (mode === 'parallel') {
        // Process words in parallel (with batching to avoid overwhelming the API)
        const BATCH_SIZE = 10; // Process 10 words at a time
        const results: ProcessingResult[] = [];
        
        console.log(`🚀 Starting parallel processing for ${words.length} words in batches of ${BATCH_SIZE}`);
        
        for (let i = 0; i < words.length; i += BATCH_SIZE) {
          const batch = words.slice(i, i + BATCH_SIZE);
          const batchPromises = batch.map(word => 
            processWord(
              word.word,
              categoryNames,
              languageNames,
              model,
              finalLangPrompt,
              finalCatPrompt
            ).then(async (result) => {
              // Validate and update the word
              const detectedLanguage = languages.find(l => 
                l.name.toLowerCase() === result.language.toLowerCase()
              );
              
              const detectedCategory = categories.find(c => 
                c.name.toLowerCase() === result.category.toLowerCase()
              );
              
              await prisma.word.update({
                where: { id: word.id },
                data: {
                  languageId: detectedLanguage?.id || null,
                  englishTranslation: result.englishTranslation,
                  category: detectedCategory?.name || null
                }
              });
              
              return result;
            })
          );
          
          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);
          
          console.log(`✅ Processed batch ${i / BATCH_SIZE + 1}/${Math.ceil(words.length / BATCH_SIZE)}`);
          
          // Small delay between batches to avoid rate limiting
          if (i + BATCH_SIZE < words.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        return NextResponse.json({ 
          success: true, 
          mode: 'parallel',
          processed: results.length,
          results 
        });
        
      } else {
        // Batch mode (sequential processing)
        console.log(`🚀 Starting batch processing for ${words.length} words`);
        
        // Process words sequentially
        const results: ProcessingResult[] = [];
        
        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          
          try {
            const result = await processWord(
              word.word,
              categoryNames,
              languageNames,
              model,
              finalLangPrompt,
              finalCatPrompt
            );
            
            // Validate and update the word
            const detectedLanguage = languages.find(l => 
              l.name.toLowerCase() === result.language.toLowerCase()
            );
            
            const detectedCategory = categories.find(c => 
              c.name.toLowerCase() === result.category.toLowerCase()
            );
            
            await prisma.word.update({
              where: { id: word.id },
              data: {
                languageId: detectedLanguage?.id || null,
                englishTranslation: result.englishTranslation,
                category: detectedCategory?.name || null
              }
            });
            
            results.push(result);
            console.log(`✅ Processed ${i + 1}/${words.length}: ${word.word}`);
            
            // Small delay to avoid rate limiting
            if (i < words.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          } catch (error) {
            console.error(`❌ Error processing word "${word.word}":`, error);
            results.push({
              originalWord: word.word,
              language: 'Error',
              englishTranslation: word.word,
              category: ''
            });
          }
        }
        
        return NextResponse.json({ 
          success: true, 
          mode: 'batch',
          processed: results.length,
          results 
        });
      }
    }

    if (action === 'export') {
      // Export current database state
      const words = await prisma.word.findMany({
        include: { language: true },
        orderBy: { word: 'asc' }
      });
      
      const exportData = words.map(word => ({
        originalWord: word.word,
        language: word.language?.name || '',
        englishTranslation: word.englishTranslation || '',
        category: word.category || ''
      }));
      
      const csvPath = exportToCSV(exportData);
      return NextResponse.json({ success: true, csvPath });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Process error:', error)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  } finally {
    // Ensure database connection is cleaned up for serverless
    if (process.env.VERCEL) {
      try {
        await prisma.$disconnect()
      } catch (disconnectError) {
        console.error('Error disconnecting from database:', disconnectError)
      }
    }
  }
} 