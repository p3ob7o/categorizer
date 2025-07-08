#!/usr/bin/env node

/**
 * Load Test for Categorizer Performance Comparison
 * Tests processing performance with different batch sizes
 */

const BASE_URL = 'http://localhost:3000/api';

const testWords = [
  'computer', 'technology', 'software', 'programming', 'algorithm',
  'business', 'marketing', 'finance', 'strategy', 'management',
  'education', 'learning', 'teaching', 'student', 'knowledge',
  'entertainment', 'movie', 'music', 'game', 'sports',
  'science', 'research', 'experiment', 'discovery', 'innovation',
  'health', 'medicine', 'doctor', 'hospital', 'treatment',
  'travel', 'vacation', 'destination', 'adventure', 'exploration',
  'food', 'restaurant', 'cooking', 'recipe', 'cuisine',
  'art', 'painting', 'sculpture', 'creativity', 'design',
  'nature', 'environment', 'wildlife', 'conservation', 'ecology'
];

async function addTestWords() {
  console.log('📝 Adding test words...');
  let added = 0;
  
  for (const word of testWords) {
    try {
      const response = await fetch(`${BASE_URL}/words`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: `test-${word}-${Date.now()}` })
      });
      
      if (response.ok) added++;
    } catch (error) {
      console.log(`Failed to add word: ${word}`);
    }
  }
  
  console.log(`✅ Added ${added} test words`);
  return added;
}

async function testProcessingMode(mode, description) {
  console.log(`\n🚀 Testing ${description}...`);
  
  const startTime = Date.now();
  let resultsCount = 0;
  let errors = 0;
  
  try {
    const response = await fetch(`${BASE_URL}/process-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    
    if (!reader) {
      throw new Error('No reader available');
    }
    
    // Read the stream for up to 30 seconds or until complete
    const timeout = setTimeout(() => {
      reader.cancel();
    }, 30000);
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'result') {
              resultsCount++;
              if (data.result?.language === 'Error') {
                errors++;
              }
            } else if (data.type === 'complete') {
              clearTimeout(timeout);
              const totalTime = Date.now() - startTime;
              console.log(`✅ ${description} completed:`);
              console.log(`   Time: ${totalTime}ms`);
              console.log(`   Results: ${resultsCount}`);
              console.log(`   Errors: ${errors}`);
              console.log(`   Rate: ${(resultsCount / (totalTime / 1000)).toFixed(2)} words/sec`);
              return { totalTime, resultsCount, errors, rate: resultsCount / (totalTime / 1000) };
            } else if (data.type === 'error') {
              throw new Error(data.error);
            }
          } catch (parseError) {
            // Ignore JSON parse errors in stream
          }
        }
      }
    }
    
    clearTimeout(timeout);
    
  } catch (error) {
    console.log(`❌ ${description} failed:`, error.message);
    return null;
  }
}

async function runLoadTest() {
  console.log('🧪 Starting Load Test for Performance Comparison\n');
  
  try {
    // Add test data
    const wordsAdded = await addTestWords();
    
    if (wordsAdded === 0) {
      console.log('⚠️  No words added, using existing data');
    }
    
    // Test different modes
    const batchResults = await testProcessingMode('batch', 'Sequential Processing (Optimized)');
    const parallelResults = await testProcessingMode('parallel', 'Parallel Processing (Optimized)');
    
    // Compare results
    if (batchResults && parallelResults) {
      console.log('\n📊 Performance Comparison:');
      console.log(`Sequential: ${batchResults.rate.toFixed(2)} words/sec`);
      console.log(`Parallel: ${parallelResults.rate.toFixed(2)} words/sec`);
      
      const improvement = ((parallelResults.rate - batchResults.rate) / batchResults.rate * 100);
      console.log(`Parallel is ${improvement.toFixed(1)}% ${improvement > 0 ? 'faster' : 'slower'}`);
    }
    
    console.log('\n✅ Load test completed!');
    
  } catch (error) {
    console.log('❌ Load test failed:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  runLoadTest();
}

module.exports = { runLoadTest, testProcessingMode }; 