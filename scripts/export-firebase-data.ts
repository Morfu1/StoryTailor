#!/usr/bin/env tsx

/**
 * Export Firebase data for migration to Baserow + MinIO
 * Phase 2: Data Migration - Export step
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

async function exportFirebaseData() {
  console.log('🔍 Exporting Firebase data for migration...\n');
  
  try {
    // Import Firebase Admin after loading env vars
    const { dbAdmin } = await import('../src/lib/firebaseAdmin');
    const { getStorage } = await import('firebase-admin/storage');
    
    // Create export directory
    const exportDir = 'migration-export';
    await mkdir(exportDir, { recursive: true });
    console.log(`📁 Created export directory: ${exportDir}`);
    
    // Export Stories
    console.log('\n1. Exporting stories...');
    const storiesSnapshot = await dbAdmin.collection('stories').get();
    const stories = storiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    await writeFile(
      join(exportDir, 'stories.json'), 
      JSON.stringify(stories, null, 2)
    );
    console.log(`   ✅ Exported ${stories.length} stories to stories.json`);
    
    // Show sample story structure
    if (stories.length > 0) {
      console.log('   📝 Sample story structure:');
      const sample = stories[0];
      console.log(`      ID: ${sample.id}`);
      console.log(`      Title: ${sample.title || 'No title'}`);
      console.log(`      User ID: ${sample.userId || 'No user ID'}`);
      console.log(`      Status: ${sample.status || 'No status'}`);
      console.log(`      Created: ${sample.createdAt?.toDate?.() || sample.createdAt || 'No date'}`);
      console.log(`      Fields: ${Object.keys(sample).join(', ')}`);
    }
    
    // Export User API Keys
    console.log('\n2. Exporting user API keys...');
    const apiKeysSnapshot = await dbAdmin.collection('userApiKeys').get();
    const apiKeys = apiKeysSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    await writeFile(
      join(exportDir, 'user-api-keys.json'), 
      JSON.stringify(apiKeys, null, 2)
    );
    console.log(`   ✅ Exported ${apiKeys.length} API keys to user-api-keys.json`);
    
    // Export Firebase Storage file inventory
    console.log('\n3. Inventorying Firebase Storage files...');
    const bucket = getStorage().bucket();
    const [files] = await bucket.getFiles();
    
    const fileInventory = files.map(file => ({
      name: file.name,
      size: file.metadata.size,
      contentType: file.metadata.contentType,
      updated: file.metadata.updated,
      md5Hash: file.metadata.md5Hash
    }));
    
    await writeFile(
      join(exportDir, 'storage-inventory.json'), 
      JSON.stringify(fileInventory, null, 2)
    );
    console.log(`   ✅ Inventoried ${fileInventory.length} storage files`);
    
    // Show storage statistics
    const totalSize = fileInventory.reduce((sum, file) => sum + parseInt(file.size || '0'), 0);
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    console.log(`   📊 Total storage size: ${totalSizeMB} MB`);
    
    // Group files by type
    const filesByType: Record<string, number> = {};
    fileInventory.forEach(file => {
      const type = file.contentType || 'unknown';
      filesByType[type] = (filesByType[type] || 0) + 1;
    });
    
    console.log('   📁 Files by type:');
    Object.entries(filesByType).forEach(([type, count]) => {
      console.log(`      ${type}: ${count} files`);
    });
    
    // Create migration summary
    const migrationSummary = {
      exportDate: new Date().toISOString(),
      stories: {
        count: stories.length,
        fields: stories.length > 0 ? Object.keys(stories[0]) : []
      },
      apiKeys: {
        count: apiKeys.length,
        fields: apiKeys.length > 0 ? Object.keys(apiKeys[0]) : []
      },
      storage: {
        fileCount: fileInventory.length,
        totalSizeMB: parseFloat(totalSizeMB),
        fileTypes: filesByType
      }
    };
    
    await writeFile(
      join(exportDir, 'migration-summary.json'), 
      JSON.stringify(migrationSummary, null, 2)
    );
    
    console.log('\n📋 Migration Summary:');
    console.log(`   Stories: ${migrationSummary.stories.count}`);
    console.log(`   API Keys: ${migrationSummary.apiKeys.count}`);
    console.log(`   Storage Files: ${migrationSummary.storage.fileCount}`);
    console.log(`   Total Size: ${migrationSummary.storage.totalSizeMB} MB`);
    
    console.log('\n🎉 Firebase data export completed successfully!');
    console.log(`   Export location: ${exportDir}/`);
    console.log('   Files created:');
    console.log('   - stories.json');
    console.log('   - user-api-keys.json');  
    console.log('   - storage-inventory.json');
    console.log('   - migration-summary.json');
    
  } catch (error) {
    console.error('❌ Export failed:', error);
  }
}

exportFirebaseData();
