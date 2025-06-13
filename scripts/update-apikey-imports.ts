#!/usr/bin/env tsx

/**
 * Update all imports from apiKeyActions to baserowApiKeyActions
 * Part of Phase 3: Code Migration
 */

import { readFile, writeFile } from 'node:fs/promises';
import { glob } from 'glob';

async function updateApiKeyImports() {
  console.log('🔄 Updating API key imports from Firebase to Baserow...\n');
  
  try {
    // Find all TypeScript and TSX files that import from apiKeyActions
    const files = await glob('src/**/*.{ts,tsx}', { 
      ignore: ['src/actions/apiKeyActions.ts'] // Don't modify the original file
    });
    
    let updatedFiles = 0;
    
    for (const filePath of files) {
      const content = await readFile(filePath, 'utf8');
      
      // Check if file imports from apiKeyActions
      if (content.includes('@/actions/apiKeyActions')) {
        console.log(`📝 Updating: ${filePath}`);
        
        // Replace the import
        const updatedContent = content.replace(
          /from ['"]@\/actions\/apiKeyActions['"]/g,
          'from \'@/actions/baserowApiKeyActions\''
        );
        
        await writeFile(filePath, updatedContent);
        updatedFiles++;
        
        console.log(`   ✅ Updated API key imports in ${filePath}`);
      }
    }
    
    // Also check ai/genkit.ts with relative import
    const genkitFile = 'src/ai/genkit.ts';
    try {
      const genkitContent = await readFile(genkitFile, 'utf8');
      if (genkitContent.includes('../actions/apiKeyActions')) {
        console.log(`📝 Updating: ${genkitFile}`);
        
        const updatedContent = genkitContent.replace(
          /from ['"]\.\.\/actions\/apiKeyActions['"]/g,
          'from \'../actions/baserowApiKeyActions\''
        );
        
        await writeFile(genkitFile, updatedContent);
        updatedFiles++;
        
        console.log(`   ✅ Updated API key imports in ${genkitFile}`);
      }
    } catch (error) {
      console.log(`   ⚠️  Could not update ${genkitFile}: ${error}`);
    }
    
    if (updatedFiles === 0) {
      console.log('ℹ️  No files found with apiKeyActions imports');
    } else {
      console.log(`\n🎉 Successfully updated ${updatedFiles} files!`);
    }
    
    console.log('\n📋 Files updated:');
    console.log('   - All imports changed from apiKeyActions to baserowApiKeyActions');
    console.log('   - API key storage moved from Firestore to Baserow');
    
  } catch (error) {
    console.error('❌ Failed to update API key imports:', error);
  }
}

updateApiKeyImports();
