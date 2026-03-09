import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';

async function getAuthUser(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
  return user;
}

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const user = await getAuthUser(request);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const brandId = params.brandId!;

    // Verify brand ownership
    const { data: brand } = await supabaseAdmin
      .from('brands')
      .select('id, plan, last_scanned_at')
      .eq('id', brandId)
      .eq('user_id', user.id)
      .single();

    if (!brand) {
      return new Response(JSON.stringify({ error: 'Brand not found' }), { status: 404 });
    }

    // Check daily scan limit (free plan: 1 scan per day)
    if (brand.plan === 'free' && brand.last_scanned_at) {
      const lastScan = new Date(brand.last_scanned_at);
      const now = new Date();
      if (lastScan.toDateString() === now.toDateString()) {
        return new Response(
          JSON.stringify({ error: 'Ya realizaste un scan hoy. Upgrade a Pro para más scans.' }),
          { status: 429 }
        );
      }
    }

    // Invoke edge function
    const { data, error } = await supabaseAdmin.functions.invoke('run-visibility-scan', {
      body: { brand_id: brandId },
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({
        ...data,
        estimated_duration_seconds: 30,
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
