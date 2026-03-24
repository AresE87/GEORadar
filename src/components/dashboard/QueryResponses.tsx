import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { LLM_PROVIDER_COLORS } from '@/lib/utils/score-labels';
import type { Plan, LLMResponse, LLMProvider } from '@/types';

interface Props {
  brandId: string;
  plan: Plan;
}

const MENTION_COLORS: Record<string, string> = {
  primary: 'bg-green-100 text-green-700',
  secondary: 'bg-blue-100 text-blue-700',
  negative: 'bg-red-100 text-red-700',
  not_mentioned: 'bg-slate-100 text-slate-500',
};

export default function QueryResponses({ brandId, plan }: Props) {
  const [responses, setResponses] = useState<LLMResponse[]>([]);
  const [lockedCount, setLockedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    async function fetchResponses() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filter !== 'all') params.set('provider', filter);
        const res = await fetch(`/api/visibility/${brandId}/responses?${params}`);
        const data = await res.json();
        setResponses(data.responses ?? []);
        setLockedCount(data.locked_count ?? 0);
      } catch (err) {
        console.error('Failed to fetch responses:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchResponses();
  }, [brandId, filter]);

  function toggleExpanded(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  }

  if (loading) {
    return (
      <div className="col-span-full bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  const displayed = responses.slice(0, limit);

  return (
    <div className="col-span-full bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Respuestas de LLMs</h3>
          <Badge variant="secondary">{responses.length}</Badge>
        </div>
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="openai">ChatGPT</TabsTrigger>
            <TabsTrigger value="anthropic" disabled={plan === 'free'}>
              Claude {plan === 'free' && <Lock className="w-3 h-3 ml-1" />}
            </TabsTrigger>
            <TabsTrigger value="perplexity" disabled={plan === 'free'}>
              Perplexity {plan === 'free' && <Lock className="w-3 h-3 ml-1" />}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-2">
        {displayed.map((r) => {
          const isOpen = expanded.has(r.id);
          const providerInfo = LLM_PROVIDER_COLORS[r.llm_provider as LLMProvider];
          const mentionColor = MENTION_COLORS[r.mention_type] ?? MENTION_COLORS.not_mentioned;

          return (
            <div key={r.id} className="border border-slate-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleExpanded(r.id)}
                className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: providerInfo?.color ?? '#94A3B8' }}
                  />
                  <Badge variant="outline" className="flex-shrink-0 text-xs">
                    {providerInfo?.label ?? r.llm_provider}
                  </Badge>
                  <span className="text-sm text-slate-700 truncate">{r.query_text}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge className={mentionColor}>
                    {r.mention_type === 'not_mentioned' ? 'Sin mención' : r.mention_type}
                  </Badge>
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>
              {isOpen && (
                <div className="px-3 pb-3 pt-0">
                  <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                    {r.response_text}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {responses.length > limit && (
        <button
          onClick={() => setLimit((l) => l + 10)}
          className="mt-4 w-full py-2 text-sm text-blue-600 font-medium hover:bg-blue-50 rounded-lg transition-colors"
        >
          Mostrar más respuestas
        </button>
      )}

      {/* Locked responses for free users */}
      {plan === 'free' && lockedCount > 0 && (
        <div className="mt-4 p-4 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-center">
          <Lock className="w-6 h-6 mx-auto text-slate-400 mb-2" />
          <p className="text-sm text-slate-600">
            {lockedCount} respuestas de Claude y Perplexity bloqueadas
          </p>
          <a href="/dashboard/settings" className="text-sm text-blue-600 font-medium hover:underline">
            Desbloquear con Pro →
          </a>
        </div>
      )}
    </div>
  );
}
