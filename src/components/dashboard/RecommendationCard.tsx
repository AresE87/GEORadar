import { useState, useEffect } from 'react';
import { Lock, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Plan, Recommendation } from '@/types';

interface Props {
  brandId: string;
  plan: Plan;
  limit?: number;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-slate-400',
};

const IMPACT_LABELS: Record<string, { label: string; color: string }> = {
  high: { label: 'Alto impacto', color: 'bg-green-100 text-green-700' },
  medium: { label: 'Medio', color: 'bg-yellow-100 text-yellow-700' },
  low: { label: 'Bajo', color: 'bg-slate-100 text-slate-500' },
};

export default function RecommendationCard({ brandId, plan, limit: cardLimit }: Props) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecs() {
      try {
        const res = await fetch(`/api/recommendations/${brandId}`);
        const data = await res.json();
        setRecommendations(data.recommendations ?? []);
      } catch (err) {
        console.error('Failed to fetch recommendations:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchRecs();
  }, [brandId]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
    );
  }

  const displayed = cardLimit ? recommendations.slice(0, cardLimit) : recommendations;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {displayed.map((rec, index) => {
        const isLocked = rec.is_premium && plan === 'free';
        const impact = IMPACT_LABELS[rec.priority] ?? IMPACT_LABELS.low;

        return (
          <div
            key={rec.id}
            className="relative bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {/* Priority bar */}
            <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r ${PRIORITY_COLORS[rec.priority] ?? PRIORITY_COLORS.low}`} />

            {isLocked && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] rounded-xl flex flex-col items-center justify-center z-10">
                <Lock className="w-6 h-6 text-slate-400 mb-2" />
                <a href="/dashboard/settings" className="text-sm text-blue-600 font-medium hover:underline">
                  Desbloquea con Pro
                </a>
              </div>
            )}

            <div className="pl-3">
              <div className="flex items-start justify-between mb-2">
                <Badge variant="outline" className="text-xs">
                  {rec.recommendation_type.replace(/_/g, ' ')}
                </Badge>
                <Badge className={impact.color}>
                  {impact.label}
                </Badge>
              </div>
              <h4 className="text-sm font-semibold text-slate-900 line-clamp-2 mb-1">
                {rec.title}
              </h4>
              <p className="text-xs text-slate-600 line-clamp-3 mb-3">
                {rec.description}
              </p>
              {rec.action_items.length > 0 && (
                <ul className="space-y-1">
                  {rec.action_items.slice(0, 3).map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-slate-500">
                      <CheckCircle2 className="w-3 h-3 mt-0.5 text-slate-400 flex-shrink-0" />
                      <span className="line-clamp-1">{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
