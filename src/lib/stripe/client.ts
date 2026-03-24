import Stripe from 'stripe';

function getClient(): Stripe {
  return new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover' as const,
  });
}

export async function createCheckoutSession(
  userId: string,
  plan: 'pro' | 'agency',
  email: string
): Promise<string> {
  const stripe = getClient();

  const priceId =
    plan === 'pro'
      ? import.meta.env.STRIPE_PRO_PRICE_ID
      : import.meta.env.STRIPE_AGENCY_PRICE_ID;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${import.meta.env.PUBLIC_APP_URL}/dashboard?upgraded=true`,
    cancel_url: `${import.meta.env.PUBLIC_APP_URL}/dashboard/settings`,
    customer_email: email,
    metadata: { user_id: userId, plan },
  });

  return session.url ?? '';
}

export async function createPortalSession(customerId: string): Promise<string> {
  const stripe = getClient();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${import.meta.env.PUBLIC_APP_URL}/dashboard/settings`,
  });

  return session.url;
}

export async function getSubscription(subscriptionId: string) {
  const stripe = getClient();
  return stripe.subscriptions.retrieve(subscriptionId);
}

export { getClient };
