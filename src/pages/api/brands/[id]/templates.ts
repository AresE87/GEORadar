import type { APIRoute } from 'astro';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';

const CreateTemplateSchema = z.object({
  query_text: z.string().min(5).max(500),
  query_category: z.enum(['brand_direct', 'category_search', 'problem_search', 'comparison']),
});

async function getAuthUser(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
  return user;
}

async function verifyBrandOwnership(brandId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from('brands')
    .select('id')
    .eq('id', brandId)
    .eq('user_id', userId)
    .single();
  return !!data;
}

export const GET: APIRoute = async ({ params, request }) => {
  try {
    const user = await getAuthUser(request);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    if (!(await verifyBrandOwnership(params.id!, user.id))) {
      return new Response(JSON.stringify({ error: 'Brand not found' }), { status: 404 });
    }

    const { data: templates, error } = await supabaseAdmin
      .from('query_templates')
      .select('*')
      .eq('brand_id', params.id!)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return new Response(JSON.stringify(templates), {
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

    if (!(await verifyBrandOwnership(params.id!, user.id))) {
      return new Response(JSON.stringify({ error: 'Brand not found' }), { status: 404 });
    }

    const body = await request.json();
    const parsed = CreateTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
    }

    const { data: template, error } = await supabaseAdmin
      .from('query_templates')
      .insert({
        brand_id: params.id!,
        query_text: parsed.data.query_text,
        query_category: parsed.data.query_category,
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify(template), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Server error' }),
      { status: 500 }
    );
  }
};
