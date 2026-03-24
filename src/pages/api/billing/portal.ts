import type { APIRoute } from 'astro';
import { createPortalSession } from '@/lib/stripe/client';

export const POST: APIRoute = async ({ locals }) => {
  const { supabase, user } = locals;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return new Response(JSON.stringify({ error: 'No subscription found' }), { status: 404 });
  }

  try {
    const portalUrl = await createPortalSession(profile.stripe_customer_id);
    return new Response(JSON.stringify({ portal_url: portalUrl }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Portal error:', err);
    return new Response(JSON.stringify({ error: 'Failed to create portal' }), { status: 500 });
  }
};
