import type { APIRoute } from 'astro';
import { z } from 'zod';
import { createCheckoutSession } from '@/lib/stripe/client';

const CheckoutInput = z.object({
  plan: z.enum(['pro', 'agency']),
});

export const POST: APIRoute = async ({ locals, request }) => {
  const { supabase, user } = locals;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await request.json();
  const parsed = CheckoutInput.safeParse(body);

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid plan' }), { status: 400 });
  }

  try {
    const checkoutUrl = await createCheckoutSession(
      user.id,
      parsed.data.plan,
      user.email ?? ''
    );

    return new Response(JSON.stringify({ checkout_url: checkoutUrl }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Checkout error:', err);
    return new Response(JSON.stringify({ error: 'Failed to create checkout' }), { status: 500 });
  }
};
