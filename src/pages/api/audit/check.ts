import type { APIRoute } from 'astro';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { executeAuditRouter } from '@/lib/llm/router';
import { parseMention } from '@/lib/parser/mention-parser';
import { calculateScore, getDefaultWeights } from '@/lib/score/calculator';
import { getScoreLabel } from '@/lib/utils/score-labels';
import { queryOpenAI } from '@/lib/llm/providers/openai';
import type { AuditResult, AuditResponseItem, QuickWin, ParsedResponse } from '@/types';

const AuditInput = z.object({
  brand_name: z.string().min(1).max(100),
  domain: z.string().optional(),
  email: z.string().email().optional(),
});

function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // 1. Validate input
    const body = await request.json();
    const parsed = AuditInput.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { brand_name, domain, email } = parsed.data;

    // 2. Rate limit check
    const supabase = createServiceClient();
    const ip = getClientIp(request);

    const { data: allowed } = await supabase.rpc('check_audit_rate_limit', {
      p_ip: ip,
    });

    if (allowed === false) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Try again later.', retry_after_seconds: 1800 }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Generate audit queries
    const domainCategory = domain ? domain.replace(/\.\w+$/, '') : 'software';
    const auditQueries = [
      `What is ${brand_name}?`,
      `Best ${domainCategory} tools and alternatives`,
      `${brand_name} reviews and reputation`,
    ];

    // 4. Execute audit router (OpenAI only, gpt-4o-mini)
    const routerResult = await executeAuditRouter(brand_name, auditQueries);

    if (routerResult.responses.length === 0) {
      return new Response(
        JSON.stringify({ error: 'All AI engines are temporarily unavailable. Please try again.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Parse mentions
    const parsedResponses: ParsedResponse[] = [];
    const auditResponses: AuditResponseItem[] = [];

    for (const response of routerResult.responses) {
      const parseResult = parseMention(response.responseText, brand_name, []);
      parsedResponses.push({
        provider: response.provider,
        brandMentioned: parseResult.brandMentioned,
        mentionType: parseResult.mentionType,
        sentiment: parseResult.sentiment,
      });
      auditResponses.push({
        provider: response.provider,
        query: response.queryText,
        response_excerpt: response.responseText.slice(0, 500),
        brand_mentioned: parseResult.brandMentioned,
        mention_type: parseResult.mentionType,
      });
    }

    // 6. Calculate score
    const scoreResult = calculateScore({
      responses: parsedResponses,
      weights: getDefaultWeights(),
    });

    const scoreLabel = getScoreLabel(scoreResult.overallScore);

    // 7. Generate quick wins
    let quickWins: QuickWin[] = [];
    try {
      const mentionSummary = `Score: ${Math.round(scoreResult.overallScore)}, Mentions: ${scoreResult.totalMentions}/${scoreResult.totalQueries}, Primary: ${scoreResult.totalPrimary}`;
      const quickWinsResponse = await queryOpenAI(
        `System: Generate 3 quick actionable recommendations to improve AI visibility for the brand. Output ONLY valid JSON array. Each item: {"title": string, "description": string, "impact": "high"|"medium"|"low"}.\nUser: Brand: ${brand_name}. ${mentionSummary}.`
      );
      const jsonMatch = quickWinsResponse.responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        quickWins = JSON.parse(jsonMatch[0]) as QuickWin[];
      }
    } catch {
      quickWins = [
        { title: 'Create a knowledge base', description: 'Build comprehensive FAQ content that AI can reference.', impact: 'high' },
        { title: 'Improve online presence', description: 'Ensure consistent brand information across platforms.', impact: 'medium' },
        { title: 'Get more citations', description: 'Publish content on authoritative sources that AI models train on.', impact: 'high' },
      ];
    }

    // 8. Save audit lead
    const { data: auditLead } = await supabase
      .from('audit_leads')
      .insert({
        email,
        brand_name,
        domain,
        audit_result: {
          score: Math.round(scoreResult.overallScore),
          label: scoreLabel.label,
          color: scoreLabel.color,
          responses: auditResponses,
          quick_wins: quickWins,
        },
        ip_address: ip,
        user_agent: request.headers.get('user-agent'),
      })
      .select('id')
      .single();

    // 9. Return result
    const result: AuditResult = {
      score: Math.round(scoreResult.overallScore),
      label: scoreLabel.label,
      color: scoreLabel.color,
      responses: auditResponses,
      quick_wins: quickWins,
      audit_id: auditLead?.id ?? '',
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Audit check error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
