#!/usr/bin/env node

/**
 * Performance Test Script for Categorizer Improvements
 * Run with: node test-performance.js
 */

const BASE_URL = 'http://localhost:3000/api';

// Test data
const testCategories = ['Technology', 'Business', 'Education', 'Entertainment'];
const testLanguages = [
  { name: 'English', code: 'en', priority: 1 },
  { name: 'Spanish', code: 'es', priority: 2 },
  { name: 'French', code: 'fr', priority: 3 }
];
const testWords = [
  'computer', 'ordenador', 'ordinateur', 
  'business', 'negocio', 'entreprise',
  'school', 'escuela', 'école',
  'movie', 'película', 'film'
];

async function makeRequest(endpoint, options = {}) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  return response.json();
}

async function setupTestData() {
  console.log('🔧 Setting up test data...');
  
  // Add categories
  for (const category of testCategories) {
    try {
      await makeRequest('/categories', {
        method: 'POST',
        body: JSON.stringify({ name: category })
      });
      console.log(`✅ Added category: ${category}`);
    } catch (error) {
      console.log(`⚠️  Category ${category} might already exist`);
    }
  }
  
  // Add languages
  for (const language of testLanguages) {
    try {
      await makeRequest('/languages', {
        method: 'POST',
        body: JSON.stringify(language)
      });
      console.log(`✅ Added language: ${language.name}`);
    } catch (error) {
      console.log(`⚠️  Language ${language.name} might already exist`);
    }
  }
  
  // Add words
  for (const word of testWords) {
    try {
      await makeRequest('/words', {
        method: 'POST',
        body: JSON.stringify({ word })
      });
      console.log(`✅ Added word: ${word}`);
    } catch (error) {
      console.log(`⚠️  Word ${word} might already exist`);
    }
  }
}

async function testCaching() {
  console.log('\n🧪 Testing database caching...');
  
  const start1 = Date.now();
  await makeRequest('/categories');
  const time1 = Date.now() - start1;
  console.log(`First categories fetch: ${time1}ms`);
  
  const start2 = Date.now();
  await makeRequest('/categories');
  const time2 = Date.now() - start2;
  console.log(`Second categories fetch (cached): ${time2}ms`);
  
  if (time2 < time1) {
    console.log('✅ Caching appears to be working!');
  } else {
    console.log('⚠️  Caching might not be active or network variance');
  }
}

async function testProcessingPerformance() {
  console.log('\n🚀 Testing processing performance...');
  
  // Test optimized processing
  console.log('Testing optimized processing (default prompts)...');
  const startOptimized = Date.now();
  
  try {
    const response = await fetch(`${BASE_URL}/process-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'parallel'
        // No custom prompts = uses optimized version
      })
    });
    
    if (response.ok) {
      console.log('✅ Optimized processing endpoint responding');
      // Note: In a real test, you'd process the stream
      response.body?.cancel(); // Cancel the stream for testing
    }
  } catch (error) {
    console.log('❌ Error testing optimized processing:', error.message);
  }
  
  const timeOptimized = Date.now() - startOptimized;
  console.log(`Optimized processing setup time: ${timeOptimized}ms`);
}

async function testDuplicateHandling() {
  console.log('\n🔄 Testing duplicate word handling...');
  
  const testWord = 'duplicate-test-' + Date.now();
  
  try {
    // Add the same word twice quickly (simulating race condition)
    const promises = [
      makeRequest('/words', {
        method: 'POST',
        body: JSON.stringify({ word: testWord })
      }),
      makeRequest('/words', {
        method: 'POST',
        body: JSON.stringify({ word: testWord })
      })
    ];
    
    await Promise.allSettled(promises);
    
    // Check how many instances exist
    const words = await makeRequest('/words');
    const duplicates = words.filter(w => w.word === testWord);
    
    if (duplicates.length === 1) {
      console.log('✅ Duplicate handling working correctly');
    } else {
      console.log(`⚠️  Found ${duplicates.length} instances of test word`);
    }
    
  } catch (error) {
    console.log('❌ Error testing duplicate handling:', error.message);
  }
}

async function runTests() {
  console.log('🧪 Starting Performance Tests for Categorizer\n');
  
  try {
    await setupTestData();
    await testCaching();
    await testProcessingPerformance();
    await testDuplicateHandling();
    
    console.log('\n✅ All tests completed!');
    console.log('\n📋 Manual Testing Checklist:');
    console.log('□ Test the main processing page with both modes');
    console.log('□ Test database management operations');
    console.log('□ Test file uploads');
    console.log('□ Monitor browser memory during large processing');
    console.log('□ Test stream disconnection (close browser tab during processing)');
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests, setupTestData, testCaching }; 