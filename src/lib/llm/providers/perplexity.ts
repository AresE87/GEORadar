import OpenAI from 'openai';
import type { LLMQueryResult } from '../types';

function getClient(): OpenAI {
  return new OpenAI({
    apiKey: import.meta.env.PERPLEXITY_API_KEY,
    baseURL: 'https://api.perplexity.ai',
  });
}

export async function queryPerplexity(prompt: string): Promise<LLMQueryResult> {
  const client = getClient();
  const model = import.meta.env.PERPLEXITY_MODEL || 'sonar';
  const start = Date.now();

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500,
  });

  const latencyMs = Date.now() - start;
  const responseText = response.choices[0]?.message?.content ?? '';

  return { responseText, model, latencyMs };
}
