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

    const { brand_id } = await req.json();

    // 1. Obtener brand
    const { data: brand } = await supabase
      .from('brands')
      .select('*')
      .eq('id', brand_id)
      .single();

    if (!brand) {
      return new Response(JSON.stringify({ error: 'Brand not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Obtener últimos 30 días de responses
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: responses } = await supabase
      .from('llm_responses')
      .select('*')
      .eq('brand_id', brand_id)
      .gte('scanned_at', thirtyDaysAgo);

    const { data: scores } = await supabase
      .from('visibility_scores')
      .select('*')
      .eq('brand_id', brand_id)
      .gte('date', thirtyDaysAgo.split('T')[0])
      .order('date', { ascending: false });

    // 3. Analizar patrones
    const allResponses = responses ?? [];
    const totalResponses = allResponses.length;
    const mentionedCount = allResponses.filter((r: { brand_mentioned: boolean }) => r.brand_mentioned).length;
    const mentionRate = totalResponses > 0 ? ((mentionedCount / totalResponses) * 100).toFixed(1) : '0';

    const notMentioned = allResponses.filter((r: { mention_type: string }) => r.mention_type === 'not_mentioned');
    const worstQueries = [...new Set(notMentioned.map((r: { query_text: string }) => r.query_text))].slice(0, 5);

    const competitorCounts: Record<string, number> = {};
    for (const r of allResponses) {
      for (const comp of (r as { competitors_mentioned: string[] }).competitors_mentioned ?? []) {
        competitorCounts[comp] = (competitorCounts[comp] ?? 0) + 1;
      }
    }
    const topCompetitors = Object.entries(competitorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => `${name} (${count} menciones)`);

    const providerBreakdown = ['openai', 'anthropic', 'perplexity'].map((p) => {
      const pResponses = allResponses.filter((r: { llm_provider: string }) => r.llm_provider === p);
      const pMentioned = pResponses.filter((r: { brand_mentioned: boolean }) => r.brand_mentioned).length;
      return `${p}: ${pResponses.length > 0 ? ((pMentioned / pResponses.length) * 100).toFixed(0) : 0}% mención`;
    });

    // 4. Llamar a GPT-4o para generar recomendaciones
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;

    const prompt = `Datos de visibilidad de la brand "${brand.name}":
- Mention rate overall: ${mentionRate}%
- Queries con peor rendimiento (no mencionada): ${worstQueries.join(', ') || 'Ninguno'}
- Competidores que aparecen en su lugar: ${topCompetitors.join(', ') || 'Ninguno'}
- LLMs breakdown: ${providerBreakdown.join(', ')}
- Descripción de la empresa: ${brand.description ?? 'No disponible'}
- Industria: ${brand.industry ?? 'No especificada'}

Genera 5-7 recomendaciones priorizadas para mejorar la visibilidad GEO.
Para cada una: tipo, prioridad, título, descripción, pasos concretos, impacto estimado.
Devuelve SOLO JSON: [{ "recommendation_type": "content_gap"|"citation_opportunity"|"schema_markup"|"competitor_comparison"|"faq_content"|"definition_page", "priority": "critical"|"high"|"medium"|"low", "title": "string", "description": "string", "action_items": ["string"], "estimated_impact": "string" }]`;

    const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Eres un experto en GEO (Generative Engine Optimization) — la práctica de optimizar contenido para aparecer en respuestas de ChatGPT, Claude, Perplexity y otros LLMs. A diferencia del SEO tradicional, los LLMs prefieren: definiciones claras, listas estructuradas, comparaciones explícitas, contenido autoritativo con datos citables, y páginas de FAQ bien estructuradas. Genera recomendaciones específicas y accionables.`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 2000,
      }),
    });

    const gptData = await gptRes.json();
    const rawContent = gptData.choices?.[0]?.message?.content ?? '[]';

    // Parse JSON from response (handle markdown code blocks)
    let recommendations: Array<{
      recommendation_type: string;
      priority: string;
      title: string;
      description: string;
      action_items: string[];
      estimated_impact: string;
    }>;

    try {
      const jsonStr = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      recommendations = JSON.parse(jsonStr);
    } catch {
      recommendations = [];
    }

    // 5. Eliminar recomendaciones anteriores no completadas
    await supabase
      .from('recommendations')
      .delete()
      .eq('brand_id', brand_id)
      .eq('is_completed', false);

    // 6. Insertar nuevas
    if (recommendations.length > 0) {
      const toInsert = recommendations.map((r) => ({
        brand_id,
        recommendation_type: r.recommendation_type,
        priority: r.priority,
        title: r.title,
        description: r.description,
        action_items: r.action_items,
        estimated_impact: r.estimated_impact,
      }));

      await supabase.from('recommendations').insert(toInsert);
    }

    return new Response(
      JSON.stringify({
        recommendations_count: recommendations.length,
        top_priority: recommendations[0]?.priority ?? null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
