#!/usr/bin/env tsx

/**
 * Check existing Baserow structure
 */

const BASEROW_API_URL = 'http://192.168.31.251:8980/api';

async function checkStructure() {
  const token = process.env.BASEROW_TOKEN;
  
  if (!token) {
    console.error('❌ BASEROW_TOKEN environment variable is required');
    process.exit(1);
  }
  
  console.log('🔍 Checking existing Baserow structure...\n');
  
  // Try to access the stories table directly
  const databaseId = 174; // From your URL
  const tableId = 606; // From your URL
  
  // Try different endpoints with database ID
  const endpoints = [
    `/database/rows/table/${tableId}/`,
    `/database/fields/table/${tableId}/`,
    `/database/tables/${tableId}/fields/`,
    `/database/tables/${tableId}/rows/`
  ];
  
  for (const endpoint of endpoints) {
    console.log(`🧪 Testing: ${endpoint}`);
    
    try {
      const response = await fetch(`${BASEROW_API_URL}${endpoint}`, {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`  Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Successfully connected!');
        
        if (endpoint.includes('fields')) {
          console.log('\n📋 Existing fields:');
          data.results.forEach((field: any) => {
            console.log(`  - ${field.name} (${field.type}, id: ${field.id})`);
          });
        }
        
        console.log(`\n🔧 Use these values:`);
        console.log(`BASEROW_STORIES_TABLE_ID=${tableId}`);
        console.log(`BASEROW_TOKEN=${token}`);
        return;
        
      } else {
        const errorText = await response.text();
        console.log(`  ❌ Error: ${errorText.substring(0, 100)}`);
      }
    } catch (error) {
      console.error(`  ❌ Network error:`, error);
    }
  }
  
  console.log('\n🚨 All endpoints failed');
  console.log('💡 The database token might have limited permissions or different API structure');
  
  // Let's try checking what permissions the token has
  console.log('\n🔍 Token info:');
  console.log(`Database ID from URL: 174`);
  console.log(`Table ID from URL: 606`);
  console.log(`Token: ${token.substring(0, 10)}...`);
}

checkStructure();
