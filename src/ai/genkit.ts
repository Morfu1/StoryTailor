import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import { defineFlow } from '@genkit-ai/flow'; // Changed import
import { z } from 'zod';
import { getUserApiKeys } from '../actions/baserowApiKeyActions'; // Adjust path if necessary

// Define schemas separately
const perplexityInputSchema = z.object({
  modelName: z.string(),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })),
  userId: z.string(),
  contentType: z.enum(['title', 'script']).optional(), // Add content type to help with filtering
  useStructuredOutput: z.boolean().optional(), // Enable structured output for clean responses
});
const perplexityOutputSchema = z.string();

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash-preview-05-20',
});

export const generateWithPerplexity = defineFlow(
  {
    name: 'generateWithPerplexity',
    inputSchema: perplexityInputSchema, // Use defined schema
    outputSchema: perplexityOutputSchema, // Use defined schema
  },
  async (input: z.infer<typeof perplexityInputSchema>) => { // Infer type from defined schema
    const { modelName, messages, userId, contentType, useStructuredOutput } = input;

    const { data: userApiKeys, error: apiKeyError } = await getUserApiKeys(userId);

    if (apiKeyError || !userApiKeys?.perplexityApiKey) {
      throw new Error('Perplexity API key not configured or failed to fetch.');
    }

    let response;
    try {
      response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userApiKeys.perplexityApiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          messages: messages,
          temperature: 0.7,
          max_tokens: 8192, // Increased token limit for better coverage
          // Only use structured output for non-reasoning models, as reasoning models have issues with JSON schema
          ...(useStructuredOutput && !modelName.includes('reasoning') && contentType === 'script' ? {
            response_format: {
              type: "json_schema",
              json_schema: {
                schema: {
                  type: "object",
                  properties: {
                    story: {
                      type: "string",
                      description: "The complete story content as a single narrative, without any production instructions, narrator cues, or stage directions"
                    }
                  },
                  required: ["story"]
                }
              }
            }
          } : {}),
          ...(useStructuredOutput && !modelName.includes('reasoning') && contentType === 'title' ? {
            response_format: {
              type: "json_schema", 
              json_schema: {
                schema: {
                  type: "object",
                  properties: {
                    title: {
                      type: "string",
                      description: "A short catchy title for the story (3-10 words)"
                    }
                  },
                  required: ["title"]
                }
              }
            }
          } : {}),
        }),
      });
    } catch (fetchError) {
      console.error('Perplexity API fetch error:', fetchError);
      throw new Error(`Network error connecting to Perplexity API: ${fetchError instanceof Error ? fetchError.message : 'Unknown network error'}`);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Perplexity API request failed with status ${response.status}: ${errorBody}`);
    }

    const data = await response.json();

    if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
      let content = data.choices[0].message.content;
      
      // FIRST: Filter out thinking process from reasoning models (e.g., sonar-reasoning-pro)
      // Remove content between <think> and </think> tags BEFORE parsing JSON
      content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      
      // Handle structured output responses (JSON format) - only for non-reasoning models
      if (useStructuredOutput && !modelName.includes('reasoning')) {
        try {
          const parsed = JSON.parse(content);
          if (contentType === 'script' && parsed.story) {
            return parsed.story;
          } else if (contentType === 'title' && parsed.title) {
            return parsed.title;
          }
        } catch (parseError) {
          console.warn('Failed to parse structured output, falling back to text processing:', parseError);
          console.warn('Content that failed to parse:', content.substring(0, 200) + '...');
        }
      }
      
      // Additional filtering for reasoning models that add explanatory text
      // Remove citation markers like [1], [2], [1][2], etc.
      content = content.replace(/\[\d+\](\[\d+\])*/g, '').trim();
      
      // Apply specific filtering based on content type
      if (contentType === 'title') {
        // For titles: Extract only the title part (before explanatory text)
        // Look for patterns like: "**Title** explanation text" or "Title explanation text"
        const titleMatch = content.match(/^\*\*([^*]+)\*\*(?:\s|$)/);
        if (titleMatch) {
          // This looks like a title with explanation - return just the title
          return titleMatch[1].trim();
        }
        
        // Remove explanatory text for titles
        content = content.replace(/\s+This (title)[\s\S]*$/i, '').trim();
        content = content.replace(/\s+(captures?|features?|emphasizes?|highlights?)[\s\S]*$/i, '').trim();
        content = content.replace(/^\*\*([^*]+)\*\*\s*/, '$1');
      } else if (contentType === 'script') {
        // For scripts: Enhanced cleaning for reasoning models
        // Remove sections that start with "Narrative Techniques Used" or similar
        content = content.replace(/\n\*\*Narrative Techniques Used\*\*[\s\S]*$/i, '').trim();
        content = content.replace(/\n---[\s\S]*$/i, '').trim();
        
        // Remove explanatory text patterns for scripts
        content = content.replace(/\s+This script[\s\S]*$/i, '').trim();
        
        // Remove narrator instructions and camera directions
        content = content.replace(/^\*\*Narrator:\*\*\s*/gm, '').trim();
        content = content.replace(/\*\*Narrator \([^)]+\):\*\*\s*/gm, '').trim();
        content = content.replace(/The camera[^.]*\./gm, '').trim();
        content = content.replace(/Cut to[^.]*\./gm, '').trim();
        content = content.replace(/Fade to[^.]*\./gm, '').trim();
        content = content.replace(/\*\([^)]+\)\*/gm, '').trim();
        
        // Clean up extra whitespace and newlines
        content = content.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
      } else {
        // Fallback: Apply minimal filtering for backward compatibility
        const titleMatch = content.match(/^\*\*([^*]+)\*\*(?:\s|$)/);
        if (titleMatch && content.length < 200) {
          // Short content with title formatting - likely a title
          return titleMatch[1].trim();
        }
        
        // For longer content, apply minimal filtering
        content = content.replace(/\n\*\*Narrative Techniques Used\*\*[\s\S]*$/i, '').trim();
        content = content.replace(/\n---[\s\S]*$/i, '').trim();
      }
      
      return content;
    } else {
      // console.error("Unexpected response structure from Perplexity:", data);
      throw new Error('Unexpected response structure from Perplexity API.');
    }
  }
);
