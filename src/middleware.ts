import { defineMiddleware } from 'astro:middleware';
import { createServerClient } from '@/lib/supabase/server';

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, cookies, redirect, url } = context;
  const pathname = url.pathname;

  // Create Supabase client for auth'd routes
  const supabase = createServerClient(request, cookies);

  // Public audit API - no auth needed
  if (pathname.startsWith('/api/audit/')) {
    context.locals.supabase = supabase;
    context.locals.user = null;
    return next();
  }

  // Webhook routes - no auth needed (verified by signature)
  if (pathname.startsWith('/api/webhooks/')) {
    context.locals.supabase = supabase;
    context.locals.user = null;
    return next();
  }

  // Cron routes - verify service_role_key
  if (pathname.startsWith('/api/cron/')) {
    const authHeader = request.headers.get('Authorization');
    const expectedToken = `Bearer ${import.meta.env.SUPABASE_SERVICE_ROLE_KEY}`;
    if (authHeader !== expectedToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    context.locals.supabase = supabase;
    context.locals.user = null;
    return next();
  }

  // Get current user session
  const { data: { user } } = await supabase.auth.getUser();

  context.locals.supabase = supabase;
  context.locals.user = user;

  // Dashboard routes - require auth
  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      return redirect('/login');
    }
    return next();
  }

  // API routes (except audit, webhooks, cron) - require auth
  if (pathname.startsWith('/api/')) {
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return next();
  }

  // Public routes
  return next();
});
