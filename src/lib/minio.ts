/**
 * MinIO S3-compatible storage service
 * Replacement for Firebase Storage
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// MinIO configuration from environment
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'http://localhost:9100';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'admin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'Maslina12#Calda';
const MINIO_BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'storytailor-media';
const MINIO_REGION = process.env.MINIO_REGION || 'us-east-1';

// Create S3 client configured for MinIO
const s3Client = new S3Client({
  endpoint: MINIO_ENDPOINT,
  credentials: {
    accessKeyId: MINIO_ACCESS_KEY,
    secretAccessKey: MINIO_SECRET_KEY
  },
  region: MINIO_REGION,
  forcePathStyle: true // Required for MinIO
});

export interface StorageService {
  testConnection(): Promise<boolean>;
  createBucket(): Promise<void>;
  uploadFile(key: string, buffer: Buffer, contentType?: string): Promise<string>;
  downloadFile(key: string): Promise<Buffer>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  deleteFile(key: string): Promise<void>;
  listFiles(prefix?: string): Promise<string[]>;
}

class MinIOStorageService implements StorageService {
  
  /**
   * Test connection to MinIO
   */
  async testConnection(): Promise<boolean> {
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET_NAME }));
      return true;
    } catch (error) {
      console.log('MinIO connection test failed:', error);
      return false;
    }
  }

  /**
   * Create the main bucket if it doesn't exist
   */
  async createBucket(): Promise<void> {
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET_NAME }));
      console.log(`Bucket ${MINIO_BUCKET_NAME} already exists`);
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        console.log(`Creating bucket ${MINIO_BUCKET_NAME}`);
        await s3Client.send(new CreateBucketCommand({ Bucket: MINIO_BUCKET_NAME }));
        console.log(`Bucket ${MINIO_BUCKET_NAME} created successfully`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Upload a file to MinIO
   * @param key File path/key in the bucket
   * @param buffer File content as Buffer
   * @param contentType MIME type of the file
   * @returns The file URL
   */
  async uploadFile(key: string, buffer: Buffer, contentType = 'application/octet-stream'): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: MINIO_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType
    });

    await s3Client.send(command);
    return `${MINIO_ENDPOINT}/${MINIO_BUCKET_NAME}/${key}`;
  }

  /**
   * Download a file from MinIO
   * @param key File path/key in the bucket
   * @returns File content as Buffer
   */
  async downloadFile(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: MINIO_BUCKET_NAME,
      Key: key
    });

    const response = await s3Client.send(command);
    
    if (!response.Body) {
      throw new Error(`File not found: ${key}`);
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    const reader = response.Body as any;
    
    for await (const chunk of reader) {
      chunks.push(chunk);
    }
    
    return Buffer.concat(chunks);
  }

  /**
   * Generate a presigned URL for secure file access
   * @param key File path/key in the bucket
   * @param expiresIn Expiration time in seconds (default: 7 days)
   * @returns Presigned URL
   */
  async getSignedUrl(key: string, expiresIn = 7 * 24 * 60 * 60): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: MINIO_BUCKET_NAME,
      Key: key
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  }

  /**
   * Delete a file from MinIO
   * @param key File path/key in the bucket
   */
  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: MINIO_BUCKET_NAME,
      Key: key
    });

    await s3Client.send(command);
  }

  /**
   * List files with optional prefix filter
   * @param prefix Optional prefix to filter files
   * @returns Array of file keys
   */
  async listFiles(prefix?: string): Promise<string[]> {
    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    
    const command = new ListObjectsV2Command({
      Bucket: MINIO_BUCKET_NAME,
      Prefix: prefix
    });

    const response = await s3Client.send(command);
    return response.Contents?.map(obj => obj.Key || '') || [];
  }

  /**
   * Generate file path based on Firebase Storage structure
   * @param userId User ID
   * @param storyId Story ID  
   * @param filename File name
   * @param type File type ('audio' | 'image')
   * @returns File path
   */
  generateFilePath(userId: string, storyId: string, filename: string, type: 'audio' | 'image'): string {
    const folder = type === 'audio' ? 'narration_chunks' : 'images';
    return `users/${userId}/stories/${storyId}/${folder}/${filename}`;
  }
}

// Export the service instance
export const minioService = new MinIOStorageService();

// Export S3 client for advanced operations
export { s3Client };
