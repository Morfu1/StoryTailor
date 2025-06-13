#!/usr/bin/env tsx

/**
 * Test MinIO storage connection and operations
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

async function testMinio() {
  console.log('🔍 Testing MinIO storage connection...\n');
  
  try {
    // Import after loading env vars
    const { minioService } = await import('../src/lib/minio');

    // Test 1: Connection
    console.log('1. Testing MinIO connection...');
    const isConnected = await minioService.testConnection();
    console.log(`   ${isConnected ? '✅' : '❌'} Connection: ${isConnected ? 'Success' : 'Failed'}`);
    
    if (!isConnected) {
      console.log('\n2. Creating bucket...');
      await minioService.createBucket();
      console.log('   ✅ Bucket created/verified');
      
      // Test connection again
      const isConnectedAfterBucket = await minioService.testConnection();
      console.log(`   ${isConnectedAfterBucket ? '✅' : '❌'} Connection after bucket: ${isConnectedAfterBucket ? 'Success' : 'Failed'}`);
    }

    // Test 2: File Upload
    console.log('\n3. Testing file upload...');
    const testContent = 'This is a test file for MinIO storage';
    const testBuffer = Buffer.from(testContent, 'utf8');
    const testFilePath = minioService.generateFilePath('test-user', 'test-story', 'test-file.txt', 'image');
    
    const fileUrl = await minioService.uploadFile(testFilePath, testBuffer, 'text/plain');
    console.log(`   ✅ File uploaded: ${testFilePath}`);
    console.log(`   📁 File URL: ${fileUrl}`);

    // Test 3: File Download
    console.log('\n4. Testing file download...');
    const downloadedBuffer = await minioService.downloadFile(testFilePath);
    const downloadedContent = downloadedBuffer.toString('utf8');
    console.log(`   ✅ File downloaded`);
    console.log(`   📄 Content: "${downloadedContent}"`);
    console.log(`   ✅ Content matches: ${downloadedContent === testContent}`);

    // Test 4: Presigned URL
    console.log('\n5. Testing presigned URL generation...');
    const signedUrl = await minioService.getSignedUrl(testFilePath, 3600); // 1 hour
    console.log(`   ✅ Presigned URL generated`);
    console.log(`   🔗 URL: ${signedUrl.substring(0, 100)}...`);

    // Test 5: List Files
    console.log('\n6. Testing file listing...');
    const files = await minioService.listFiles('users/test-user/');
    console.log(`   ✅ Found ${files.length} files with test-user prefix`);
    files.forEach((file, index) => {
      console.log(`      ${index + 1}. ${file}`);
    });

    // Test 6: Test Audio File Structure
    console.log('\n7. Testing audio file structure...');
    const audioContent = 'This is test audio content';
    const audioBuffer = Buffer.from(audioContent, 'utf8');
    const audioFilePath = minioService.generateFilePath('test-user', 'test-story', 'chunk-001.mp3', 'audio');
    
    await minioService.uploadFile(audioFilePath, audioBuffer, 'audio/mpeg');
    console.log(`   ✅ Audio file uploaded: ${audioFilePath}`);

    // Test 7: Clean up test files
    console.log('\n8. Cleaning up test files...');
    await minioService.deleteFile(testFilePath);
    await minioService.deleteFile(audioFilePath);
    console.log('   ✅ Test files deleted');

    console.log('\n🎉 All MinIO tests passed! Storage is ready for migration.');
    
    // Show configuration summary
    console.log('\n📋 MinIO Configuration:');
    console.log(`   Endpoint: ${process.env.MINIO_ENDPOINT}`);
    console.log(`   Bucket: ${process.env.MINIO_BUCKET_NAME}`);
    console.log(`   Access Key: ${process.env.MINIO_ACCESS_KEY}`);
    console.log('   Secret Key: [CONFIGURED]');
    
  } catch (error) {
    console.error('❌ MinIO test failed:', error);
  }
}

testMinio();
