import type { APIRoute } from 'astro';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { getAuditScoreLabel } from '../../../lib/score';

const AuditSchema = z.object({
  brand_name: z.string().min(1).max(100),
  domain: z.string().max(200).optional(),
  email: z.string().email().optional(),
});

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = parseInt(import.meta.env.AUDIT_TOOL_RATE_LIMIT_HOUR ?? '20');
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 3600000 });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('cf-connecting-ip') ?? 'unknown';
    if (!checkRateLimit(ip)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Intenta en 1 hora.' }),
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = AuditSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
    }

    const { brand_name, domain, email } = parsed.data;
    const OPENAI_API_KEY = import.meta.env.OPENAI_API_KEY ?? '';

    // 3 queries representativas en paralelo usando gpt-4o-mini
    const queries = [
      `¿Qué es ${brand_name}?`,
      `¿Cuáles son las mejores herramientas similares a ${brand_name}?`,
      `¿${brand_name} es buena opción o existen mejores alternativas?`,
    ];

    const results = await Promise.all(
      queries.map(async (query) => {
        try {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: 'Eres un asistente útil. Responde la pregunta del usuario directamente.',
                },
                { role: 'user', content: query },
              ],
              temperature: 0.1,
              max_tokens: 600,
            }),
          });
          const data = await res.json();
          return {
            query,
            text: data.choices?.[0]?.message?.content ?? '',
            error: null,
          };
        } catch (err) {
          return {
            query,
            text: '',
            error: err instanceof Error ? err.message : 'Error',
          };
        }
      })
    );

    // Analizar menciones
    const brandLower = brand_name.toLowerCase();
    const brandPattern = new RegExp(brand_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const responseItems = results.map((r) => {
      const mentioned = brandPattern.test(r.text);
      let context: string | null = null;
      if (mentioned) {
        const sentences = r.text.split(/[.!?\n]+/).filter((s: string) => s.trim().length > 0);
        const match = sentences.find((s: string) => brandPattern.test(s));
        context = match ? match.trim().slice(0, 200) : null;
      }
      return { llm: 'ChatGPT (GPT-4o-mini)', mentioned, context };
    });

    // Calcular score simplificado
    const mentionCount = responseItems.filter((r) => r.mentioned).length;
    let score: number;

    if (mentionCount === 0) score = Math.round(Math.random() * 15 + 5); // 5-20
    else if (mentionCount === 1) score = Math.round(Math.random() * 20 + 30); // 30-50
    else if (mentionCount === 2) score = Math.round(Math.random() * 20 + 55); // 55-75
    else score = Math.round(Math.random() * 15 + 80); // 80-95

    const scoreLabel = getAuditScoreLabel(score);

    // Quick wins basados en reglas fijas
    const quickWins: string[] = [];
    if (mentionCount === 0) {
      quickWins.push('Crea una página "¿Qué es [tu marca]?" con una definición clara y concisa.');
      quickWins.push('Publica comparativas detalladas: "[tu marca] vs [competidor]" en tu blog.');
      quickWins.push('Estructura tu contenido con FAQ schema markup para que los LLMs lo citen.');
    } else if (mentionCount < 3) {
      quickWins.push('Mejora tu página "About" con datos citables y resultados concretos.');
      quickWins.push('Crea contenido de comparación directa con tus competidores principales.');
      quickWins.push('Agrega testimonios y caso de estudio con métricas específicas.');
    } else {
      quickWins.push('Mantén tu contenido actualizado — los LLMs priorizan información reciente.');
      quickWins.push('Expande tu presencia en categorías adyacentes para capturar más queries.');
      quickWins.push('Monitorea cambios semanalmente para detectar caídas tempranas.');
    }

    const auditResult = {
      score,
      score_label: scoreLabel,
      responses: responseItems,
      quick_wins: quickWins,
      cta: 'Monitorea tu visibilidad semana a semana en GEORadar →',
    };

    // Guardar lead
    await supabaseAdmin.from('audit_leads').insert({
      email: email ?? null,
      domain: domain ?? null,
      brand_name,
      audit_result: auditResult,
    });

    // Enviar email con reporte si se proporcionó
    if (email) {
      const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;
      const FROM_EMAIL = import.meta.env.RESEND_FROM_EMAIL ?? 'alerts@georadar.io';
      if (RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: email,
            subject: `Tu GEO Score: ${score}/100 — ${brand_name}`,
            html: `
              <h2>Resultado de tu AI Brand Audit</h2>
              <p><strong>${brand_name}</strong>: ${scoreLabel}</p>
              <p>GEO Score: <strong>${score}/100</strong></p>
              <h3>Quick Wins</h3>
              <ul>${quickWins.map((w) => `<li>${w}</li>`).join('')}</ul>
              <p><a href="https://georadar.io/dashboard">Monitorea tu visibilidad en GEORadar</a></p>
            `,
          }),
        });
      }
    }

    return new Response(JSON.stringify(auditResult), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Server error' }),
      { status: 500 }
    );
  }
};
