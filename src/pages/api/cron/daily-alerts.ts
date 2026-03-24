import type { APIRoute } from 'astro';
import { createServiceClient } from '@/lib/supabase/server';
import { sendScoreAlertEmail } from '@/lib/email/resend';

export const POST: APIRoute = async () => {
  const supabase = createServiceClient();

  // Get brands with Pro/Agency users that have monitoring active
  const { data: brands, error } = await supabase
    .from('brands')
    .select(`
      id, name,
      profiles!inner (email, plan)
    `)
    .eq('monitoring_active', true)
    .neq('profiles.plan', 'free');

  if (error || !brands) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch brands' }),
      { status: 500 }
    );
  }

  let alertsSent = 0;

  for (const brand of brands) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      const { data: scores } = await supabase
        .from('visibility_scores')
        .select('overall_score, score_date')
        .eq('brand_id', brand.id)
        .in('score_date', [today, yesterday])
        .order('score_date', { ascending: false });

      if (!scores || scores.length < 2) continue;

      const todayScore = scores.find((s) => s.score_date === today);
      const yesterdayScore = scores.find((s) => s.score_date === yesterday);

      if (!todayScore || !yesterdayScore) continue;

      const change = Number(todayScore.overall_score) - Number(yesterdayScore.overall_score);
      if (Math.abs(change) < 10) continue;

      const profiles = brand.profiles as unknown as { email: string; plan: string };
      const profile = profiles;
      const direction = change > 0 ? 'up' : 'down';

      await sendScoreAlertEmail(
        profile.email,
        brand.name,
        Number(yesterdayScore.overall_score),
        Number(todayScore.overall_score),
        direction
      );

      alertsSent++;
    } catch (err) {
      console.error(`Alert failed for brand ${brand.name}:`, err);
    }
  }

  return new Response(
    JSON.stringify({ message: `Sent ${alertsSent} alerts`, alertsSent }),
    { headers: { 'Content-Type': 'application/json' } }
  );
};
