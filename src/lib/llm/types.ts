import type { LLMProvider } from '@/types';

export interface LLMProviderConfig {
  apiKey: string;
  model: string;
  timeout: number;
}

export interface LLMQueryResult {
  responseText: string;
  model: string;
  latencyMs: number;
}

export type ProviderFn = (prompt: string) => Promise<LLMQueryResult>;

export function getProviderConfigs(): Record<LLMProvider, LLMProviderConfig> {
  return {
    openai: {
      apiKey: import.meta.env.OPENAI_API_KEY,
      model: import.meta.env.OPENAI_QUERY_MODEL || 'gpt-4o-mini',
      timeout: Number(import.meta.env.LLM_REQUEST_TIMEOUT_MS) || 10000,
    },
    anthropic: {
      apiKey: import.meta.env.ANTHROPIC_API_KEY,
      model: import.meta.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
      timeout: Number(import.meta.env.LLM_REQUEST_TIMEOUT_MS) || 10000,
    },
    perplexity: {
      apiKey: import.meta.env.PERPLEXITY_API_KEY,
      model: import.meta.env.PERPLEXITY_MODEL || 'sonar',
      timeout: Number(import.meta.env.LLM_REQUEST_TIMEOUT_MS) || 10000,
    },
  };
}
