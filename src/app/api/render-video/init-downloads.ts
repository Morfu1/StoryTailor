import fs from 'fs';
import path from 'path';

/**
 * Ensures that the downloads directory exists
 */
export function ensureDownloadsDirectory() {
  // Create directory if it doesn't exist
  const downloadDir = path.join(process.cwd(), 'public', 'downloads', 'videos');
  fs.mkdirSync(downloadDir, { recursive: true });
  return downloadDir;
}