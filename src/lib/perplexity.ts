const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

export const PERPLEXITY_MODEL = import.meta.env.PERPLEXITY_MODEL ?? 'sonar';

interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PerplexityResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
  }>;
}

export async function queryPerplexity(
  messages: PerplexityMessage[],
  options: { model?: string; temperature?: number; max_tokens?: number } = {}
): Promise<string> {
  const apiKey = import.meta.env.PERPLEXITY_API_KEY ?? '';
  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model ?? PERPLEXITY_MODEL,
      messages,
      temperature: options.temperature ?? 0.1,
      max_tokens: options.max_tokens ?? 800,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Perplexity API error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as PerplexityResponse;
  return data.choices[0]?.message?.content ?? '';
}
