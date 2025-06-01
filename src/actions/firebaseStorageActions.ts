
"use server";

import { firebaseAdmin } from '@/lib/firebaseAdmin';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';

export async function getStorageBucket(): Promise<string | undefined> {
  return process.env?.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
}

export async function uploadAudioToFirebaseStorage(audioDataUri: string, userId: string, storyId: string, filename: string): Promise<string> {
  if (!firebaseAdmin.apps.length || !firebaseAdmin.app()) { throw new Error("Firebase Admin SDK app not initialized."); }
  const adminAppInstance = firebaseAdmin.app();
  const storage = getAdminStorage(adminAppInstance);
  const bucketName = await getStorageBucket(); // Await the async function
  if (!bucketName) { throw new Error("Firebase Storage bucket name not configured."); }
  const bucket = storage.bucket(bucketName);
  let base64Data: string; let contentType: string;
  if (audioDataUri.startsWith('data:audio/mpeg;base64,')) { base64Data = audioDataUri.substring('data:audio/mpeg;base64,'.length); contentType = 'audio/mpeg'; }
  else if (audioDataUri.startsWith('data:audio/wav;base64,')) { base64Data = audioDataUri.substring('data:audio/wav;base64,'.length); contentType = 'audio/wav'; }
  else { throw new Error('Invalid audio data URI format.'); }
  const audioBuffer = Buffer.from(base64Data, 'base64');
  const filePath = `users/${userId}/stories/${storyId}/narration_chunks/${filename}`;
  const file = bucket.file(filePath);
  await file.save(audioBuffer, { metadata: { contentType: contentType } });
  const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 1000 * 60 * 60 * 24 * 7 });
  return signedUrl;
}

export async function refreshFirebaseStorageUrl(url: string, userId: string, storyId: string, filePath?: string): Promise<string | null> {
  if (!url || typeof url !== 'string') return null;

  const bucketName = await getStorageBucket(); // Await the async function
  if (!bucketName || !url.includes(bucketName)) return null;

  try {
    console.log(`[refreshFirebaseStorageUrl] Refreshing signed URL for: ${url}`);

    if (!firebaseAdmin.apps.length || !firebaseAdmin.app()) {
      console.error("[refreshFirebaseStorageUrl] Firebase Admin SDK app is not initialized.");
      return null;
    }

    const adminAppInstance = firebaseAdmin.app();
    const storage = getAdminStorage(adminAppInstance);
    const bucket = storage.bucket(bucketName);

    if (!filePath) {
      try {
        const urlObj = new URL(url);
        const pathMatch = urlObj.pathname.match(/\/o\/(.+?)(?:\?|$)/);
        if (pathMatch && pathMatch[1]) {
          filePath = decodeURIComponent(pathMatch[1]);
          console.log(`[refreshFirebaseStorageUrl] Extracted file path from URL: ${filePath}`);
        } else {
          console.warn(`[refreshFirebaseStorageUrl] Unable to extract file path from URL: ${url}`);
          return null;
        }
      } catch (error) {
        console.warn(`[refreshFirebaseStorageUrl] URL parsing failed for: ${url}`, error);
        return null;
      }
    }

    const file = bucket.file(filePath);

    const [exists] = await file.exists();
    if (!exists) {
      console.warn(`[refreshFirebaseStorageUrl] File does not exist at path: ${filePath}`);
      return null;
    }

    const [signedUrlResult] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 1000 * 60 * 60 * 24 * 7 // 7 days
    });

    console.log(`[refreshFirebaseStorageUrl] Generated new signed URL valid for 7 days: ${signedUrlResult}`);
    return signedUrlResult;
  } catch (error) {
    console.error("[refreshFirebaseStorageUrl] Error refreshing signed URL:", error);
    return null;
  }
}

export async function uploadImageToFirebaseStorage(imageUrl: string, userId: string, storyId: string, imageName: string): Promise<string> {
  if (!firebaseAdmin.apps.length || !firebaseAdmin.app()) { throw new Error("Firebase Admin SDK app not initialized."); }
  const adminAppInstance = firebaseAdmin.app();
  const storage = getAdminStorage(adminAppInstance);
  const bucketName = await getStorageBucket(); // Await the async function
  if (!bucketName) { throw new Error("Firebase Storage bucket name not configured."); }
  const bucket = storage.bucket(bucketName);
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) { throw new Error(`Failed to fetch image from URL: ${response.statusText}`); }
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const filePath = `users/${userId}/stories/${storyId}/images/${imageName}.jpg`; // Assuming jpg, adjust if needed
    const file = bucket.file(filePath);
    await file.save(imageBuffer, { metadata: { contentType: contentType } });
    const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 1000 * 60 * 60 * 24 * 7 });
    return signedUrl;
  } catch (error) { throw error; }
}


export async function uploadImageBufferToFirebaseStorage(imageBuffer: Buffer, userId: string, storyId: string, imageName: string, contentType: string): Promise<string> {
  if (!firebaseAdmin.apps.length || !firebaseAdmin.app()) { throw new Error("Firebase Admin SDK app not initialized."); }
  const adminAppInstance = firebaseAdmin.app();
  const storage = getAdminStorage(adminAppInstance);
  const bucketName = await getStorageBucket(); // Await the async function
  if (!bucketName) { throw new Error("Firebase Storage bucket name not configured."); }
  const bucket = storage.bucket(bucketName);
  try {
    // ensure imageName does not start or end with slashes and has an extension
    let cleanImageName = imageName.replace(/^\/+|\/+$/g, '');
    if (!/\.[^/.]+$/.test(cleanImageName)) {
        cleanImageName += '.png'; // Default to png if no extension
    }

    const filePath = `users/${userId}/stories/${storyId}/images/${cleanImageName}`;
    const file = bucket.file(filePath);
    await file.save(imageBuffer, { metadata: { contentType: contentType } });
    const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 1000 * 60 * 60 * 24 * 7 });
    return signedUrl;
  } catch (error) { throw error; }
}


export async function deleteFolderFromFirebaseStorage(folderPath: string): Promise<void> {
  if (!firebaseAdmin.apps.length || !firebaseAdmin.app()) {
    throw new Error("Firebase Admin SDK app not initialized.");
  }
  const adminAppInstance = firebaseAdmin.app();
  const storage = getAdminStorage(adminAppInstance);
  const bucketName = await getStorageBucket(); // Await the async function
  if (!bucketName) {
    throw new Error("Firebase Storage bucket name is not configured.");
  }
  const bucket = storage.bucket(bucketName);

  try {
    console.log(`Attempting to delete folder: ${folderPath} in bucket: ${bucketName}`);
    const [files] = await bucket.getFiles({ prefix: folderPath });
    if (files.length > 0) {
      const deletePromises = files.map(file => {
        console.log(`Deleting file: ${file.name}`);
        return file.delete().catch(error => {
          // Log individual file deletion errors but don't let them stop the whole process
          console.error(`Failed to delete file ${file.name}:`, error);
        });
      });
      await Promise.all(deletePromises);
      console.log(`Successfully deleted ${deletePromises.length} files from folder ${folderPath}.`);
    } else {
      console.log(`No files found in folder ${folderPath} to delete.`);
    }
  } catch (error) {
    console.error(`Error deleting folder ${folderPath} from Firebase Storage:`, error);
    // Decide if you want to re-throw or handle. For cleanup, often best to log and continue.
    // throw error; // Re-throwing will make the calling function fail
  }
}
