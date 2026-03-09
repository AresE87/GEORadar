import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: import.meta.env.OPENAI_API_KEY ?? '',
});

export const OPENAI_ANALYSIS_MODEL = import.meta.env.OPENAI_ANALYSIS_MODEL ?? 'gpt-4o';
export const OPENAI_QUERY_MODEL = import.meta.env.OPENAI_QUERY_MODEL ?? 'gpt-4o-mini';
