#!/usr/bin/env tsx

/**
 * Check MinIO access and credentials
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

async function checkMinioAccess() {
  console.log('🔍 Checking MinIO access...\n');
  
  // Show current configuration
  console.log('📋 Current MinIO Configuration:');
  console.log(`   Endpoint: ${process.env.MINIO_ENDPOINT}`);
  console.log(`   Access Key: ${process.env.MINIO_ACCESS_KEY}`);
  console.log(`   Secret Key: ${process.env.MINIO_SECRET_KEY?.substring(0, 4)}***`);
  console.log(`   Bucket: ${process.env.MINIO_BUCKET_NAME}`);
  console.log(`   Region: ${process.env.MINIO_REGION}`);
  
  // Test HTTP connection to MinIO endpoint
  console.log('\n1. Testing HTTP connection to MinIO...');
  try {
    const response = await fetch(`${process.env.MINIO_ENDPOINT}/minio/health/live`);
    console.log(`   ✅ MinIO is accessible - Status: ${response.status}`);
  } catch (error) {
    console.log(`   ❌ Cannot reach MinIO endpoint: ${error}`);
    return;
  }
  
  // Test console access
  console.log('\n2. Testing MinIO Console access...');
  try {
    const consoleResponse = await fetch('http://192.168.31.251:9101');
    console.log(`   ✅ MinIO Console accessible - Status: ${consoleResponse.status}`);
  } catch (error) {
    console.log(`   ❌ Cannot reach MinIO console: ${error}`);
  }
  
  console.log('\n💡 Manual verification steps:');
  console.log('   1. Open MinIO Console: http://192.168.31.251:9101');
  console.log('   2. Login with credentials: admin / Maslina12#Calda');
  console.log('   3. Check if storytailor-media bucket exists');
  console.log('   4. Verify access permissions for the bucket');
  
  console.log('\n🔧 If credentials are wrong, check:');
  console.log('   - MinIO container environment variables');
  console.log('   - Access key/secret key in .env.local');
  console.log('   - Bucket permissions');
}

checkMinioAccess();
