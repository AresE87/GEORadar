import { defineMiddleware } from 'astro:middleware';
import { createServerClient } from '@/lib/supabase/server';

const PUBLIC_PATHS = ['/', '/audit', '/login', '/api/audit/', '/api/webhooks/'];

function isPublicPath(pathname: string): boolean {
  // Exact matches for pages
  if (pathname === '/' || pathname === '/audit' || pathname === '/login') return true;
  // Prefix matches for APIs
  if (pathname.startsWith('/api/audit/')) return true;
  if (pathname.startsWith('/api/webhooks/')) return true;
  // Static assets
  if (pathname.startsWith('/_astro/') || pathname.startsWith('/favicon')) return true;
  return false;
}

function isSupabaseConfigured(): boolean {
  const url = import.meta.env.SUPABASE_URL ?? '';
  return url.length > 0 && !url.includes('xxx');
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, cookies, redirect, url } = context;
  const pathname = url.pathname;

  // For public pages, don't require Supabase at all
  if (isPublicPath(pathname)) {
    if (isSupabaseConfigured()) {
      try {
        const supabase = createServerClient(request, cookies);
        context.locals.supabase = supabase;
        const { data: { user } } = await supabase.auth.getUser();
        context.locals.user = user;

        // If logged in and visiting /login, redirect to dashboard
        if (pathname === '/login' && user) {
          return redirect('/dashboard');
        }
      } catch {
        // Supabase not available - continue without auth
        context.locals.supabase = null as never;
        context.locals.user = null;
      }
    } else {
      context.locals.supabase = null as never;
      context.locals.user = null;
    }
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
    if (isSupabaseConfigured()) {
      context.locals.supabase = createServerClient(request, cookies);
    }
    context.locals.user = null;
    return next();
  }

  // All other routes require Supabase and auth
  if (!isSupabaseConfigured()) {
    if (pathname.startsWith('/dashboard')) {
      return redirect('/login');
    }
    return new Response(
      JSON.stringify({ error: 'Service not configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createServerClient(request, cookies);
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

  // API routes - require auth
  if (pathname.startsWith('/api/')) {
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return next();
  }

  return next();
});
