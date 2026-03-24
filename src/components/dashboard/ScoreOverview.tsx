import { useState, useEffect, useRef } from 'react';
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
// Note: base-ui tooltip, no asChild needed
import { getScoreLabel } from '@/lib/utils/score-labels';
import { LLM_PROVIDER_COLORS } from '@/lib/utils/score-labels';
import type { VisibilityScore, LLMProvider } from '@/types';

interface Props {
  brandId: string;
}

function useAnimatedCounter(target: number, duration = 1500) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4); // easeOutExpo approximation
      setValue(Math.round(target * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}

export default function ScoreOverview({ brandId }: Props) {
  const [scores, setScores] = useState<VisibilityScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchScores() {
      try {
        const res = await fetch(`/api/visibility/${brandId}/scores?days=2`);
        const data = await res.json();
        setScores(data.scores ?? []);
      } catch (err) {
        console.error('Failed to fetch scores:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchScores();
  }, [brandId]);

  if (loading) {
    return (
      <div className="col-span-full bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
    );
  }

  const today = scores[0];
  const yesterday = scores[1];

  if (!today) {
    return (
      <div className="col-span-full bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
        <p className="text-4xl font-mono font-bold text-slate-300">--</p>
        <p className="text-sm text-slate-500 mt-2">Ejecuta tu primer scan</p>
        <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          Iniciar scan
        </button>
      </div>
    );
  }

  const score = Number(today.overall_score);
  const label = getScoreLabel(score);
  const change = yesterday ? score - Number(yesterday.overall_score) : 0;
  const animatedScore = useAnimatedCounter(score);

  const chartData = [{ score: animatedScore, fill: label.color }];

  const providers: LLMProvider[] = ['openai', 'anthropic', 'perplexity'];
  const providerScores: Record<string, number> = {
    openai: Number(today.openai_score) || 0,
    anthropic: Number(today.anthropic_score) || 0,
    perplexity: Number(today.perplexity_score) || 0,
  };
  const bestProvider = Object.entries(providerScores).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="col-span-full bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Score Hero */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative">
            <ResponsiveContainer width={160} height={160}>
              <RadialBarChart
                cx="50%" cy="50%"
                innerRadius="70%" outerRadius="90%"
                barSize={12}
                data={chartData}
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar background dataKey="score" cornerRadius={6} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-5xl font-bold" style={{ color: label.color }}>
                {animatedScore}
              </span>
              <span className="text-xl text-slate-400">/100</span>
            </div>
          </div>
          <span className="text-lg font-semibold mt-2" style={{ color: label.color }}>
            {label.label}
          </span>
          {change !== 0 && (
            <div className="flex items-center gap-1 mt-1">
              {change > 0 ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
              <span className={`text-sm font-medium ${change > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {change > 0 ? '+' : ''}{Math.round(change)} vs ayer
              </span>
            </div>
          )}
          <p className="text-xs text-slate-400 mt-2">
            Basado en {today.total_queries} queries a {today.providers_available} LLMs
          </p>
        </div>

        {/* Breakdown por LLM */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Por Plataforma</h3>
          {providers.map((provider) => {
            const providerScore = providerScores[provider];
            const info = LLM_PROVIDER_COLORS[provider];
            const isBest = bestProvider && bestProvider[0] === provider;
            return (
              <div key={provider} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: info.color }}>
                  {info.label[0]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">{info.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: info.color }}>
                        {Math.round(providerScore)}
                      </span>
                      {isBest && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                          Mejor
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1">
                    <div
                      className="h-1.5 rounded-full transition-all duration-1000"
                      style={{ width: `${providerScore}%`, backgroundColor: info.color }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Métricas clave */}
        <TooltipProvider>
          <div className="grid grid-cols-2 gap-3">
            <Tooltip>
              <TooltipTrigger>
                <div className="p-3 rounded-lg bg-slate-50 text-left">
                  <p className="text-2xl font-bold text-slate-900">{Math.round(Number(today.mention_rate))}%</p>
                  <p className="text-xs text-slate-500">Mention Rate</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>Porcentaje de queries donde tu marca fue mencionada</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger>
                <div className="p-3 rounded-lg bg-slate-50 text-left">
                  <p className="text-2xl font-bold text-slate-900">{Math.round(Number(today.primary_rate))}%</p>
                  <p className="text-xs text-slate-500">Primary Rate</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>Porcentaje de veces que fuiste la opción principal</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger>
                <div className="p-3 rounded-lg bg-slate-50 text-left">
                  <p className="text-2xl font-bold text-slate-900">
                    {today.total_queries - today.total_mentions}
                  </p>
                  <p className="text-xs text-slate-500">Sin mención</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>Queries donde tu marca no fue mencionada</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger>
                <div className="p-3 rounded-lg bg-slate-50 text-left">
                  <p className="text-2xl font-bold text-slate-900">{today.providers_available}</p>
                  <p className="text-xs text-slate-500">LLMs activos</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>Número de plataformas de IA consultadas</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}
