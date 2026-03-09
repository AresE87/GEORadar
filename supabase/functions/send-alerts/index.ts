import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
    const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'alerts@georadar.io';

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Buscar brands con caída > 10 puntos
    const { data: todayScores } = await supabase
      .from('visibility_scores')
      .select('brand_id, overall_score, openai_score, anthropic_score, perplexity_score')
      .eq('date', today);

    const { data: yesterdayScores } = await supabase
      .from('visibility_scores')
      .select('brand_id, overall_score')
      .eq('date', yesterday);

    if (!todayScores || !yesterdayScores) {
      return new Response(JSON.stringify({ alerts_sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const yesterdayMap = new Map(
      yesterdayScores.map((s: { brand_id: string; overall_score: number }) => [s.brand_id, s.overall_score])
    );

    let alertsSent = 0;

    for (const score of todayScores) {
      const prevScore = yesterdayMap.get(score.brand_id);
      if (prevScore === undefined) continue;

      const drop = Number(prevScore) - Number(score.overall_score);
      if (drop <= 10) continue;

      // Obtener brand y user
      const { data: brand } = await supabase
        .from('brands')
        .select('name, user_id')
        .eq('id', score.brand_id)
        .single();

      if (!brand) continue;

      const { data: user } = await supabase.auth.admin.getUserById(brand.user_id);
      if (!user?.user?.email) continue;

      // Determinar qué LLM causó la caída
      const providers = [
        { name: 'OpenAI', score: Number(score.openai_score) },
        { name: 'Anthropic', score: Number(score.anthropic_score) },
        { name: 'Perplexity', score: Number(score.perplexity_score) },
      ].sort((a, b) => a.score - b.score);

      const worstProvider = providers[0]!;

      // Enviar alerta
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: user.user.email,
          subject: `⚠️ Tu visibilidad en IA bajó ${Math.round(drop)} puntos — ${brand.name}`,
          html: `
            <h2>Alerta de Visibilidad — ${brand.name}</h2>
            <p>Tu GEO Score bajó <strong>${Math.round(drop)} puntos</strong> (de ${Math.round(Number(prevScore))} a ${Math.round(Number(score.overall_score))}).</p>
            <p><strong>Peor rendimiento:</strong> ${worstProvider.name} (score: ${Math.round(worstProvider.score)})</p>
            <p>Revisa tus recomendaciones en GEORadar para mejorar tu posicionamiento.</p>
            <a href="https://georadar.io/dashboard" style="display:inline-block;padding:12px 24px;background:#3b82f6;color:white;border-radius:8px;text-decoration:none;margin-top:16px;">Ver recomendaciones</a>
          `,
        }),
      });

      alertsSent++;
    }

    return new Response(
      JSON.stringify({ alerts_sent: alertsSent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
