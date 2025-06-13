#!/usr/bin/env tsx

/**
 * Baserow Database Schema Setup Script
 * 
 * This script creates the required database structure in Baserow for the Firebase to Baserow migration.
 * Run this script after Baserow is running to set up the database tables.
 * 
 * Prerequisites:
 * - Baserow running at http://192.168.31.251:8980
 * - Baserow API token (get from user settings)
 * 
 * Usage:
 * BASEROW_TOKEN=your_token npx tsx scripts/setup-baserow-schema.ts
 */

const BASEROW_API_URL = 'http://192.168.31.251:8980/api';

interface BaserowDatabase {
  id: number;
  name: string;
  order: number;
  type: string;
  workspace: {
    id: number;
    name: string;
  };
}

interface BaserowTable {
  id: number;
  name: string;
  order: number;
  database_id: number;
}

interface BaserowField {
  id: number;
  table_id: number;
  name: string;
  order: number;
  type: string;
  primary: boolean;
}

interface CreateFieldRequest {
  type: string;
  name: string;
  [key: string]: any;
}

class BaserowSetup {
  private token: string;
  private headers: Record<string, string>;

  constructor(token: string) {
    this.token = token;
    this.headers = {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json'
    };
  }

  private async apiCall(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    const url = `${BASEROW_API_URL}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Baserow API call failed: ${response.status} ${response.statusText}\n${errorText}`);
    }

    return response.json();
  }

  async listDatabases(): Promise<BaserowDatabase[]> {
    const response = await this.apiCall('/applications/');
    return response.results;
  }

  async createDatabase(workspaceId: number, name: string): Promise<BaserowDatabase> {
    return this.apiCall('/applications/', 'POST', {
      name,
      workspace_id: workspaceId,
      type: 'database'
    });
  }

  async createTable(databaseId: number, name: string): Promise<BaserowTable> {
    return this.apiCall('/database/tables/', 'POST', {
      database_id: databaseId,
      name
    });
  }

  async createField(tableId: number, field: CreateFieldRequest): Promise<BaserowField> {
    return this.apiCall(`/database/tables/${tableId}/fields/`, 'POST', field);
  }

  async listFields(tableId: number): Promise<BaserowField[]> {
    const response = await this.apiCall(`/database/tables/${tableId}/fields/`);
    return response.results;
  }

  async setupStoriesTable(databaseId: number): Promise<BaserowTable> {
    console.log('Creating Stories table...');
    const table = await this.createTable(databaseId, 'stories');
    
    // Create fields for Stories table based on migration plan schema
    const fields: CreateFieldRequest[] = [
      { type: 'text', name: 'firebase_story_id' },
      { type: 'text', name: 'user_id' },
      { type: 'text', name: 'title' },
      { type: 'long_text', name: 'content' },
      { 
        type: 'single_select', 
        name: 'status',
        select_options: [
          { value: 'draft', color: 'blue' },
          { value: 'generating', color: 'yellow' },
          { value: 'completed', color: 'green' },
          { value: 'error', color: 'red' }
        ]
      },
      { type: 'date', name: 'created_at', date_include_time: true },
      { type: 'date', name: 'updated_at', date_include_time: true },
      { type: 'url', name: 'narration_audio_url' },
      { type: 'long_text', name: 'generated_images' }, // JSON array
      { type: 'long_text', name: 'narration_chunks' }, // JSON array
      { type: 'long_text', name: 'timeline_tracks' }, // JSON array
      { type: 'long_text', name: 'settings' }, // JSON object
      { type: 'text', name: 'image_style_id' },
      { type: 'text', name: 'eleven_labs_voice_id' },
      { type: 'text', name: 'narration_voice' },
      { type: 'long_text', name: 'image_prompts' }, // JSON array
      { type: 'long_text', name: 'action_prompts' }, // JSON array
      { type: 'long_text', name: 'details_prompts' } // JSON object
    ];

    for (const field of fields) {
      try {
        await this.createField(table.id, field);
        console.log(`✓ Created field: ${field.name}`);
      } catch (error) {
        console.error(`✗ Failed to create field ${field.name}:`, error);
      }
    }

    return table;
  }

  async setupUserApiKeysTable(databaseId: number): Promise<BaserowTable> {
    console.log('Creating User API Keys table...');
    const table = await this.createTable(databaseId, 'user_api_keys');
    
    const fields: CreateFieldRequest[] = [
      { type: 'text', name: 'user_id' },
      { type: 'text', name: 'api_key_hash' },
      { type: 'date', name: 'created_at', date_include_time: true },
      { type: 'date', name: 'last_used', date_include_time: true }
    ];

    for (const field of fields) {
      try {
        await this.createField(table.id, field);
        console.log(`✓ Created field: ${field.name}`);
      } catch (error) {
        console.error(`✗ Failed to create field ${field.name}:`, error);
      }
    }

    return table;
  }

  async setup(): Promise<void> {
    try {
      console.log('🚀 Starting Baserow schema setup...\n');
      
      // List existing databases
      const databases = await this.listDatabases();
      console.log('Existing databases:', databases.map(db => db.name));
      
      // Find or create StoryTailor database
      let storyTailorDb = databases.find(db => db.name === 'StoryTailor');
      
      if (!storyTailorDb) {
        console.log('Creating StoryTailor database...');
        if (databases.length === 0) {
          throw new Error('No workspace found. Please create a workspace in Baserow first.');
        }
        const workspaceId = databases[0].workspace.id;
        storyTailorDb = await this.createDatabase(workspaceId, 'StoryTailor');
        console.log('✓ Created StoryTailor database');
      } else {
        console.log('✓ Found existing StoryTailor database');
      }
      
      // Create tables
      const storiesTable = await this.setupStoriesTable(storyTailorDb.id);
      const apiKeysTable = await this.setupUserApiKeysTable(storyTailorDb.id);
      
      console.log('\n🎉 Schema setup completed successfully!');
      console.log(`\n📊 Database Details:`);
      console.log(`Database ID: ${storyTailorDb.id}`);
      console.log(`Stories Table ID: ${storiesTable.id}`);
      console.log(`User API Keys Table ID: ${apiKeysTable.id}`);
      
      console.log(`\n🔧 Environment Variables to add:`);
      console.log(`BASEROW_DATABASE_ID=${storyTailorDb.id}`);
      console.log(`BASEROW_STORIES_TABLE_ID=${storiesTable.id}`);
      console.log(`BASEROW_API_KEYS_TABLE_ID=${apiKeysTable.id}`);
      
    } catch (error) {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    }
  }
}

async function main() {
  const token = process.env.BASEROW_TOKEN;
  
  if (!token) {
    console.error('❌ BASEROW_TOKEN environment variable is required');
    console.log('\n📝 To get your token:');
    console.log('1. Go to http://192.168.31.251:8980');
    console.log('2. Sign in or create an account');
    console.log('3. Go to Settings (top right) → Account');
    console.log('4. Generate a new API token');
    console.log('5. Run: BASEROW_TOKEN=your_token npx tsx scripts/setup-baserow-schema.ts');
    process.exit(1);
  }
  
  const setup = new BaserowSetup(token);
  await setup.setup();
}

if (require.main === module) {
  main().catch(console.error);
}

export { BaserowSetup };
