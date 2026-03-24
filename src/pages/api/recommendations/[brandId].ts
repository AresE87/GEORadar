import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals, params }) => {
  const { supabase, user } = locals;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { data: recommendations, error } = await supabase
    .from('recommendations')
    .select('*')
    .eq('brand_id', params.brandId)
    .order('priority', { ascending: true })
    .order('is_premium', { ascending: true });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ recommendations }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
