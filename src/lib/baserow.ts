/**
 * Baserow Database Service
 * 
 * This replaces the Firebase Firestore functionality with Baserow REST API calls.
 * Uses database tokens for authentication.
 */

const BASEROW_API_URL = process.env.BASEROW_API_URL || 'http://192.168.31.251:8980/api';
const BASEROW_TOKEN = process.env.BASEROW_TOKEN;
const BASEROW_STORIES_TABLE_ID = process.env.BASEROW_STORIES_TABLE_ID || '696';

interface BaserowHeaders {
  'Authorization': string;
  'Content-Type': string;
  [key: string]: string;
}

class BaserowService {
  private headers: BaserowHeaders;

  constructor() {
    if (!BASEROW_TOKEN) {
      throw new Error('BASEROW_TOKEN environment variable is required');
    }
    
    this.headers = {
      'Authorization': `Token ${BASEROW_TOKEN}`,
      'Content-Type': 'application/json'
    };
  }

  async apiCall(endpoint: string, method: string = 'GET', body?: unknown): Promise<unknown> {
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

    // DELETE requests return empty body
    if (method === 'DELETE') {
      return null;
    }

    return response.json();
  }

  // Stories CRUD operations
  async getStories(userId?: string): Promise<Record<string, unknown>[]> {
    const endpoint = `/database/rows/table/${BASEROW_STORIES_TABLE_ID}/`;
    const params = new URLSearchParams({ user_field_names: 'true' });
    if (userId) {
      params.append('filter__user_id__equal', userId);
    }
    const url = `${endpoint}?${params.toString()}`;
    
    const response = await this.apiCall(url);
    return response.results || [];
  }

  async getStory(storyId: string): Promise<Record<string, unknown>> {
    const endpoint = `/database/rows/table/${BASEROW_STORIES_TABLE_ID}/${storyId}/?user_field_names=true`;
    return this.apiCall(endpoint);
  }

  async createStory(storyData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const endpoint = `/database/rows/table/${BASEROW_STORIES_TABLE_ID}/?user_field_names=true`;
    return this.apiCall(endpoint, 'POST', storyData);
  }

  async updateStory(storyId: string, updates: Record<string, unknown>): Promise<Record<string, unknown>> {
    const endpoint = `/database/rows/table/${BASEROW_STORIES_TABLE_ID}/${storyId}/?user_field_names=true`;
    return this.apiCall(endpoint, 'PATCH', updates);
  }

  async deleteStory(storyId: string): Promise<void> {
    const endpoint = `/database/rows/table/${BASEROW_STORIES_TABLE_ID}/${storyId}/`;
    await this.apiCall(endpoint, 'DELETE');
  }

  // Field information
  async getTableFields(): Promise<Record<string, unknown>[]> {
    const endpoint = `/database/fields/table/${BASEROW_STORIES_TABLE_ID}/`;
    const response = await this.apiCall(endpoint);
    return response || [];
  }

  // Test connection
  async testConnection(): Promise<boolean> {
    try {
      await this.getTableFields();
      return true;
    } catch (error) {
      console.error('Baserow connection test failed:', error);
      return false;
    }
  }
}

export const baserowService = new BaserowService();
export default baserowService;
