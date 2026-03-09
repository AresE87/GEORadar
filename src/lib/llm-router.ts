import type { LLMProvider, LLMQueryResponse } from './types';
import { openai, OPENAI_QUERY_MODEL } from './openai';
import { anthropic, ANTHROPIC_MODEL } from './anthropic';
import { queryPerplexity, PERPLEXITY_MODEL } from './perplexity';

export async function routeQuery(
  query: string,
  providers: LLMProvider[]
): Promise<LLMQueryResponse[]> {
  const queries = providers.map((provider) => {
    switch (provider) {
      case 'openai':
        return queryOpenAI(query);
      case 'anthropic':
        return queryAnthropic(query);
      case 'perplexity':
        return queryPerplexityLLM(query);
      default:
        return Promise.resolve({
          provider,
          model: 'unknown',
          response_text: '',
          latency_ms: 0,
          error: `Provider ${provider} not supported`,
        } as LLMQueryResponse);
    }
  });

  return Promise.all(queries);
}

async function queryOpenAI(query: string): Promise<LLMQueryResponse> {
  const start = Date.now();
  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_QUERY_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Eres un asistente útil. Responde la pregunta del usuario directamente.',
        },
        { role: 'user', content: query },
      ],
      temperature: 0.1,
      max_tokens: 800,
    });

    return {
      provider: 'openai',
      model: OPENAI_QUERY_MODEL,
      response_text: response.choices[0]?.message?.content ?? '',
      latency_ms: Date.now() - start,
    };
  } catch (err) {
    return {
      provider: 'openai',
      model: OPENAI_QUERY_MODEL,
      response_text: '',
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown OpenAI error',
    };
  }
}

async function queryAnthropic(query: string): Promise<LLMQueryResponse> {
  const start = Date.now();
  try {
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 800,
      system: 'Eres un asistente útil. Responde la pregunta del usuario directamente.',
      messages: [{ role: 'user', content: query }],
    });

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => ('text' in block ? block.text : ''))
      .join('');

    return {
      provider: 'anthropic',
      model: ANTHROPIC_MODEL,
      response_text: text,
      latency_ms: Date.now() - start,
    };
  } catch (err) {
    return {
      provider: 'anthropic',
      model: ANTHROPIC_MODEL,
      response_text: '',
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown Anthropic error',
    };
  }
}

async function queryPerplexityLLM(query: string): Promise<LLMQueryResponse> {
  const start = Date.now();
  try {
    const responseText = await queryPerplexity(
      [{ role: 'user', content: query }],
      { model: PERPLEXITY_MODEL, temperature: 0.1, max_tokens: 800 }
    );

    return {
      provider: 'perplexity',
      model: PERPLEXITY_MODEL,
      response_text: responseText,
      latency_ms: Date.now() - start,
    };
  } catch (err) {
    return {
      provider: 'perplexity',
      model: PERPLEXITY_MODEL,
      response_text: '',
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown Perplexity error',
    };
  }
}
