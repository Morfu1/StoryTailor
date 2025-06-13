#!/usr/bin/env tsx

const BASEROW_API_URL = 'http://192.168.31.251:8980/api';

async function testAuth() {
  const token = process.env.BASEROW_TOKEN;
  
  if (!token) {
    console.error('❌ BASEROW_TOKEN environment variable is required');
    process.exit(1);
  }
  
  console.log(`🔍 Testing authentication with token: ${token.substring(0, 10)}...${token.substring(token.length - 4)}`);
  
  // Test different auth formats
  const authFormats = [
    `Token ${token}`,
    `Bearer ${token}`,
    token
  ];
  
  // Also test different endpoints
  const endpoints = ['/applications/', '/user/', '/auth/user/'];
  
  for (const authFormat of authFormats) {
    console.log(`\n🧪 Testing auth format: "${authFormat.substring(0, 20)}..."`);
    
    for (const endpoint of endpoints) {
      console.log(`  📍 Testing endpoint: ${endpoint}`);
      
      try {
        const response = await fetch(`${BASEROW_API_URL}${endpoint}`, {
          method: 'GET',
          headers: {
            'Authorization': authFormat,
            'Content-Type': 'application/json'
          }
        });
        
        console.log(`  Status: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Authentication successful!');
          console.log('Response:', JSON.stringify(data, null, 2));
          return;
        } else {
          const errorText = await response.text();
          console.log(`  ❌ Error response: ${errorText.substring(0, 100)}`);
        }
      } catch (error) {
        console.log('  ❌ Network error:', error);
      }
    }
  }
  
  console.log('\n🚨 All authentication formats failed');
}

testAuth().catch(console.error);
