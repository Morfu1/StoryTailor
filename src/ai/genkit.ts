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
    const { modelName, messages, userId } = input;

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
      return data.choices[0].message.content;
    } else {
      // console.error("Unexpected response structure from Perplexity:", data);
      throw new Error('Unexpected response structure from Perplexity API.');
    }
  }
);
