import type { APIRoute } from 'astro';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { generateDefaultTemplates } from '../../../lib/query-templates';

const CreateBrandSchema = z.object({
  name: z.string().min(1).max(100),
  domain: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  industry: z.string().max(100).optional(),
  competitors: z.array(z.string()).max(10).optional(),
  target_keywords: z.array(z.string()).max(20).optional(),
});

export const GET: APIRoute = async ({ request }) => {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { data: brands, error } = await supabaseAdmin
      .from('brands')
      .select(`
        *,
        visibility_scores (
          overall_score, mention_rate, primary_rate, date
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Attach latest score to each brand
    const brandsWithScore = (brands ?? []).map((brand: Record<string, unknown>) => {
      const scores = (brand.visibility_scores as Array<{ date: string; overall_score: number }>) ?? [];
      const latestScore = scores.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0] ?? null;
      const { visibility_scores: _, ...brandData } = brand;
      return { ...brandData, latest_score: latestScore };
    });

    return new Response(JSON.stringify(brandsWithScore), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Server error' }),
      { status: 500 }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const body = await request.json();
    const parsed = CreateBrandSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
    }

    // Check brand limit
    const { count } = await supabaseAdmin
      .from('brands')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const MAX_BRANDS_FREE = parseInt(import.meta.env.MAX_BRANDS_FREE ?? '1');
    if ((count ?? 0) >= MAX_BRANDS_FREE) {
      return new Response(
        JSON.stringify({ error: 'Has alcanzado el límite de marcas del plan Free. Upgrade a Pro.' }),
        { status: 403 }
      );
    }

    // Create brand
    const { data: brand, error } = await supabaseAdmin
      .from('brands')
      .insert({
        user_id: user.id,
        name: parsed.data.name,
        domain: parsed.data.domain ?? null,
        description: parsed.data.description ?? null,
        industry: parsed.data.industry ?? null,
        competitors: parsed.data.competitors ?? [],
        target_keywords: parsed.data.target_keywords ?? [],
      })
      .select()
      .single();

    if (error) throw error;

    // Auto-generate query templates
    const templates = generateDefaultTemplates(
      parsed.data.name,
      parsed.data.industry ?? null,
      parsed.data.competitors ?? [],
      parsed.data.description ?? null
    );

    const templatesWithBrandId = templates.map((t) => ({
      ...t,
      brand_id: brand.id,
    }));

    await supabaseAdmin.from('query_templates').insert(templatesWithBrandId);

    return new Response(JSON.stringify(brand), {
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
