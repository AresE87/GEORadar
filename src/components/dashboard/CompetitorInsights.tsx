import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { LLMResponse } from '@/types';

interface Props {
  brandId: string;
}

export default function CompetitorInsights({ brandId }: Props) {
  const [competitors, setCompetitors] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/visibility/${brandId}/responses`);
        const data = await res.json();
        const responses: LLMResponse[] = data.responses ?? [];
        const counts: Record<string, number> = {};
        for (const r of responses) {
          for (const comp of r.competitors_mentioned) {
            counts[comp] = (counts[comp] ?? 0) + 1;
          }
        }
        setCompetitors(counts);
      } catch (err) {
        console.error('Failed to fetch competitor data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [brandId]);

  if (loading) {
    return <Skeleton className="h-40 rounded-xl" />;
  }

  const sorted = Object.entries(competitors).sort((a, b) => b[1] - a[1]).slice(0, 5);

  if (sorted.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Competidores</h3>
        <p className="text-sm text-slate-500">No se detectaron competidores en las respuestas</p>
      </div>
    );
  }

  const maxCount = sorted[0][1];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">Competidores Detectados</h3>
      <div className="space-y-3">
        {sorted.map(([name, count]) => (
          <div key={name}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-slate-700">{name}</span>
              <span className="text-slate-500">{count} menciones</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-red-400 transition-all"
                style={{ width: `${(count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
