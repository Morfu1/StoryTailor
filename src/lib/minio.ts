/**
 * MinIO S3-compatible storage service
 * Replacement for Firebase Storage
 */

import * as Minio from 'minio';

// Force Node.js to prefer IPv4 to avoid IPv6 connection issues
process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --dns-result-order=ipv4first';

// MinIO configuration from environment
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'http://localhost:9100';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'admin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'Maslina12#Calda';
const MINIO_BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'storytailor-media';
const MINIO_REGION = process.env.MINIO_REGION || 'us-east-1';

// Debug: Log the loaded environment variables
console.log('🔧 MinIO Configuration Debug:');
console.log('  MINIO_ENDPOINT:', MINIO_ENDPOINT);
console.log('  MINIO_ACCESS_KEY:', MINIO_ACCESS_KEY);
console.log('  MINIO_SECRET_KEY:', MINIO_SECRET_KEY ? '***' + MINIO_SECRET_KEY.slice(-4) : 'undefined');
console.log('  MINIO_BUCKET_NAME:', MINIO_BUCKET_NAME);
console.log('  MINIO_REGION:', MINIO_REGION);

// Create MinIO client lazily to ensure environment variables are loaded
let minioClient: Minio.Client | null = null;

function getMinioClient(): Minio.Client {
  if (!minioClient) {
    // Parse endpoint for MinIO client
    const endpointUrl = new URL(MINIO_ENDPOINT);

    // Compare with hardcoded values that worked
    // const hardcodedConfig = {
    //   endPoint: 'minio-api.holoanima.com',
    //   port: 443,
    //   useSSL: true,
    //   accessKey: 'admin',
    //   secretKey: 'Maslina12#Calda',
    //   region: 'us-east-1'
    // };

    // MinIO client using environment variables
    const clientConfig = {
      endPoint: endpointUrl.hostname,          // ✅ Hostname from MINIO_ENDPOINT
      port: endpointUrl.port ? parseInt(endpointUrl.port) : (endpointUrl.protocol === 'https:' ? 443 : 80),
      useSSL: endpointUrl.protocol === 'https:', // ✅ SSL based on protocol
      accessKey: MINIO_ACCESS_KEY,             // ✅ From environment
      secretKey: MINIO_SECRET_KEY,             // ✅ From environment  
      region: MINIO_REGION                     // ✅ From environment
    };

    console.log('🔧 Creating MinIO Client with Environment Variables:');
    console.log('  endPoint:', JSON.stringify(clientConfig.endPoint));
    console.log('  port:', clientConfig.port);
    console.log('  useSSL:', clientConfig.useSSL);
    console.log('  accessKey:', JSON.stringify(clientConfig.accessKey));
    console.log('  secretKey:', JSON.stringify(clientConfig.secretKey));
    console.log('  region:', JSON.stringify(clientConfig.region));

    minioClient = new Minio.Client(clientConfig);
  }
  return minioClient;
}

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
      console.log('Testing MinIO connection with endpoint:', MINIO_ENDPOINT);
      const client = getMinioClient();
      await client.bucketExists(MINIO_BUCKET_NAME);
      return true;
    } catch (error: unknown) {
      console.log('MinIO connection test failed:', error);
      console.log('Endpoint used:', MINIO_ENDPOINT);
      console.log('Error details:', {
        code: (error as { code?: unknown }).code,
        errno: (error as { errno?: unknown }).errno,
        syscall: (error as { syscall?: unknown }).syscall,
        address: (error as { address?: unknown }).address,
        port: (error as { port?: unknown }).port
      });
      return false;
    }
  }

  /**
   * Create the main bucket if it doesn't exist
   */
  async createBucket(): Promise<void> {
    try {
      const client = getMinioClient();
      const exists = await client.bucketExists(MINIO_BUCKET_NAME);
      if (!exists) {
        await client.makeBucket(MINIO_BUCKET_NAME, MINIO_REGION);
        console.log(`Bucket '${MINIO_BUCKET_NAME}' created successfully`);
      } else {
        console.log(`Bucket '${MINIO_BUCKET_NAME}' already exists`);
      }
    } catch (error: unknown) {
      console.error('Error creating bucket:', error);
      throw error;
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
    console.log('Uploading to MinIO with endpoint:', MINIO_ENDPOINT);
    console.log('Bucket:', MINIO_BUCKET_NAME, 'Key:', key);
    console.log('Buffer size:', buffer.length, 'Content-Type:', contentType);
    
    // Test connection first
    const connectionTest = await this.testConnection();
    if (!connectionTest) {
      throw new Error('MinIO connection test failed. Please check network connectivity and endpoint configuration.');
    }
    console.log('MinIO connection test passed');
    
    try {
      const metadata = {
        'Content-Type': contentType
      };
      
      const client = getMinioClient();
      await client.putObject(MINIO_BUCKET_NAME, key, buffer, buffer.length, metadata);
      console.log('MinIO upload successful');
      return `${MINIO_ENDPOINT}/${MINIO_BUCKET_NAME}/${key}`;
    } catch (error: unknown) {
      console.error('MinIO upload failed:', error);
      console.error('Upload error details:', {
        code: (error as { code?: unknown }).code,
        errno: (error as { errno?: unknown }).errno,
        syscall: (error as { syscall?: unknown }).syscall,
        address: (error as { address?: unknown }).address,
        port: (error as { port?: unknown }).port,
        message: (error as { message?: unknown }).message
      });
      
      // More descriptive error message
      if ((error as { code?: unknown }).code === 'EHOSTUNREACH') {
        throw new Error(`Cannot reach MinIO server at ${MINIO_ENDPOINT}. This may be due to network connectivity issues or IPv6 resolution problems. Please check your network configuration.`);
      }
      
      throw error;
    }
  }

  /**
   * Download a file from MinIO
   * @param key File path/key in the bucket
   * @returns File content as Buffer
   */
  async downloadFile(key: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const client = getMinioClient();
      client.getObject(MINIO_BUCKET_NAME, key, (err, dataStream) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!dataStream) {
          reject(new Error(`File not found: ${key}`));
          return;
        }

        dataStream.on('data', (chunk) => chunks.push(chunk));
        dataStream.on('error', reject);
        dataStream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    });
  }

  /**
   * Generate a presigned URL for secure file access
   * @param key File path/key in the bucket
   * @param expiresIn Expiration time in seconds (default: 7 days)
   * @returns Presigned URL
   */
  async getSignedUrl(key: string, expiresIn = 7 * 24 * 60 * 60): Promise<string> {
    const client = getMinioClient();
    // Add response headers for CORS and content type
    const reqParams = {
      'response-content-type': 'audio/wav',
      'response-cache-control': 'no-cache'
    };
    return await client.presignedGetObject(MINIO_BUCKET_NAME, key, expiresIn, reqParams);
  }

  /**
   * Delete a file from MinIO
   * @param key File path/key in the bucket
   */
  async deleteFile(key: string): Promise<void> {
    const client = getMinioClient();
    await client.removeObject(MINIO_BUCKET_NAME, key);
  }

  /**
   * List files with optional prefix filter
   * @param prefix Optional prefix to filter files
   * @returns Array of file keys
   */
  async listFiles(prefix?: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const objects: string[] = [];
      const client = getMinioClient();
      const stream = client.listObjects(MINIO_BUCKET_NAME, prefix, true);
      
      stream.on('data', (obj) => {
        if (obj.name) {
          objects.push(obj.name);
        }
      });
      
      stream.on('error', reject);
      stream.on('end', () => resolve(objects));
    });
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

// Export MinIO client getter for advanced operations
export { getMinioClient };
