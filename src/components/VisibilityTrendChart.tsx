import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import type { VisibilityScore } from '../lib/types';

interface Props {
  scores: VisibilityScore[];
  days: number;
}

type ViewMode = 'by_llm' | 'by_metric';

export default function VisibilityTrendChart({ scores, days }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('by_llm');
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());

  const data = useMemo(() => {
    const cutoff = Date.now() - days * 86400000;
    return scores
      .filter((s) => new Date(s.date).getTime() >= cutoff)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((s) => ({
        date: new Date(s.date).toLocaleDateString('es', { day: 'numeric', month: 'short' }),
        fullDate: s.date,
        overall_score: Math.round(Number(s.overall_score)),
        openai_score: Math.round(Number(s.openai_score)),
        anthropic_score: Math.round(Number(s.anthropic_score)),
        perplexity_score: Math.round(Number(s.perplexity_score)),
        mention_rate: Math.round(Number(s.mention_rate)),
        primary_rate: Math.round(Number(s.primary_rate)),
        sentiment_score: Math.round(Number(s.sentiment_score)),
      }));
  }, [scores, days]);

  // Detect significant drops
  const dropDates = useMemo(() => {
    const drops: string[] = [];
    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1]!;
      const curr = data[i]!;
      if (prev.overall_score - curr.overall_score > 15) {
        drops.push(curr.date);
      }
    }
    return new Set(drops);
  }, [data]);

  const toggleKey = (key: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const llmLines = [
    { key: 'overall_score', name: 'Overall', color: '#3b82f6', strokeWidth: 2 },
    { key: 'openai_score', name: 'OpenAI', color: '#22c55e', strokeWidth: 1.5 },
    { key: 'anthropic_score', name: 'Anthropic', color: '#f97316', strokeWidth: 1.5 },
    { key: 'perplexity_score', name: 'Perplexity', color: '#a855f7', strokeWidth: 1.5 },
  ];

  const metricLines = [
    { key: 'mention_rate', name: 'Mention Rate', color: '#3b82f6', strokeWidth: 2 },
    { key: 'primary_rate', name: 'Primary Rate', color: '#22c55e', strokeWidth: 1.5 },
    { key: 'sentiment_score', name: 'Sentimiento', color: '#f97316', strokeWidth: 1.5 },
  ];

  const activeLines = viewMode === 'by_llm' ? llmLines : metricLines;

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8">
        <p className="text-center text-slate-500">No hay datos de visibilidad aún. Ejecuta tu primer scan.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Tendencia de Visibilidad
        </h3>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('by_llm')}
            className={`px-3 py-1 text-xs font-medium rounded-md ${
              viewMode === 'by_llm'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500'
            }`}
          >
            Por LLM
          </button>
          <button
            onClick={() => setViewMode('by_metric')}
            className={`px-3 py-1 text-xs font-medium rounded-md ${
              viewMode === 'by_metric'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500'
            }`}
          >
            Por Métrica
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Legend
            onClick={(e) => toggleKey(e.dataKey as string)}
            wrapperStyle={{ cursor: 'pointer', fontSize: '12px' }}
          />

          {/* Green zone */}
          <ReferenceArea y1={70} y2={100} fill="#22c55e" fillOpacity={0.05} />
          <ReferenceLine
            y={50}
            stroke="#94a3b8"
            strokeDasharray="3 3"
            label={{ value: 'Mínimo recomendado', fontSize: 10, fill: '#94a3b8' }}
          />

          {activeLines.map((line) =>
            !hiddenKeys.has(line.key) ? (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                name={line.name}
                stroke={line.color}
                strokeWidth={line.strokeWidth}
                dot={(props: Record<string, unknown>) => {
                  const { cx, cy, payload } = props as { cx: number; cy: number; payload: { date: string } };
                  if (dropDates.has(payload.date) && line.key === 'overall_score') {
                    return (
                      <circle
                        key={`drop-${payload.date}`}
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill="#ef4444"
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    );
                  }
                  return <circle key={`dot-${payload.date}`} cx={cx} cy={cy} r={0} />;
                }}
                activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }}
              />
            ) : null
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
