import { useState, useMemo } from 'react';
import type { LLMResponse, Brand } from '../lib/types';
import { escapeRegex, truncate } from '../lib/utils';

interface Props {
  responses: LLMResponse[];
  brand: Brand;
}

type FilterTab = 'all' | 'not_mentioned' | 'primary' | 'secondary' | 'negative';

const PROVIDER_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  openai: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-700 dark:text-green-300', label: 'OpenAI' },
  anthropic: { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-700 dark:text-orange-300', label: 'Anthropic' },
  perplexity: { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-700 dark:text-purple-300', label: 'Perplexity' },
};

const MENTION_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  primary: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-700 dark:text-green-300', label: 'Opción #1' },
  secondary: { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-700 dark:text-blue-300', label: 'Mencionada' },
  negative: { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-700 dark:text-red-300', label: 'Mención negativa' },
  not_mentioned: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-500 dark:text-slate-400', label: 'No mencionada' },
};

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'not_mentioned', label: 'Sin mencionar' },
  { key: 'primary', label: 'Primaria' },
  { key: 'secondary', label: 'Mencionada' },
  { key: 'negative', label: 'Negativa' },
];

export default function QueryResponses({ responses, brand }: Props) {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [providerFilter, setProviderFilter] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let result = responses;

    if (activeTab !== 'all') {
      result = result.filter((r) => r.mention_type === activeTab);
    }

    if (providerFilter.size > 0) {
      result = result.filter((r) => providerFilter.has(r.llm_provider));
    }

    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.query_text.toLowerCase().includes(searchLower) ||
          r.response_text.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }, [responses, activeTab, providerFilter, search]);

  const mentionedCount = responses.filter((r) => r.brand_mentioned).length;
  const mentionPct = responses.length > 0 ? Math.round((mentionedCount / responses.length) * 100) : 0;

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleProvider = (provider: string) => {
    setProviderFilter((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) next.delete(provider);
      else next.add(provider);
      return next;
    });
  };

  function highlightBrand(text: string): string {
    const pattern = new RegExp(`(${escapeRegex(brand.name)})`, 'gi');
    return text.replace(pattern, '<mark class="bg-yellow-200 dark:bg-yellow-900 rounded px-0.5">$1</mark>');
  }

  function highlightCompetitors(text: string): string {
    let result = text;
    for (const comp of brand.competitors ?? []) {
      const pattern = new RegExp(`(${escapeRegex(comp)})`, 'gi');
      result = result.replace(pattern, '<span class="bg-red-100 dark:bg-red-900/50 rounded px-0.5">$1</span>');
    }
    return result;
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Respuestas de LLMs
          </h3>
          <p className="text-xs text-slate-500">
            {filtered.length} responses — Mencionado en {mentionPct}%
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-3 flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Provider filters + search */}
        <div className="flex gap-2 items-center flex-wrap">
          {Object.entries(PROVIDER_COLORS).map(([key, val]) => (
            <button
              key={key}
              onClick={() => toggleProvider(key)}
              className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                providerFilter.has(key) || providerFilter.size === 0
                  ? `${val.bg} ${val.text} border-transparent`
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
              }`}
            >
              {val.label}
            </button>
          ))}
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ml-auto px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white w-48"
          />
        </div>
      </div>

      {/* Response cards */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[600px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No hay respuestas que coincidan con los filtros.
          </div>
        ) : (
          filtered.map((r) => {
            const provider = PROVIDER_COLORS[r.llm_provider] ?? PROVIDER_COLORS.openai!;
            const mention = MENTION_BADGES[r.mention_type] ?? MENTION_BADGES.not_mentioned!;
            const isExpanded = expandedIds.has(r.id);

            return (
              <div key={r.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-md ${provider.bg} ${provider.text}`}>
                      {provider.label}
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-md ${mention.bg} ${mention.text}`}>
                      {mention.label}
                    </span>
                    {r.mention_position && (
                      <span className="text-xs text-slate-400">
                        Posición #{r.mention_position}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {new Date(r.scanned_at).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                  </span>
                </div>

                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                  {truncate(r.query_text, 80)}
                </p>

                <button
                  onClick={() => toggleExpanded(r.id)}
                  className="text-xs text-blue-600 hover:text-blue-700 mb-2"
                >
                  {isExpanded ? 'Ocultar respuesta' : 'Ver respuesta completa'}
                </button>

                {isExpanded && (
                  <div
                    className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg p-3 mt-2 leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: highlightCompetitors(highlightBrand(r.response_text)),
                    }}
                  />
                )}

                {r.competitors_mentioned.length > 0 && (
                  <p className="text-xs text-slate-400 mt-2">
                    También mencionó: {r.competitors_mentioned.join(', ')}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
