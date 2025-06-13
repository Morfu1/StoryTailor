#!/usr/bin/env tsx

/**
 * Test Baserow connection and service
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

async function testConnection() {
  console.log('🔍 Testing Baserow connection...\n');
  
  try {
    // Import after loading env vars
    const { baserowService } = await import('../src/lib/baserow');
    // Test basic connection
    console.log('1. Testing connection...');
    const isConnected = await baserowService.testConnection();
    console.log(`   ${isConnected ? '✅' : '❌'} Connection: ${isConnected ? 'Success' : 'Failed'}`);
    
    if (!isConnected) {
      return;
    }
    
    // Test getting fields
    console.log('\n2. Getting table fields...');
    const fields = await baserowService.getTableFields();
    console.log(`   ✅ Found ${fields.length} fields:`);
    fields.forEach((field: any) => {
      console.log(`      - ${field.name} (${field.type}, id: ${field.id})`);
    });
    
    // Test getting stories
    console.log('\n3. Getting stories...');
    const stories = await baserowService.getStories();
    console.log(`   ✅ Found ${stories.length} stories`);
    
    if (stories.length > 0) {
      console.log('   📝 Sample story:');
      const sample = stories[0];
      console.log(`      ID: ${sample.id}`);
      console.log(`      Title: ${sample.Title || 'No title'}`);
      console.log(`      User ID: ${sample.user_id || 'No user ID'}`);
    }
    
    // Test creating a story
    console.log('\n4. Testing story creation...');
    const testStory = {
      firebase_story_id: 'test-story-' + Date.now(),
      user_id: 'test-user',
      Title: 'Test Story from API',
      content: 'This is a test story created via the Baserow API',
      'Single select': 'draft',
      created_at: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString().split('T')[0]
    };
    
    const createdStory = await baserowService.createStory(testStory);
    console.log(`   ✅ Created story with ID: ${createdStory.id}`);
    
    // Test updating the story
    console.log('\n5. Testing story update...');
    const updates = {
      Title: 'Updated Test Story',
      'Single select': 'completed'
    };
    
    const updatedStory = await baserowService.updateStory(createdStory.id, updates);
    console.log(`   ✅ Updated story: ${updatedStory.Title}`);
    
    // Test deleting the story
    console.log('\n6. Testing story deletion...');
    await baserowService.deleteStory(createdStory.id);
    console.log(`   ✅ Deleted test story`);
    
    console.log('\n🎉 All tests passed! Baserow integration is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testConnection();
