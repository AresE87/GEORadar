import type { APIRoute } from 'astro';
import { getUserPlanLimits } from '@/lib/utils/plan-limits';
import type { Plan } from '@/types';

export const GET: APIRoute = async ({ locals, params, url }) => {
  const { supabase, user } = locals;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const brandId = params.brandId;
  const requestedDays = parseInt(url.searchParams.get('days') ?? '30', 10);

  // Get user plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  const plan = (profile?.plan ?? 'free') as Plan;
  const limits = getUserPlanLimits(plan);
  const days = limits.historyDays === -1 ? requestedDays : Math.min(requestedDays, limits.historyDays);

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: scores, error } = await supabase
    .from('visibility_scores')
    .select('*')
    .eq('brand_id', brandId)
    .gte('score_date', since.toISOString().split('T')[0])
    .order('score_date', { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ scores }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
