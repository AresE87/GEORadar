import Anthropic from '@anthropic-ai/sdk';
import type { LLMQueryResult } from '../types';

function getClient(): Anthropic {
  return new Anthropic({
    apiKey: import.meta.env.ANTHROPIC_API_KEY,
  });
}

export async function queryAnthropic(prompt: string): Promise<LLMQueryResult> {
  const client = getClient();
  const model = import.meta.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';
  const start = Date.now();

  const response = await client.messages.create({
    model,
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  const latencyMs = Date.now() - start;
  const firstBlock = response.content[0];
  const responseText = firstBlock && firstBlock.type === 'text' ? firstBlock.text : '';

  return { responseText, model, latencyMs };
}
