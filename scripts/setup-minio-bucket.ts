#!/usr/bin/env tsx

/**
 * Setup MinIO bucket with proper permissions
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { S3Client, CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3';

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'http://192.168.31.251:9100';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'admin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'Maslina12#Calda';
const MINIO_BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'storytailor-media';

const s3Client = new S3Client({
  endpoint: MINIO_ENDPOINT,
  credentials: {
    accessKeyId: MINIO_ACCESS_KEY,
    secretAccessKey: MINIO_SECRET_KEY
  },
  region: 'us-east-1',
  forcePathStyle: true
});

async function setupBucket() {
  console.log('🔧 Setting up MinIO bucket...\n');
  
  try {
    // Check if bucket exists
    console.log('1. Checking if bucket exists...');
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET_NAME }));
      console.log(`   ✅ Bucket ${MINIO_BUCKET_NAME} already exists`);
    } catch (error: any) {
      if (error.$metadata?.httpStatusCode === 404) {
        console.log(`   📝 Creating bucket ${MINIO_BUCKET_NAME}...`);
        await s3Client.send(new CreateBucketCommand({ Bucket: MINIO_BUCKET_NAME }));
        console.log(`   ✅ Bucket created successfully`);
      } else {
        throw error;
      }
    }
    
    // Set bucket policy for read access
    console.log('\n2. Setting bucket policy...');
    const bucketPolicy = {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: "*",
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${MINIO_BUCKET_NAME}/*`]
        },
        {
          Effect: "Allow",
          Principal: "*",
          Action: ["s3:ListBucket"],
          Resource: [`arn:aws:s3:::${MINIO_BUCKET_NAME}`]
        }
      ]
    };
    
    try {
      await s3Client.send(new PutBucketPolicyCommand({
        Bucket: MINIO_BUCKET_NAME,
        Policy: JSON.stringify(bucketPolicy)
      }));
      console.log('   ✅ Bucket policy set successfully');
    } catch (error) {
      console.log('   ⚠️  Could not set bucket policy (bucket still usable):', error);
    }
    
    console.log('\n🎉 MinIO bucket setup completed!');
    console.log(`   Bucket: ${MINIO_BUCKET_NAME}`);
    console.log(`   Endpoint: ${MINIO_ENDPOINT}`);
    
  } catch (error) {
    console.error('❌ Bucket setup failed:', error);
  }
}

setupBucket();
