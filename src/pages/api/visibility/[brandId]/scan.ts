import type { APIRoute } from 'astro';
import { createServiceClient } from '@/lib/supabase/server';
import { executeRouter } from '@/lib/llm/router';
import { parseMention } from '@/lib/parser/mention-parser';
import { calculateScore, getDefaultWeights } from '@/lib/score/calculator';
import { getAvailableProviders } from '@/lib/utils/plan-limits';
import { generateRecommendations } from '@/lib/recommendations/generator';
import type { Plan, ParsedResponse, QueryTemplate } from '@/types';

export const POST: APIRoute = async ({ locals, params }) => {
  const { supabase, user } = locals;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const brandId = params.brandId!;

  // Get brand with templates
  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('*, query_templates(*)')
    .eq('id', brandId)
    .single();

  if (brandError || !brand) {
    return new Response(JSON.stringify({ error: 'Brand not found' }), { status: 404 });
  }

  // Get user plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  const plan = (profile?.plan ?? 'free') as Plan;
  const providers = getAvailableProviders(plan);
  const activeTemplates = (brand.query_templates as QueryTemplate[]).filter((t) => t.is_active);

  // Execute router
  const routerResult = await executeRouter(activeTemplates, providers, brand.name);

  // Parse and save responses
  const serviceClient = createServiceClient();
  const parsedResponses: ParsedResponse[] = [];

  for (const response of routerResult.responses) {
    const parseResult = parseMention(response.responseText, brand.name, brand.competitors);
    parsedResponses.push({
      provider: response.provider,
      brandMentioned: parseResult.brandMentioned,
      mentionType: parseResult.mentionType,
      sentiment: parseResult.sentiment,
    });

    await serviceClient.from('llm_responses').upsert(
      {
        brand_id: brandId,
        query_template_id: response.queryTemplateId,
        llm_provider: response.provider,
        llm_model: response.provider,
        query_text: response.queryText,
        response_text: response.responseText,
        brand_mentioned: parseResult.brandMentioned,
        mention_type: parseResult.mentionType,
        mention_position: parseResult.mentionPosition,
        sentiment: parseResult.sentiment,
        competitors_mentioned: parseResult.competitorsMentioned,
        response_length: response.responseText.length,
        latency_ms: response.latencyMs,
      },
      { onConflict: 'brand_id,query_template_id,llm_provider,scan_date' }
    );
  }

  // Calculate and save score
  const scoreResult = calculateScore({
    responses: parsedResponses,
    weights: getDefaultWeights(),
  });

  await serviceClient.from('visibility_scores').upsert(
    {
      brand_id: brandId,
      overall_score: scoreResult.overallScore,
      mention_rate: scoreResult.mentionRate,
      primary_rate: scoreResult.primaryRate,
      sentiment_score: scoreResult.sentimentScore,
      openai_score: scoreResult.byProvider.openai ?? 0,
      anthropic_score: scoreResult.byProvider.anthropic ?? 0,
      perplexity_score: scoreResult.byProvider.perplexity ?? 0,
      total_queries: scoreResult.totalQueries,
      total_mentions: scoreResult.totalMentions,
      total_primary: scoreResult.totalPrimary,
      providers_available: scoreResult.providersAvailable,
    },
    { onConflict: 'brand_id,score_date' }
  );

  // Update last_scanned_at
  await serviceClient
    .from('brands')
    .update({ last_scanned_at: new Date().toISOString() })
    .eq('id', brandId);

  // Generate recommendations async (don't block response)
  generateRecommendations(
    brandId,
    brand.name,
    brand.industry,
    scoreResult,
    [],
    brand.competitors
  ).catch((err) => console.error('Recommendation generation failed:', err));

  return new Response(
    JSON.stringify({
      scan_id: brandId,
      score: scoreResult,
      stats: routerResult.stats,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
};
