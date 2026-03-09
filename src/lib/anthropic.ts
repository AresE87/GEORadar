import Anthropic from '@anthropic-ai/sdk';

export const anthropic = new Anthropic({
  apiKey: import.meta.env.ANTHROPIC_API_KEY ?? '',
});

export const ANTHROPIC_MODEL = import.meta.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001';
