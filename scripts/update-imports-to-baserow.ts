#!/usr/bin/env tsx

/**
 * Update all imports from firestoreStoryActions to baserowStoryActions
 * Part of Phase 3: Code Migration
 */

import { readFile, writeFile } from 'node:fs/promises';
import { glob } from 'glob';

async function updateImports() {
  console.log('🔄 Updating imports from Firebase to Baserow...\n');
  
  try {
    // Find all TypeScript and TSX files that import from firestoreStoryActions
    const files = await glob('src/**/*.{ts,tsx}', { 
      ignore: ['src/actions/firestoreStoryActions.ts'] // Don't modify the original file
    });
    
    let updatedFiles = 0;
    
    for (const filePath of files) {
      const content = await readFile(filePath, 'utf8');
      
      // Check if file imports from firestoreStoryActions
      if (content.includes('firestoreStoryActions')) {
        console.log(`📝 Updating: ${filePath}`);
        
        // Replace the import
        const updatedContent = content.replace(
          /from ['"]@\/actions\/firestoreStoryActions['"]/g,
          'from \'@/actions/baserowStoryActions\''
        );
        
        // Also update any comments referencing the old actions
        const finalContent = updatedContent
          .replace(/firestoreStoryActions/g, 'baserowStoryActions')
          .replace(/Firebase Storage/g, 'MinIO Storage')
          .replace(/Firestore/g, 'Baserow');
        
        await writeFile(filePath, finalContent);
        updatedFiles++;
        
        console.log(`   ✅ Updated imports in ${filePath}`);
      }
    }
    
    if (updatedFiles === 0) {
      console.log('ℹ️  No files found with firestoreStoryActions imports');
    } else {
      console.log(`\n🎉 Successfully updated ${updatedFiles} files!`);
    }
    
    console.log('\n📋 Files updated:');
    console.log('   - All imports changed from firestoreStoryActions to baserowStoryActions');
    console.log('   - Comments updated to reference Baserow instead of Firestore');
    console.log('   - Ready for testing with new backend!');
    
  } catch (error) {
    console.error('❌ Failed to update imports:', error);
  }
}

updateImports();
