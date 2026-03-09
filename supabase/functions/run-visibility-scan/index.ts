import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScanPayload {
  brand_id: string;
  query_template_ids?: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { brand_id, query_template_ids } = (await req.json()) as ScanPayload;

    // 1. Obtener la brand
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('*')
      .eq('id', brand_id)
      .single();

    if (brandError || !brand) {
      return new Response(JSON.stringify({ error: 'Brand not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Obtener templates
    let templatesQuery = supabase
      .from('query_templates')
      .select('*')
      .eq('brand_id', brand_id)
      .eq('is_active', true);

    if (query_template_ids?.length) {
      templatesQuery = templatesQuery.in('id', query_template_ids);
    }

    const { data: templates } = await templatesQuery;
    if (!templates?.length) {
      return new Response(JSON.stringify({ error: 'No active query templates' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY')!;
    const MAX_CONCURRENT = parseInt(Deno.env.get('MAX_QUERIES_CONCURRENT') ?? '3');

    const allResponses: Array<{
      brand_id: string;
      query_template_id: string;
      llm_provider: string;
      llm_model: string;
      query_text: string;
      response_text: string;
      brand_mentioned: boolean;
      mention_type: string;
      mention_position: number | null;
      sentiment: string;
      competitors_mentioned: string[];
      scanned_at: string;
    }> = [];

    // 3. Procesar templates con concurrency limit
    for (let i = 0; i < templates.length; i += MAX_CONCURRENT) {
      const batch = templates.slice(i, i + MAX_CONCURRENT);
      const batchPromises = batch.flatMap((template: { id: string; query_text: string }) => [
        queryLLM('openai', 'gpt-4o-mini', template.query_text, OPENAI_API_KEY),
        queryLLM('anthropic', 'claude-haiku-4-5', template.query_text, ANTHROPIC_API_KEY),
        queryLLM('perplexity', 'sonar', template.query_text, PERPLEXITY_API_KEY),
      ].map(async (promise) => {
        const result = await promise;
        const mention = parseMentionSimple(result.text, brand.name, brand.domain, brand.competitors ?? []);
        return {
          brand_id,
          query_template_id: template.id,
          llm_provider: result.provider,
          llm_model: result.model,
          query_text: template.query_text,
          response_text: result.text,
          brand_mentioned: mention.brand_mentioned,
          mention_type: mention.mention_type,
          mention_position: mention.mention_position,
          sentiment: mention.sentiment,
          competitors_mentioned: mention.competitors_mentioned,
          scanned_at: new Date().toISOString(),
        };
      }));

      const batchResults = await Promise.allSettled(batchPromises);
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          allResponses.push(result.value);
        }
      }
    }

    // 4. Guardar respuestas
    if (allResponses.length > 0) {
      await supabase.from('llm_responses').insert(allResponses);
    }

    // 5. Calcular score del día
    const total = allResponses.length;
    const mentioned = allResponses.filter((r) => r.brand_mentioned).length;
    const primary = allResponses.filter((r) => r.mention_type === 'primary').length;
    const positive = allResponses.filter((r) => r.sentiment === 'positive').length;
    const neutral = allResponses.filter((r) => r.sentiment === 'neutral').length;
    const negative = allResponses.filter((r) => r.sentiment === 'negative').length;

    const mentionRate = total > 0 ? (mentioned / total) * 100 : 0;
    const primaryRate = total > 0 ? (primary / total) * 100 : 0;
    const sentimentTotal = positive + neutral + negative;
    const sentimentScore = sentimentTotal > 0 ? ((positive * 100 + neutral * 50) / sentimentTotal) : 50;
    const overallScore = mentionRate * 0.4 + primaryRate * 0.35 + sentimentScore * 0.25;

    const providerScore = (prov: string) => {
      const pr = allResponses.filter((r) => r.llm_provider === prov);
      if (pr.length === 0) return 0;
      const m = pr.filter((r) => r.brand_mentioned).length;
      const p = pr.filter((r) => r.mention_type === 'primary').length;
      const pos = pr.filter((r) => r.sentiment === 'positive').length;
      const neu = pr.filter((r) => r.sentiment === 'neutral').length;
      const neg = pr.filter((r) => r.sentiment === 'negative').length;
      const st = pos + neu + neg;
      const ss = st > 0 ? ((pos * 100 + neu * 50) / st) : 50;
      return (m / pr.length) * 100 * 0.4 + (p / pr.length) * 100 * 0.35 + ss * 0.25;
    };

    const today = new Date().toISOString().split('T')[0];
    await supabase.from('visibility_scores').upsert(
      {
        brand_id,
        date: today,
        overall_score: Math.round(overallScore * 100) / 100,
        mention_rate: Math.round(mentionRate * 100) / 100,
        primary_rate: Math.round(primaryRate * 100) / 100,
        sentiment_score: Math.round(sentimentScore * 100) / 100,
        openai_score: Math.round(providerScore('openai') * 100) / 100,
        anthropic_score: Math.round(providerScore('anthropic') * 100) / 100,
        perplexity_score: Math.round(providerScore('perplexity') * 100) / 100,
        queries_run: total,
      },
      { onConflict: 'brand_id,date' }
    );

    // 6. Actualizar last_scanned_at
    await supabase
      .from('brands')
      .update({ last_scanned_at: new Date().toISOString() })
      .eq('id', brand_id);

    // 7. Verificar caída de score vs día anterior
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const { data: yesterdayScore } = await supabase
      .from('visibility_scores')
      .select('overall_score')
      .eq('brand_id', brand_id)
      .eq('date', yesterday)
      .single();

    const scoreDrop = yesterdayScore
      ? Number(yesterdayScore.overall_score) - overallScore
      : 0;

    return new Response(
      JSON.stringify({
        queries_run: total,
        brand_mentioned_count: mentioned,
        overall_score: Math.round(overallScore * 100) / 100,
        score_drop: scoreDrop > 10 ? scoreDrop : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// LLM query functions
async function queryLLM(
  provider: string,
  model: string,
  query: string,
  apiKey: string
): Promise<{ provider: string; model: string; text: string }> {
  try {
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model, messages: [
            { role: 'system', content: 'Eres un asistente útil. Responde la pregunta del usuario directamente.' },
            { role: 'user', content: query },
          ], temperature: 0.1, max_tokens: 800,
        }),
      });
      const data = await res.json();
      return { provider, model, text: data.choices?.[0]?.message?.content ?? '' };
    }

    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model, max_tokens: 800,
          system: 'Eres un asistente útil. Responde la pregunta del usuario directamente.',
          messages: [{ role: 'user', content: query }],
        }),
      });
      const data = await res.json();
      return { provider, model, text: data.content?.[0]?.text ?? '' };
    }

    if (provider === 'perplexity') {
      const res = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model, messages: [{ role: 'user', content: query }],
          temperature: 0.1, max_tokens: 800,
        }),
      });
      const data = await res.json();
      return { provider, model, text: data.choices?.[0]?.message?.content ?? '' };
    }

    return { provider, model, text: '' };
  } catch {
    return { provider, model, text: '' };
  }
}

// Simple mention parser (self-contained for Edge Function)
function parseMentionSimple(
  text: string,
  brandName: string,
  domain: string | null,
  competitors: string[]
) {
  const textLower = text.toLowerCase();
  const namePattern = brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nameRegex = new RegExp(namePattern, 'i');
  const domainRegex = domain ? new RegExp(domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;

  const brandMentioned = nameRegex.test(text) || (domainRegex ? domainRegex.test(text) : false);
  const competitorsMentioned = competitors.filter((c) =>
    new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text)
  );

  if (!brandMentioned) {
    return {
      brand_mentioned: false,
      mention_type: 'not_mentioned' as const,
      mention_position: null,
      sentiment: 'not_mentioned' as const,
      competitors_mentioned: competitorsMentioned,
    };
  }

  // Check list position
  let position: number | null = null;
  const lines = text.split('\n');
  for (const line of lines) {
    if (!nameRegex.test(line)) continue;
    const match = line.match(/^\s*(?:#?\s*)?(\d+)[.):\-\s]/);
    if (match) { position = parseInt(match[1]!, 10); break; }
  }

  // Determine mention type
  const negPatterns = ['no recomiendo', 'evitar', 'avoid', "don't recommend", 'problems with'];
  const isNegative = negPatterns.some((p) => textLower.includes(p) && textLower.includes(brandName.toLowerCase()));
  let mentionType: 'primary' | 'secondary' | 'negative' = isNegative ? 'negative' : position === 1 ? 'primary' : 'secondary';

  // Sentiment
  const posWords = ['mejor', 'recomiendo', 'excelente', 'best', 'recommend', 'excellent', 'great', 'top', 'leading'];
  const negWords = ['problema', 'limitado', 'caro', 'problem', 'limited', 'expensive', 'avoid'];
  let posCount = 0, negCount = 0;
  for (const w of posWords) if (textLower.includes(w)) posCount++;
  for (const w of negWords) if (textLower.includes(w)) negCount++;
  const sentiment = posCount > negCount ? 'positive' : negCount > posCount ? 'negative' : 'neutral';

  return {
    brand_mentioned: true,
    mention_type: mentionType,
    mention_position: position,
    sentiment,
    competitors_mentioned: competitorsMentioned,
  };
}
