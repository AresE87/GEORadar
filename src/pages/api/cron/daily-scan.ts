import type { APIRoute } from 'astro';
import { createServiceClient } from '@/lib/supabase/server';
import { executeRouter } from '@/lib/llm/router';
import { parseMention } from '@/lib/parser/mention-parser';
import { calculateScore, getDefaultWeights } from '@/lib/score/calculator';
import { getAvailableProviders } from '@/lib/utils/plan-limits';
import { generateRecommendations } from '@/lib/recommendations/generator';
import type { Plan, ParsedResponse, QueryTemplate } from '@/types';

export const POST: APIRoute = async () => {
  const supabase = createServiceClient();

  // Get all active brands with their templates and user plans
  const { data: brands, error } = await supabase
    .from('brands')
    .select(`
      *,
      query_templates (*),
      profiles!inner (plan)
    `)
    .eq('monitoring_active', true);

  if (error || !brands) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch brands', details: error?.message }),
      { status: 500 }
    );
  }

  let successful = 0;
  let failed = 0;

  // Process brands sequentially to avoid saturating LLM APIs
  for (const brand of brands) {
    try {
      const plan = ((brand.profiles as { plan: string })?.plan ?? 'free') as Plan;
      const providers = getAvailableProviders(plan);
      const activeTemplates = (brand.query_templates as QueryTemplate[]).filter((t) => t.is_active);

      if (activeTemplates.length === 0) continue;

      const routerResult = await executeRouter(activeTemplates, providers, brand.name);

      const parsedResponses: ParsedResponse[] = [];

      for (const response of routerResult.responses) {
        const parseResult = parseMention(response.responseText, brand.name, brand.competitors);
        parsedResponses.push({
          provider: response.provider,
          brandMentioned: parseResult.brandMentioned,
          mentionType: parseResult.mentionType,
          sentiment: parseResult.sentiment,
        });

        await supabase.from('llm_responses').upsert(
          {
            brand_id: brand.id,
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

      const scoreResult = calculateScore({
        responses: parsedResponses,
        weights: getDefaultWeights(),
      });

      await supabase.from('visibility_scores').upsert(
        {
          brand_id: brand.id,
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

      await supabase
        .from('brands')
        .update({ last_scanned_at: new Date().toISOString() })
        .eq('id', brand.id);

      // Generate recommendations
      await generateRecommendations(
        brand.id, brand.name, brand.industry, scoreResult, [], brand.competitors
      ).catch((err) => console.error(`Recs failed for ${brand.name}:`, err));

      successful++;
    } catch (err) {
      console.error(`Daily scan failed for brand ${brand.name}:`, err);
      failed++;
    }
  }

  return new Response(
    JSON.stringify({
      message: `Daily scan complete: ${successful} successful, ${failed} failed out of ${brands.length} brands`,
      successful,
      failed,
      total: brands.length,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
};
