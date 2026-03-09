import { useState } from 'react';
import type { AuditResult } from '../lib/types';

type AuditState = 'idle' | 'scanning' | 'done' | 'error';

interface ScanStep {
  label: string;
  done: boolean;
}

export default function AuditTool({ embedded = false }: { embedded?: boolean }) {
  const [brandName, setBrandName] = useState('');
  const [domain, setDomain] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<AuditState>('idle');
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState('');
  const [steps, setSteps] = useState<ScanStep[]>([
    { label: 'Consultando ChatGPT...', done: false },
    { label: 'Analizando respuestas...', done: false },
    { label: 'Calculando tu GEO Score...', done: false },
  ]);
  const [cooldown, setCooldown] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName.trim() || cooldown) return;

    setState('scanning');
    setError('');
    setResult(null);

    // Animate steps
    const newSteps = [...steps].map((s) => ({ ...s, done: false }));
    setSteps(newSteps);

    const stepTimers = [
      setTimeout(() => setSteps((prev) => prev.map((s, i) => i === 0 ? { ...s, done: true } : s)), 3000),
      setTimeout(() => setSteps((prev) => prev.map((s, i) => i <= 1 ? { ...s, done: true } : s)), 6000),
    ];

    try {
      const res = await fetch('/api/audit/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_name: brandName.trim(),
          domain: domain.trim() || undefined,
          email: email.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Error en el análisis');
      }

      const data = await res.json();
      setSteps((prev) => prev.map((s) => ({ ...s, done: true })));
      setTimeout(() => {
        setResult(data);
        setState('done');
      }, 500);

      // Cooldown de 60s
      setCooldown(true);
      setTimeout(() => setCooldown(false), 60000);
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      stepTimers.forEach(clearTimeout);
    }
  };

  const scoreColorClass = (score: number) => {
    if (score <= 30) return 'text-red-500';
    if (score <= 60) return 'text-orange-500';
    if (score <= 80) return 'text-yellow-500';
    return 'text-green-500';
  };

  const scoreBgClass = (score: number) => {
    if (score <= 30) return 'bg-red-50 border-red-200';
    if (score <= 60) return 'bg-orange-50 border-orange-200';
    if (score <= 80) return 'bg-yellow-50 border-yellow-200';
    return 'bg-green-50 border-green-200';
  };

  return (
    <div className={`w-full max-w-2xl mx-auto ${embedded ? '' : 'p-4'}`}>
      {/* Form */}
      {state === 'idle' || state === 'error' ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nombre de tu marca o empresa *
            </label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Ej: Notion, Linear, tu-empresa.com"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Dominio (opcional)
            </label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="Ej: tuempresa.com"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Tu email para recibir el reporte completo (opcional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={cooldown}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" />
              <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" />
            </svg>
            {cooldown ? 'Espera 60s para otro análisis' : 'Analizar mi visibilidad en IA'}
          </button>
        </form>
      ) : null}

      {/* Scanning animation */}
      {state === 'scanning' && (
        <div className="space-y-4 py-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                {step.done ? (
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  <div className="w-5 h-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin flex-shrink-0" />
                )}
                <span className={step.done ? 'text-green-700 dark:text-green-400' : 'text-slate-600 dark:text-slate-400'}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {state === 'done' && result && (
        <div className="space-y-6">
          {/* Score card */}
          <div className={`rounded-xl border p-6 text-center ${scoreBgClass(result.score)}`}>
            <p className={`text-6xl font-bold ${scoreColorClass(result.score)}`}>
              {result.score}
            </p>
            <p className="text-sm font-medium text-slate-600 mt-1">/100</p>
            <p className={`text-lg font-semibold mt-2 ${scoreColorClass(result.score)}`}>
              {result.score_label}
            </p>
          </div>

          {/* Response cards */}
          <div className="space-y-3">
            {result.responses.map((r, i) => (
              <div
                key={i}
                className={`rounded-xl border p-4 ${
                  r.mentioned
                    ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                    : 'bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium">{r.llm}</span>
                  {r.mentioned ? (
                    <span className="text-xs bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-0.5 rounded-full">
                      Te mencionó
                    </span>
                  ) : (
                    <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
                      No te mencionó
                    </span>
                  )}
                </div>
                {r.context && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 italic">
                    "{r.context}"
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Quick wins */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
              Quick Wins para Mejorar
            </h4>
            <ul className="space-y-2">
              {result.quick_wins.map((win, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <span className="text-blue-500 mt-0.5">→</span>
                  {win}
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div className="text-center space-y-3">
            <a
              href="/dashboard"
              className="inline-block w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-lg transition-colors"
            >
              Empezar gratis — sin tarjeta de crédito
            </a>
            <p className="text-xs text-slate-500">{result.cta}</p>
          </div>

          {/* Share */}
          <div className="text-center">
            <button
              onClick={() => {
                const text = `Mi GEO Score es ${result.score}/100 — ¿cuánto te conoce la IA? Descúbrelo gratis en georadar.io/audit`;
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Compartir mi score en Twitter/X
            </button>
          </div>

          {/* Try again */}
          <button
            onClick={() => { setState('idle'); setResult(null); }}
            className="w-full py-2 text-sm text-slate-500 hover:text-slate-700"
          >
            Analizar otra marca
          </button>
        </div>
      )}
    </div>
  );
}
