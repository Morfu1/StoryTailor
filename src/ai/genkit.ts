import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import { defineFlow } from 'genkit/flow';
import { z } from 'zod';
import { getUserApiKeys } from '@/actions/apiKeyActions'; // Adjust path if necessary

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash',
});

export const generateWithPerplexity = defineFlow(
  {
    name: 'generateWithPerplexity',
    inputSchema: z.object({
      modelName: z.string(),
      messages: z.array(z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
      })),
      userId: z.string(),
    }),
    outputSchema: z.string(), // Assuming we directly return the content string
  },
  async (input) => {
    const { modelName, messages, userId } = input;

    const { data: userApiKeys, error: apiKeyError } = await getUserApiKeys(userId);

    if (apiKeyError || !userApiKeys?.perplexityApiKey) {
      throw new Error('Perplexity API key not configured or failed to fetch.');
    }

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userApiKeys.perplexityApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: messages,
        // Add other parameters like temperature, max_tokens if needed,
        // based on Perplexity API docs for chat completions.
        // For now, keeping it simple.
      }),
    });

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
