import type { APIRoute } from 'astro';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';

const UpdateBrandSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  domain: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  industry: z.string().max(100).optional(),
  competitors: z.array(z.string()).max(10).optional(),
  target_keywords: z.array(z.string()).max(20).optional(),
  monitoring_active: z.boolean().optional(),
});

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

    const { data: brand, error } = await supabaseAdmin
      .from('brands')
      .select(`
        *,
        query_templates (*),
        visibility_scores (*)
      `)
      .eq('id', params.id!)
      .eq('user_id', user.id)
      .single();

    if (error || !brand) {
      return new Response(JSON.stringify({ error: 'Brand not found' }), { status: 404 });
    }

    return new Response(JSON.stringify(brand), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Server error' }),
      { status: 500 }
    );
  }
};

export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const user = await getAuthUser(request);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const body = await request.json();
    const parsed = UpdateBrandSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
    }

    const { data: brand, error } = await supabaseAdmin
      .from('brands')
      .update(parsed.data)
      .eq('id', params.id!)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error || !brand) {
      return new Response(JSON.stringify({ error: 'Brand not found' }), { status: 404 });
    }

    return new Response(JSON.stringify(brand), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Server error' }),
      { status: 500 }
    );
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    const user = await getAuthUser(request);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const { error } = await supabaseAdmin
      .from('brands')
      .delete()
      .eq('id', params.id!)
      .eq('user_id', user.id);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Server error' }),
      { status: 500 }
    );
  }
};
