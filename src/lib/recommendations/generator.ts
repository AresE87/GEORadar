import { createServiceClient } from '@/lib/supabase/server';
import { analyzeWithOpenAI } from '@/lib/llm/providers/openai';
import type { ScoreResult, LLMResponse } from '@/types';

export async function generateRecommendations(
  brandId: string,
  brandName: string,
  industry: string | null,
  scoreResult: ScoreResult,
  _responses: LLMResponse[],
  competitors: string[]
): Promise<void> {
  const systemPrompt = `You are a GEO (Generative Engine Optimization) expert. Given brand visibility data, generate 5-8 actionable recommendations. Output ONLY valid JSON array.
Each item: { "type": string, "priority": "high"|"medium"|"low", "title": string, "description": string, "action_items": string[], "estimated_impact": string }.
Types: content_gap | citation_opportunity | schema_markup | competitor_comparison | faq_content | definition_page`;

  const userPrompt = `Brand: ${brandName}
Industry: ${industry ?? 'software'}
Score: ${Math.round(scoreResult.overallScore)}/100
Mention Rate: ${Math.round(scoreResult.mentionRate)}%
Primary Rate: ${Math.round(scoreResult.primaryRate)}%
Sentiment: ${Math.round(scoreResult.sentimentScore)}
Competitors found: ${competitors.join(', ') || 'none'}
Providers available: ${scoreResult.providersAvailable}`;

  try {
    const response = await analyzeWithOpenAI(`${systemPrompt}\n\nUser: ${userPrompt}`);

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('Recommendations: No JSON array found in response');
      return;
    }

    const recommendations = JSON.parse(jsonMatch[0]) as Array<{
      type: string;
      priority: string;
      title: string;
      description: string;
      action_items: string[];
      estimated_impact: string;
    }>;

    const supabase = createServiceClient();

    // Delete existing recommendations for this brand
    await supabase.from('recommendations').delete().eq('brand_id', brandId);

    // Insert new recommendations
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const records = recommendations.map((rec, index) => ({
      brand_id: brandId,
      recommendation_type: rec.type,
      priority: rec.priority,
      title: rec.title,
      description: rec.description,
      action_items: rec.action_items,
      estimated_impact: rec.estimated_impact,
      is_premium: index >= 3, // First 3 are free, rest are premium
      expires_at: expiresAt,
    }));

    await supabase.from('recommendations').insert(records);
  } catch (err) {
    console.error('Failed to generate recommendations:', err);
    // Recommendations are auxiliary - don't block the main flow
  }
}
