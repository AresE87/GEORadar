import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

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

    const { data: brand } = await supabaseAdmin
      .from('brands')
      .select('id')
      .eq('id', params.brandId!)
      .eq('user_id', user.id)
      .single();

    if (!brand) {
      return new Response(JSON.stringify({ error: 'Brand not found' }), { status: 404 });
    }

    const priorityOrder = ['critical', 'high', 'medium', 'low'];
    const { data: recommendations, error } = await supabaseAdmin
      .from('recommendations')
      .select('*')
      .eq('brand_id', params.brandId!)
      .eq('is_completed', false)
      .order('generated_at', { ascending: false });

    if (error) throw error;

    // Sort by priority
    const sorted = (recommendations ?? []).sort((a: { priority: string }, b: { priority: string }) => {
      return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
    });

    return new Response(JSON.stringify(sorted), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Server error' }),
      { status: 500 }
    );
  }
};

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const user = await getAuthUser(request);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'complete') {
      const body = await request.json();
      const recommendationId = body.recommendation_id;

      const { error } = await supabaseAdmin
        .from('recommendations')
        .update({ is_completed: true })
        .eq('id', recommendationId)
        .eq('brand_id', params.brandId!);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Server error' }),
      { status: 500 }
    );
  }
};
