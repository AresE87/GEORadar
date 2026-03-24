import type { APIRoute } from 'astro';
import { getUserPlanLimits } from '@/lib/utils/plan-limits';
import type { Plan } from '@/types';

export const GET: APIRoute = async ({ locals, params, url }) => {
  const { supabase, user } = locals;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const brandId = params.brandId;
  const provider = url.searchParams.get('provider');
  const mentionType = url.searchParams.get('mention_type');
  const date = url.searchParams.get('date');

  // Get user plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  const plan = (profile?.plan ?? 'free') as Plan;
  const limits = getUserPlanLimits(plan);

  let query = supabase
    .from('llm_responses')
    .select('*')
    .eq('brand_id', brandId);

  // Free users only see OpenAI responses
  if (plan === 'free') {
    query = query.eq('llm_provider', 'openai');
  } else if (provider) {
    query = query.eq('llm_provider', provider);
  }

  if (mentionType) {
    query = query.eq('mention_type', mentionType);
  }

  if (date) {
    query = query.eq('scan_date', date);
  }

  query = query.order('created_at', { ascending: false }).limit(50);

  const { data: responses, error } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // Get locked count for free users
  let lockedCount: number | undefined;
  if (plan === 'free') {
    const { count } = await supabase
      .from('llm_responses')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .neq('llm_provider', 'openai');
    lockedCount = count ?? 0;
  }

  return new Response(
    JSON.stringify({ responses, locked_count: lockedCount }),
    { headers: { 'Content-Type': 'application/json' } }
  );
};
