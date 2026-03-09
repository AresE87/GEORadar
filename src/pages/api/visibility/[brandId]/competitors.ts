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

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: responses } = await supabaseAdmin
      .from('llm_responses')
      .select('competitors_mentioned, query_text, mention_position')
      .eq('brand_id', params.brandId!)
      .gte('scanned_at', thirtyDaysAgo);

    const competitorStats: Record<string, { count: number; positions: number[] }> = {};
    const totalQueries = (responses ?? []).length;

    for (const r of responses ?? []) {
      const competitors = (r as { competitors_mentioned: string[] }).competitors_mentioned ?? [];
      for (const comp of competitors) {
        if (!competitorStats[comp]) {
          competitorStats[comp] = { count: 0, positions: [] };
        }
        competitorStats[comp].count++;
      }
    }

    const result = Object.entries(competitorStats)
      .map(([name, stats]) => ({
        competitor_name: name,
        appearance_count: stats.count,
        avg_position: stats.positions.length > 0
          ? Math.round(stats.positions.reduce((a, b) => a + b, 0) / stats.positions.length * 10) / 10
          : null,
        percentage: totalQueries > 0
          ? Math.round((stats.count / totalQueries) * 1000) / 10
          : 0,
      }))
      .sort((a, b) => b.appearance_count - a.appearance_count);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Server error' }),
      { status: 500 }
    );
  }
};
