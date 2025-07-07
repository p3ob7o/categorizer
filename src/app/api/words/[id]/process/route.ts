import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { processWord } from '@/lib/openai';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idString } = await params;
    const id = parseInt(idString);
    const body = await request.json();
    const { langPrompt, catPrompt } = body;
    
    // Get the word
    const word = await prisma.word.findUnique({
      where: { id },
      include: { language: true }
    });
    
    if (!word) {
      return NextResponse.json(
        { error: 'Word not found' },
        { status: 404 }
      );
    }
    
    // Get categories and languages
    const [categories, languages] = await Promise.all([
      prisma.category.findMany({ orderBy: { name: 'asc' } }),
      prisma.language.findMany({ orderBy: { name: 'asc' } })
    ]);
    
    if (!categories.length) {
      return NextResponse.json(
        { error: 'No categories found. Please add categories first.' },
        { status: 400 }
      );
    }
    
    // Process the word using AI
    const result = await processWord(
      word.word,
      categories.map(c => c.name),
      languages.map(l => l.name),
      'gpt-4o-mini',
      langPrompt || `You are a language detection and translation expert. Given a word and a list of languages, determine:\n1. The primary language of the word (if it exists in English, that's always primary)\n2. If the word is not in English, provide an English translation\n3. If the word exists in multiple languages from the list, choose the first one in the order provided\n\nLanguages to consider: English, {languages}\n\nRespond with JSON format:\n{\n  "language": "detected_language",\n  "englishTranslation": "english_translation_or_same_word_if_already_english"\n}`,
      catPrompt || `You are a categorization expert. Given a word and a list of categories, determine which category the word best fits into. Be fuzzy in your matching - if the word kind of belongs to a category, that's fine. If it doesn't fit any category well, return an empty string.\n\nAvailable categories: {categories}\n\nRespond with just the category name or an empty string if no good match.`
    );
    
    // Validate that the language is in our list with flexible matching
    const detectedLanguage = languages.find(l => {
      const langName = l.name.toLowerCase();
      const resultLang = result.language.toLowerCase();
      const langCode = l.code?.toLowerCase();
      
      // Direct name match
      if (langName === resultLang) return true;
      
      // Check if it's English with various forms
      if (resultLang === 'english' && (langName === 'english' || langCode === 'en')) return true;
      
      // Check if language code matches
      if (langCode && langCode === resultLang) return true;
      
      // Handle common language variations
      if (resultLang === 'en' && (langName === 'english' || langCode === 'en')) return true;
      
      return false;
    });
    
    console.log('🔍 Language matching:', {
      aiDetected: result.language,
      foundMatch: detectedLanguage?.name,
      availableLanguages: languages.map(l => `${l.name}${l.code ? ` (${l.code})` : ''}`)
    });
    
    // Validate that the category is in our list
    const detectedCategory = categories.find(c => 
      c.name.toLowerCase() === result.category.toLowerCase()
    );
    
    // Update the word with the results
    const updatedWord = await prisma.word.update({
      where: { id },
      data: {
        languageId: detectedLanguage?.id || null,
        englishTranslation: result.englishTranslation,
        category: detectedCategory?.name || null
      },
      include: { language: true }
    });
    
    return NextResponse.json({
      success: true,
      word: updatedWord,
      result: {
        ...result,
        language: detectedLanguage?.name || result.language,
        category: detectedCategory?.name || null
      }
    });
  } catch (error: any) {
    console.error('Error processing word:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process word' },
      { status: 500 }
    );
  }
} 