import type { APIRoute } from 'astro';
import { createServerClient } from '@/lib/supabase/server';

export const GET: APIRoute = async ({ request, cookies, redirect, url }) => {
  const code = url.searchParams.get('code');

  if (!code) {
    return redirect('/login?error=no_code');
  }

  const supabase = createServerClient(request, cookies);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirect('/login?error=auth_failed');
  }

  // Check if user has completed onboarding
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', user.id)
      .single();

    if (profile && !profile.onboarding_completed) {
      return redirect('/dashboard?onboarding=true');
    }
  }

  return redirect('/dashboard');
};
