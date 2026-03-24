import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Lock, CalendarClock } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import type { Plan, VisibilityScore } from '@/types';

interface Props {
  brandId: string;
  plan: Plan;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es', { month: 'short', day: 'numeric' });
}

export default function VisibilityTrendChart({ brandId, plan }: Props) {
  const [scores, setScores] = useState<VisibilityScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('7');

  const periodLimits: Record<Plan, string[]> = {
    free: ['7'],
    pro: ['7', '30'],
    agency: ['7', '30', '90'],
  };

  const allowedPeriods = periodLimits[plan];

  useEffect(() => {
    async function fetchScores() {
      setLoading(true);
      try {
        const res = await fetch(`/api/visibility/${brandId}/scores?days=${selectedPeriod}`);
        const data = await res.json();
        setScores((data.scores ?? []).reverse());
      } catch (err) {
        console.error('Failed to fetch trend:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchScores();
  }, [brandId, selectedPeriod]);

  if (loading) {
    return (
      <div className="col-span-full lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  const chartData = scores.map((s) => ({
    date: formatDate(s.score_date),
    score: Number(s.overall_score),
    openai: Number(s.openai_score),
    anthropic: Number(s.anthropic_score),
    perplexity: Number(s.perplexity_score),
  }));

  return (
    <div className="col-span-full lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Tendencia de Visibilidad</h3>
        <Tabs value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <TabsList>
            {['7', '30', '90'].map((p) => {
              const isAllowed = allowedPeriods.includes(p);
              return (
                <TabsTrigger key={p} value={p} disabled={!isAllowed} className="relative">
                  {p}D
                  {!isAllowed && <Lock className="w-3 h-3 ml-1 text-slate-400" />}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      {scores.length < 2 ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400">
          <CalendarClock className="w-10 h-10 mb-2" />
          <p className="text-sm">Los datos aparecerán después de tu segundo scan</p>
        </div>
      ) : (
        <div className="relative">
          <ResponsiveContainer width="100%" height={256}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94A3B8" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#94A3B8" />
              <RechartsTooltip
                contentStyle={{
                  background: 'white',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#2563EB"
                strokeWidth={2}
                fill="url(#scoreGrad)"
                name="Overall"
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* Upgrade banner for free users */}
          {plan === 'free' && selectedPeriod !== '7' && (
            <div className="absolute inset-0 flex items-center justify-center bg-amber-50/80 border border-amber-200 rounded-lg">
              <div className="text-center">
                <p className="text-sm font-medium text-amber-800">
                  Tu historial de más de 7 días está disponible en Pro
                </p>
                <a href="/dashboard/settings" className="text-sm text-blue-600 font-medium hover:underline">
                  Upgrade →
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
