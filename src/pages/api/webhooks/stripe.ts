import type { APIRoute } from 'astro';
import { getClient } from '@/lib/stripe/client';
import { createServiceClient } from '@/lib/supabase/server';
import { sendPaymentFailedEmail } from '@/lib/email/resend';
import type Stripe from 'stripe';

export const POST: APIRoute = async ({ request }) => {
  const stripe = getClient();
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return new Response(JSON.stringify({ error: 'Missing signature' }), { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      import.meta.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook verification failed:', err);
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 });
  }

  const supabase = createServiceClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const plan = session.metadata?.plan;

      if (userId && plan) {
        await supabase
          .from('profiles')
          .update({
            plan,
            stripe_customer_id: session.customer as string,
          })
          .eq('id', userId);

        await supabase.from('subscriptions').upsert(
          {
            user_id: userId,
            stripe_subscription_id: session.subscription as string,
            plan,
            status: 'active',
          },
          { onConflict: 'user_id' }
        );
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscription.id)
        .single();

      if (sub) {
        const status = subscription.status === 'active' ? 'active' :
                       subscription.status === 'past_due' ? 'past_due' :
                       subscription.status === 'canceled' ? 'canceled' : 'active';

        await supabase
          .from('subscriptions')
          .update({
            status,
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq('stripe_subscription_id', subscription.id);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscription.id)
        .single();

      if (sub) {
        await supabase
          .from('profiles')
          .update({ plan: 'free' })
          .eq('id', sub.user_id);

        await supabase
          .from('subscriptions')
          .update({ plan: 'free', status: 'canceled' })
          .eq('stripe_subscription_id', subscription.id);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? '';

      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('stripe_customer_id', customerId)
        .single();

      if (profile) {
        const subId = (invoice as unknown as { subscription?: string }).subscription ?? '';
        if (subId) {
          await supabase
            .from('subscriptions')
            .update({ status: 'past_due' })
            .eq('stripe_subscription_id', subId);
        }

        await sendPaymentFailedEmail(profile.email, profile.full_name ?? '');
      }
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
