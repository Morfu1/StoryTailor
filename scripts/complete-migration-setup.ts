#!/usr/bin/env tsx

/**
 * Complete migration setup validation
 * Verify all components are ready for Firebase to Baserow+MinIO migration
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

async function validateMigrationSetup() {
  console.log('🔍 Validating complete migration setup...\n');
  
  let allTestsPassed = true;
  
  try {
    // Test 1: Baserow Stories Table
    console.log('1. Testing Baserow stories table...');
    const { baserowService } = await import('../src/lib/baserow');
    
    const isBaserowConnected = await baserowService.testConnection();
    if (isBaserowConnected) {
      const fields = await baserowService.getTableFields();
      console.log(`   ✅ Baserow connected - ${fields.length} fields configured`);
      
      // Test story creation
      const testStory = {
        firebase_story_id: 'migration-test-' + Date.now(),
        user_id: 'migration-test-user',
        Title: 'Migration Test Story',
        content: 'This is a test story for migration validation',
        'Single select': 'draft',
        created_at: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString().split('T')[0],
        narration_audio_url: 'https://example.com/test.mp3',
        settings: JSON.stringify({ test: true })
      };
      
      const createdStory = await baserowService.createStory(testStory);
      await baserowService.deleteStory(createdStory.id);
      console.log('   ✅ Story CRUD operations working');
    } else {
      console.log('   ❌ Baserow connection failed');
      allTestsPassed = false;
    }
    
    // Test 2: Environment Variables
    console.log('\n2. Checking environment variables...');
    const requiredEnvVars = [
      'BASEROW_API_URL',
      'BASEROW_TOKEN', 
      'BASEROW_STORIES_TABLE_ID',
      'BASEROW_USER_API_KEYS_TABLE_ID',
      'MINIO_ENDPOINT',
      'MINIO_ACCESS_KEY',
      'MINIO_SECRET_KEY',
      'MINIO_BUCKET_NAME'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length === 0) {
      console.log('   ✅ All required environment variables are set');
    } else {
      console.log(`   ❌ Missing environment variables: ${missingVars.join(', ')}`);
      allTestsPassed = false;
    }
    
    // Test 3: MinIO via Docker Client
    console.log('\n3. Testing MinIO storage via Docker client...');
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    try {
      // Test MinIO access via docker exec
      await execAsync('docker exec minio mc ls local/storytailor-media/');
      console.log('   ✅ MinIO accessible via Docker client');
      
      // Test file operations
      await execAsync('echo "test content" | docker exec -i minio mc pipe local/storytailor-media/test-migration.txt');
      await execAsync('docker exec minio mc rm local/storytailor-media/test-migration.txt');
      console.log('   ✅ MinIO file operations working');
      
    } catch (error) {
      console.log('   ❌ MinIO operations failed:', error);
      allTestsPassed = false;
    }
    
    // Test 4: Database Schema Compatibility
    console.log('\n4. Validating database schema...');
    const fields = await baserowService.getTableFields();
    
    const requiredFields = [
      'firebase_story_id',
      'user_id', 
      'Title',
      'content',
      'Single select', // status
      'created_at',
      'updated_at',
      'narration_audio_url',
      'generated_images',
      'narration_chunks',
      'timeline_tracks',
      'settings'
    ];
    
    const fieldNames = fields.map((f: any) => f.name);
    const missingFields = requiredFields.filter(field => !fieldNames.includes(field));
    
    if (missingFields.length === 0) {
      console.log(`   ✅ All required fields present (${fields.length} total)`);
    } else {
      console.log(`   ❌ Missing required fields: ${missingFields.join(', ')}`);
      allTestsPassed = false;
    }
    
    // Migration Summary
    console.log('\n📋 Migration Setup Summary:');
    console.log(`   Baserow Stories Table ID: ${process.env.BASEROW_STORIES_TABLE_ID}`);
    console.log(`   Baserow API Keys Table ID: ${process.env.BASEROW_USER_API_KEYS_TABLE_ID}`);
    console.log(`   MinIO Bucket: ${process.env.MINIO_BUCKET_NAME}`);
    console.log(`   MinIO Endpoint: ${process.env.MINIO_ENDPOINT}`);
    
    if (allTestsPassed) {
      console.log('\n🎉 Migration setup validation PASSED!');
      console.log('✅ Ready to proceed with Firebase data migration');
      console.log('\nNext steps:');
      console.log('1. Export Firebase data (if credentials available)');
      console.log('2. Transform and import data to Baserow');
      console.log('3. Migrate storage files to MinIO');
      console.log('4. Update application code to use new services');
      console.log('5. Test end-to-end functionality');
    } else {
      console.log('\n❌ Migration setup validation FAILED!');
      console.log('Please fix the issues above before proceeding with migration.');
    }
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
  }
}

validateMigrationSetup();
