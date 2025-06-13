#!/usr/bin/env tsx

/**
 * Test the user_api_keys table in Baserow
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const BASEROW_API_URL = process.env.BASEROW_API_URL || 'http://192.168.31.251:8980/api';
const BASEROW_TOKEN = process.env.BASEROW_TOKEN;
const BASEROW_USER_API_KEYS_TABLE_ID = process.env.BASEROW_USER_API_KEYS_TABLE_ID;

async function apiCall(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
  const url = `${BASEROW_API_URL}${endpoint}`;
  
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Token ${BASEROW_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Baserow API call failed: ${response.status} ${response.statusText}\n${errorText}`);
  }

  if (method === 'DELETE') {
    return null;
  }

  return response.json();
}

async function testApiKeysTable() {
  console.log('🔍 Testing user_api_keys table...\n');
  
  try {
    // Get table fields
    console.log('1. Getting user_api_keys table fields...');
    const fields = await apiCall(`/database/fields/table/${BASEROW_USER_API_KEYS_TABLE_ID}/`);
    console.log(`   ✅ Found ${fields.length} fields:`);
    fields.forEach((field: any) => {
      console.log(`      - ${field.name} (${field.type}, id: ${field.id})`);
    });
    
    // Get existing API keys
    console.log('\n2. Getting existing API keys...');
    const apiKeys = await apiCall(`/database/rows/table/${BASEROW_USER_API_KEYS_TABLE_ID}/`);
    console.log(`   ✅ Found ${apiKeys.results.length} API keys`);
    
    // Test creating an API key
    console.log('\n3. Testing API key creation...');
    const testApiKey = {
      user_id: 'test-user-' + Date.now(),
      api_key_hash: 'hash-' + Date.now(),
      created_at: new Date().toISOString().split('T')[0],
      last_used: new Date().toISOString().split('T')[0]
    };
    
    const createdApiKey = await apiCall(`/database/rows/table/${BASEROW_USER_API_KEYS_TABLE_ID}/`, 'POST', testApiKey);
    console.log(`   ✅ Created API key with ID: ${createdApiKey.id}`);
    
    // Test updating the API key
    console.log('\n4. Testing API key update...');
    const updates = {
      last_used: new Date().toISOString().split('T')[0]
    };
    
    const updatedApiKey = await apiCall(`/database/rows/table/${BASEROW_USER_API_KEYS_TABLE_ID}/${createdApiKey.id}/`, 'PATCH', updates);
    console.log(`   ✅ Updated API key last_used`);
    
    // Test deleting the API key
    console.log('\n5. Testing API key deletion...');
    await apiCall(`/database/rows/table/${BASEROW_USER_API_KEYS_TABLE_ID}/${createdApiKey.id}/`, 'DELETE');
    console.log(`   ✅ Deleted test API key`);
    
    console.log('\n🎉 All user_api_keys table tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Check if TABLE_ID is provided
if (!BASEROW_USER_API_KEYS_TABLE_ID) {
  console.log('❌ BASEROW_USER_API_KEYS_TABLE_ID not found in environment variables');
} else {
  testApiKeysTable();
}
