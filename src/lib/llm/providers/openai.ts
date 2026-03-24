import OpenAI from 'openai';
import type { LLMQueryResult } from '../types';

function getClient(): OpenAI {
  return new OpenAI({
    apiKey: import.meta.env.OPENAI_API_KEY,
  });
}

export async function queryOpenAI(prompt: string): Promise<LLMQueryResult> {
  const client = getClient();
  const model = import.meta.env.OPENAI_QUERY_MODEL || 'gpt-4o-mini';
  const start = Date.now();

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500,
    temperature: 0.3,
  });

  const latencyMs = Date.now() - start;
  const responseText = response.choices[0]?.message?.content ?? '';

  return { responseText, model, latencyMs };
}

export async function analyzeWithOpenAI(prompt: string): Promise<string> {
  const client = getClient();
  const model = import.meta.env.OPENAI_ANALYSIS_MODEL || 'gpt-4o';

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1000,
    temperature: 0.4,
  });

  return response.choices[0]?.message?.content ?? '';
}
