import { useState, useMemo } from 'react';
import type { VisibilityScore, Brand } from '../lib/types';
import { getScoreLabel, getScoreTrend } from '../lib/score';

interface Props {
  brand: Brand;
  scores: VisibilityScore[];
  onScanNow: () => void;
  scanning?: boolean;
}

const RANGES = [
  { label: 'Hoy', days: 1 },
  { label: '7 días', days: 7 },
  { label: '30 días', days: 30 },
  { label: '90 días', days: 90 },
] as const;

export default function ScoreOverview({ brand, scores, onScanNow, scanning = false }: Props) {
  const [range, setRange] = useState(1);

  const filteredScores = useMemo(() => {
    const now = Date.now();
    const cutoff = now - range * 86400000;
    return scores.filter((s) => new Date(s.date).getTime() >= cutoff);
  }, [scores, range]);

  const latestScore = filteredScores.length > 0 ? filteredScores[filteredScores.length - 1]! : null;
  const prevScore = filteredScores.length > 1 ? filteredScores[filteredScores.length - 2]! : null;

  const currentScore = latestScore
    ? range === 1
      ? Number(latestScore.overall_score)
      : filteredScores.reduce((sum, s) => sum + Number(s.overall_score), 0) / filteredScores.length
    : 0;

  const scoreDelta = prevScore
    ? Number(latestScore?.overall_score ?? 0) - Number(prevScore.overall_score)
    : 0;

  const scoreInfo = getScoreLabel(currentScore);
  const trend = getScoreTrend(scores, 30);

  const providers = [
    { name: 'OpenAI', key: 'openai_score' as const, color: 'bg-green-500', icon: 'O' },
    { name: 'Anthropic', key: 'anthropic_score' as const, color: 'bg-orange-500', icon: 'A' },
    { name: 'Perplexity', key: 'perplexity_score' as const, color: 'bg-purple-500', icon: 'P' },
  ];

  const bestProvider = latestScore
    ? providers.reduce((best, p) =>
        Number(latestScore[p.key]) > Number(latestScore[best.key]) ? p : best
      )
    : null;

  const queriesWithout = latestScore
    ? Math.round((100 - Number(latestScore.mention_rate)) * Number(latestScore.queries_run) / 100)
    : 0;

  const colorMap: Record<string, string> = {
    red: 'text-red-500',
    orange: 'text-orange-500',
    yellow: 'text-yellow-500',
    blue: 'text-blue-500',
    green: 'text-green-500',
  };

  const bgColorMap: Record<string, string> = {
    red: 'bg-red-50 border-red-200',
    orange: 'bg-orange-50 border-orange-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
  };

  return (
    <div className="space-y-6">
      {/* Range selector + Scan button */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setRange(r.days)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                range === r.days
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          onClick={onScanNow}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
          {scanning ? 'Escaneando...' : 'Escanear ahora'}
        </button>
      </div>

      {/* Main score card */}
      <div className={`rounded-xl border p-6 text-center ${bgColorMap[scoreInfo.color] ?? 'bg-slate-50 border-slate-200'}`}>
        <p className="text-6xl font-bold tabular-nums">
          {Math.round(currentScore)}
        </p>
        <p className={`text-lg font-semibold mt-1 ${colorMap[scoreInfo.color] ?? 'text-slate-600'}`}>
          {scoreInfo.label}
        </p>
        {scoreDelta !== 0 && (
          <p className={`text-sm mt-1 ${scoreDelta > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {scoreDelta > 0 ? '↑' : '↓'} {Math.abs(Math.round(scoreDelta))} pts vs ayer
          </p>
        )}
        <p className="text-xs text-slate-500 mt-2">
          Basado en {latestScore?.queries_run ?? 0} queries a GPT-4o, Claude y Perplexity
        </p>
      </div>

      {/* Provider breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {providers.map((p) => {
          const provScore = latestScore ? Number(latestScore[p.key]) : 0;
          const isBest = bestProvider?.key === p.key;
          return (
            <div key={p.key} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-6 h-6 ${p.color} rounded-md flex items-center justify-center text-white text-xs font-bold`}>
                  {p.icon}
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{p.name}</span>
                {isBest && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full ml-auto">
                    Mejor
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold">{Math.round(provScore)}</p>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-2">
                <div
                  className={`${p.color} h-2 rounded-full transition-all`}
                  style={{ width: `${Math.min(provScore, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          label="Mention Rate"
          value={`${Math.round(Number(latestScore?.mention_rate ?? 0))}%`}
          sub="de queries"
        />
        <MetricCard
          label="Primary Rate"
          value={`${Math.round(Number(latestScore?.primary_rate ?? 0))}%`}
          sub="como opción principal"
        />
        <MetricCard
          label="Sin mención"
          value={`${queriesWithout}`}
          sub="queries"
          alert={queriesWithout > 0}
        />
        <MetricCard
          label="Tendencia"
          value={trend === 'up' ? '↑ Subiendo' : trend === 'down' ? '↓ Bajando' : '→ Estable'}
          sub="últimos 6 días"
          trend={trend}
        />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  alert = false,
  trend,
}: {
  label: string;
  value: string;
  sub: string;
  alert?: boolean;
  trend?: string;
}) {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl border p-4 ${
      alert ? 'border-red-200 dark:border-red-900' : 'border-slate-200 dark:border-slate-800'
    }`}>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-1 ${
        trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : ''
      }`}>
        {value}
      </p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}
