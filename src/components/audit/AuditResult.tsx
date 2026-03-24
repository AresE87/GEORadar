import { useState, useEffect, useRef } from 'react';
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';
import { Lightbulb, ChevronDown, ChevronUp, Share2, Copy, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getScoreLabel } from '@/lib/utils/score-labels';
import type { AuditResult as AuditResultType } from '@/types';

interface Props {
  result: AuditResultType;
  brandName: string;
}

const IMPACT_COLORS: Record<string, string> = {
  high: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-slate-100 text-slate-500',
};

export default function AuditResult({ result, brandName }: Props) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const target = result.score;
    const duration = 1500;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setAnimatedScore(Math.round(target * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [result.score]);

  const label = getScoreLabel(result.score);
  const chartData = [{ score: animatedScore, fill: label.color }];

  const shareText = encodeURIComponent(`Mi marca ${brandName} tiene un GEO Score de ${result.score}/100 en motores de IA.`);
  const shareUrl = encodeURIComponent(window.location.href);

  function handleCopy() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function toggleResponse(index: number) {
    const next = new Set(expanded);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setExpanded(next);
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      {/* Score Hero */}
      <div className="text-center">
        <div className="relative inline-block">
          <ResponsiveContainer width={180} height={180}>
            <RadialBarChart
              cx="50%" cy="50%" innerRadius="70%" outerRadius="90%"
              barSize={12} data={chartData} startAngle={90} endAngle={-270}
            >
              <RadialBar background dataKey="score" cornerRadius={6} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-6xl font-bold" style={{ color: label.color }}>
              {animatedScore}
            </span>
            <span className="text-2xl text-slate-400">/100</span>
          </div>
        </div>
        <p className="text-lg font-semibold mt-2" style={{ color: label.color }}>
          {label.label}
        </p>
        <div className="flex justify-center gap-4 mt-3">
          <Badge variant="outline">Mention Rate: {result.responses.filter((r) => r.brand_mentioned).length}/{result.responses.length}</Badge>
        </div>
      </div>

      {/* LLM Responses */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Respuestas de LLMs</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {result.responses.map((r, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="text-xs capitalize">{r.provider}</Badge>
                <Badge className={r.brand_mentioned ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>
                  {r.brand_mentioned ? r.mention_type : 'Sin mención'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mb-2">{r.query}</p>
              <p className={`text-sm text-slate-600 ${expanded.has(i) ? '' : 'line-clamp-4'}`}>
                {r.response_excerpt}
              </p>
              {r.response_excerpt.length > 200 && (
                <button
                  onClick={() => toggleResponse(i)}
                  className="text-xs text-blue-600 mt-1 flex items-center gap-1"
                >
                  {expanded.has(i) ? (
                    <>Menos <ChevronUp className="w-3 h-3" /></>
                  ) : (
                    <>Ver más <ChevronDown className="w-3 h-3" /></>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick Wins */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Quick Wins</h3>
        <div className="space-y-3">
          {result.quick_wins.map((win, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3"
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-900">{win.title}</h4>
                  <Badge className={IMPACT_COLORS[win.impact] ?? IMPACT_COLORS.low}>
                    {win.impact === 'high' ? 'Alto impacto' : win.impact === 'medium' ? 'Medio' : 'Bajo'}
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 mt-1">{win.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Share & CTAs */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <a
            href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50"
          >
            <Share2 className="w-4 h-4 mr-1" /> Twitter
          </a>
          <a
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50"
          >
            <Share2 className="w-4 h-4 mr-1" /> LinkedIn
          </a>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
            {copied ? 'Copiado!' : 'Copiar link'}
          </Button>
        </div>

        <a href="/login" className="flex items-center justify-center w-full h-12 bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold rounded-lg">
          Monitorea tu visibilidad gratis →
        </a>

        <p className="text-center">
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← Analizar otra marca
          </button>
        </p>
      </div>
    </div>
  );
}
