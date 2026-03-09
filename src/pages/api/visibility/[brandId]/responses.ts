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
    const provider = url.searchParams.get('provider');
    const mentionType = url.searchParams.get('mention_type');
    const page = parseInt(url.searchParams.get('page') ?? '1');
    const limit = parseInt(url.searchParams.get('limit') ?? '20');
    const offset = (page - 1) * limit;

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

    let query = supabaseAdmin
      .from('llm_responses')
      .select('*', { count: 'exact' })
      .eq('brand_id', params.brandId!)
      .order('scanned_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (provider) {
      query = query.eq('llm_provider', provider);
    }
    if (mentionType) {
      query = query.eq('mention_type', mentionType);
    }

    const { data: responses, error, count } = await query;
    if (error) throw error;

    return new Response(
      JSON.stringify({
        responses: responses ?? [],
        total: count ?? 0,
        page,
        limit,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Server error' }),
      { status: 500 }
    );
  }
};
