import type { APIRoute } from 'astro';
import { z } from 'zod';
import { canCreateBrand } from '@/lib/utils/plan-limits';
import type { Plan } from '@/types';

const CreateBrandInput = z.object({
  name: z.string().min(1).max(100),
  domain: z.string().optional(),
  description: z.string().optional(),
  industry: z.string().optional(),
  competitors: z.array(z.string()).max(10).optional(),
  target_keywords: z.array(z.string()).max(20).optional(),
});

export const GET: APIRoute = async ({ locals }) => {
  const { supabase, user } = locals;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { data: brands, error } = await supabase
    .from('brands')
    .select(`
      *,
      visibility_scores (overall_score, score_date)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ brands }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ locals, request }) => {
  const { supabase, user } = locals;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await request.json();
  const parsed = CreateBrandInput.safeParse(body);

  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }),
      { status: 400 }
    );
  }

  // Check plan limits
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  const plan = (profile?.plan ?? 'free') as Plan;

  const { count } = await supabase
    .from('brands')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (!canCreateBrand(plan, count ?? 0)) {
    return new Response(
      JSON.stringify({ error: 'Brand limit reached. Upgrade to Pro.' }),
      { status: 403 }
    );
  }

  const { data: brand, error } = await supabase
    .from('brands')
    .insert({
      user_id: user.id,
      ...parsed.data,
      competitors: parsed.data.competitors ?? [],
      target_keywords: parsed.data.target_keywords ?? [],
    })
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ brand }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
