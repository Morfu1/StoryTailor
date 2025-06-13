#!/usr/bin/env tsx

/**
 * Add missing fields to Baserow stories table
 * Based on the Firebase Story type structure
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const BASEROW_API_URL = process.env.BASEROW_API_URL || 'http://192.168.31.251:8980/api';
const BASEROW_TOKEN = process.env.BASEROW_TOKEN;
const BASEROW_STORIES_TABLE_ID = process.env.BASEROW_STORIES_TABLE_ID || '696';

interface CreateFieldRequest {
  type: string;
  name: string;
  [key: string]: any;
}

async function apiCall(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
  const url = `${BASEROW_API_URL}${endpoint}`;
  
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Token ${BASEROW_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Baserow API call failed: ${response.status} ${response.statusText}\n${errorText}`);
  }

  if (method === 'DELETE') {
    return null;
  }

  return response.json();
}

async function getExistingFields(): Promise<any[]> {
  const endpoint = `/database/fields/table/${BASEROW_STORIES_TABLE_ID}/`;
  return await apiCall(endpoint);
}

async function createField(field: CreateFieldRequest): Promise<any> {
  const endpoint = `/database/fields/table/${BASEROW_STORIES_TABLE_ID}/`;
  return await apiCall(endpoint, 'POST', field);
}

async function addMissingFields() {
  console.log('🔍 Adding missing fields to Baserow stories table...\n');
  
  try {
    // Get existing fields
    console.log('1. Getting existing fields...');
    const existingFields = await getExistingFields();
    const existingFieldNames = existingFields.map(f => f.name.toLowerCase());
    
    console.log(`   ✅ Found ${existingFields.length} existing fields:`);
    existingFields.forEach(field => {
      console.log(`      - ${field.name} (${field.type})`);
    });
    
    // Define all required fields based on Firebase Story structure
    const requiredFields: CreateFieldRequest[] = [
      // Core story fields (already exist)
      // { type: 'text', name: 'firebase_story_id' }, // already exists
      // { type: 'text', name: 'user_id' }, // already exists  
      // { type: 'text', name: 'title' }, // exists as 'Title'
      // { type: 'long_text', name: 'content' }, // already exists
      // { type: 'single_select', name: 'status', select_options: [...] }, // exists as 'Single select'
      // { type: 'date', name: 'created_at', date_include_time: true }, // already exists
      // { type: 'date', name: 'updated_at', date_include_time: true }, // already exists
      
      // Missing audio/media fields
      { type: 'url', name: 'narration_audio_url' },
      
      // Missing JSON array fields for complex data
      { type: 'long_text', name: 'generated_images' }, // JSON array
      { type: 'long_text', name: 'narration_chunks' }, // JSON array
      { type: 'long_text', name: 'timeline_tracks' }, // JSON array
      { type: 'long_text', name: 'image_prompts' }, // JSON array
      { type: 'long_text', name: 'action_prompts' }, // JSON array
      
      // Missing configuration fields
      { type: 'text', name: 'image_style_id' },
      { type: 'text', name: 'eleven_labs_voice_id' },
      { type: 'text', name: 'narration_voice' },
      
      // Missing JSON object fields
      { type: 'long_text', name: 'details_prompts' }, // JSON object
      { type: 'long_text', name: 'settings' }, // JSON object
      
      // Additional optional fields that might be used
      { type: 'number', name: 'duration' }, // For video/audio duration
      { type: 'text', name: 'language' }, // For story language
      { type: 'text', name: 'genre' }, // For story categorization
      { type: 'long_text', name: 'summary' }, // For story summary
      { type: 'text', name: 'thumbnail_url' }, // For story thumbnail
      { type: 'boolean', name: 'is_public' }, // For public/private stories
      { type: 'number', name: 'views_count' }, // For analytics
      { type: 'number', name: 'likes_count' }, // For social features
      
      // Video generation fields
      { type: 'text', name: 'video_url' }, // Generated video URL
      { type: 'text', name: 'video_status' }, // Video generation status
      { type: 'long_text', name: 'video_settings' }, // Video generation settings JSON
      
      // Error tracking
      { type: 'long_text', name: 'last_error' }, // Last error message
      { type: 'date', name: 'last_error_at', date_include_time: true }, // When error occurred
    ];
    
    console.log('\n2. Adding missing fields...');
    let addedCount = 0;
    let skippedCount = 0;
    
    for (const field of requiredFields) {
      const fieldNameLower = field.name.toLowerCase();
      
      if (existingFieldNames.includes(fieldNameLower)) {
        console.log(`   ⏭️  Skipped: ${field.name} (already exists)`);
        skippedCount++;
        continue;
      }
      
      try {
        const newField = await createField(field);
        console.log(`   ✅ Added: ${field.name} (${field.type}, id: ${newField.id})`);
        addedCount++;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`   ❌ Failed to add ${field.name}:`, error);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   - Fields added: ${addedCount}`);
    console.log(`   - Fields skipped: ${skippedCount}`);
    console.log(`   - Total fields attempted: ${requiredFields.length}`);
    
    // Show final field list
    console.log('\n3. Final field list:');
    const finalFields = await getExistingFields();
    console.log(`   ✅ Total fields: ${finalFields.length}`);
    finalFields.forEach((field, index) => {
      console.log(`   ${(index + 1).toString().padStart(2)}. ${field.name} (${field.type}, id: ${field.id})`);
    });
    
    console.log('\n🎉 Field setup completed! Your Baserow stories table is now ready for Firebase migration.');
    
  } catch (error) {
    console.error('❌ Failed to add fields:', error);
  }
}

addMissingFields();
