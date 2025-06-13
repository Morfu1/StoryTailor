#!/usr/bin/env tsx

/**
 * Create the user_api_keys table in Baserow
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const BASEROW_API_URL = process.env.BASEROW_API_URL || 'http://192.168.31.251:8980/api';
const BASEROW_TOKEN = process.env.BASEROW_TOKEN;
const BASEROW_DATABASE_ID = process.env.BASEROW_DATABASE_ID; // You'll need to add this to your .env.local

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

  return response.json();
}

async function createApiKeysTable() {
  console.log('🔍 Creating user_api_keys table in Baserow...\n');
  
  try {
    // Create the table
    console.log('1. Creating user_api_keys table...');
    const tableData = {
      name: 'user_api_keys',
      data: [
        ['user_id', 'api_key_hash', 'created_at', 'last_used']
      ]
    };
    
    const table = await apiCall(`/database/tables/database/${BASEROW_DATABASE_ID}/`, 'POST', tableData);
    console.log(`   ✅ Created table with ID: ${table.id}`);
    
    // The table is created with basic text fields, we need to update field types
    console.log('\n2. Updating field types...');
    
    // Get the table fields
    const fields = await apiCall(`/database/fields/table/${table.id}/`);
    console.log(`   Found ${fields.length} fields`);
    
    // Update created_at field to date with time
    const createdAtField = fields.find((f: any) => f.name === 'created_at');
    if (createdAtField) {
      await apiCall(`/database/fields/${createdAtField.id}/`, 'PATCH', {
        type: 'date',
        date_include_time: true
      });
      console.log('   ✅ Updated created_at to date field');
    }
    
    // Update last_used field to date with time
    const lastUsedField = fields.find((f: any) => f.name === 'last_used');
    if (lastUsedField) {
      await apiCall(`/database/fields/${lastUsedField.id}/`, 'PATCH', {
        type: 'date',
        date_include_time: true
      });
      console.log('   ✅ Updated last_used to date field');
    }
    
    console.log('\n🎉 user_api_keys table created successfully!');
    console.log(`   Table ID: ${table.id}`);
    console.log('\n💡 Add this to your .env.local:');
    console.log(`BASEROW_API_KEYS_TABLE_ID=${table.id}`);
    
  } catch (error) {
    console.error('❌ Failed to create table:', error);
  }
}

// Check if DATABASE_ID is provided
if (!BASEROW_DATABASE_ID) {
  console.log('❌ Please add BASEROW_DATABASE_ID to your .env.local file');
  console.log('   You can find this in your Baserow URL when viewing your database');
  console.log('   Example: http://192.168.31.251:8980/database/123 -> DATABASE_ID is 123');
} else {
  createApiKeysTable();
}
