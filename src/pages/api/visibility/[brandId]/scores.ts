import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';

async function getAuthUser(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
  return user;
}

export const GET: APIRoute = async ({ params, request }) => {
  try {
    const user = await getAuthUser(request);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') ?? '30');
    const provider = url.searchParams.get('provider');

    // Verify brand ownership
    const { data: brand } = await supabaseAdmin
      .from('brands')
      .select('id')
      .eq('id', params.brandId!)
      .eq('user_id', user.id)
      .single();

    if (!brand) {
      return new Response(JSON.stringify({ error: 'Brand not found' }), { status: 404 });
    }

    const fromDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    const { data: scores, error } = await supabaseAdmin
      .from('visibility_scores')
      .select('*')
      .eq('brand_id', params.brandId!)
      .gte('date', fromDate)
      .order('date', { ascending: true });

    if (error) throw error;

    // Format for recharts
    const formatted = (scores ?? []).map((s: Record<string, unknown>) => ({
      date: s.date,
      overall_score: Number(s.overall_score),
      mention_rate: Number(s.mention_rate),
      primary_rate: Number(s.primary_rate),
      sentiment_score: Number(s.sentiment_score),
      openai_score: Number(s.openai_score),
      anthropic_score: Number(s.anthropic_score),
      perplexity_score: Number(s.perplexity_score),
      queries_run: s.queries_run,
    }));

    return new Response(JSON.stringify(formatted), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Server error' }),
      { status: 500 }
    );
  }
};
