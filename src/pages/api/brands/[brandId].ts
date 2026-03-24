import type { APIRoute } from 'astro';
import { z } from 'zod';

const UpdateBrandInput = z.object({
  name: z.string().min(1).max(100).optional(),
  domain: z.string().optional(),
  description: z.string().optional(),
  industry: z.string().optional(),
  competitors: z.array(z.string()).max(10).optional(),
  target_keywords: z.array(z.string()).max(20).optional(),
  monitoring_active: z.boolean().optional(),
});

export const GET: APIRoute = async ({ locals, params }) => {
  const { supabase, user } = locals;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { data: brand, error } = await supabase
    .from('brands')
    .select(`
      *,
      query_templates (*),
      visibility_scores (overall_score, score_date)
    `)
    .eq('id', params.brandId)
    .single();

  if (error || !brand) {
    return new Response(JSON.stringify({ error: 'Brand not found' }), { status: 404 });
  }

  return new Response(JSON.stringify({ brand }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const PATCH: APIRoute = async ({ locals, params, request }) => {
  const { supabase, user } = locals;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await request.json();
  const parsed = UpdateBrandInput.safeParse(body);

  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }),
      { status: 400 }
    );
  }

  const { data: brand, error } = await supabase
    .from('brands')
    .update(parsed.data)
    .eq('id', params.brandId)
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ brand }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ locals, params }) => {
  const { supabase, user } = locals;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { error } = await supabase
    .from('brands')
    .delete()
    .eq('id', params.brandId);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(null, { status: 204 });
};
