import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Props {
  brandName: string;
}

const PHASES = [
  { label: 'Preparando consultas de IA...', duration: 3000 },
  { label: 'Consultando LLMs sobre', duration: 5000 },
  { label: 'Analizando menciones y visibilidad...', duration: 4000 },
  { label: 'Generando recomendaciones...', duration: 3000 },
];

const PROVIDERS = [
  { name: 'ChatGPT', color: '#059669' },
  { name: 'Claude', color: '#F97316' },
  { name: 'Perplexity', color: '#3B82F6' },
];

export default function AuditLoading({ brandName }: Props) {
  const [phase, setPhase] = useState(0);
  const [progress, setProgress] = useState(0);
  const [providerStatus, setProviderStatus] = useState<('idle' | 'loading' | 'done')[]>([
    'idle', 'idle', 'idle',
  ]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;

    PHASES.forEach((p, i) => {
      timers.push(setTimeout(() => setPhase(i), elapsed));
      elapsed += p.duration;
    });

    // Provider animations
    timers.push(setTimeout(() => setProviderStatus(['loading', 'idle', 'idle']), 3000));
    timers.push(setTimeout(() => setProviderStatus(['loading', 'loading', 'idle']), 3200));
    timers.push(setTimeout(() => setProviderStatus(['loading', 'loading', 'loading']), 3400));
    timers.push(setTimeout(() => setProviderStatus(['done', 'loading', 'loading']), 5500));
    timers.push(setTimeout(() => setProviderStatus(['done', 'done', 'loading']), 6500));
    timers.push(setTimeout(() => setProviderStatus(['done', 'done', 'done']), 7500));

    // Progress bar
    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 1, 95));
    }, 150);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="w-full max-w-xl mx-auto text-center space-y-6">
      <div className="space-y-2">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
        <p className="text-lg font-medium text-slate-900">
          {PHASES[phase].label} {phase === 1 ? brandName : ''}
        </p>
      </div>

      {/* Provider cards */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {PROVIDERS.map((provider, i) => {
          const status = providerStatus[i];
          return (
            <div
              key={provider.name}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-all ${
                status === 'idle'
                  ? 'border-slate-200 bg-slate-50'
                  : status === 'loading'
                  ? 'border-current bg-white animate-pulse'
                  : 'border-green-400 bg-green-50'
              }`}
              style={{ borderColor: status === 'loading' ? provider.color : undefined }}
            >
              {status === 'done' ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : status === 'loading' ? (
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: provider.color }} />
              ) : (
                <div className="w-4 h-4 rounded-full bg-slate-300" />
              )}
              <span className="text-sm font-medium text-slate-700">{provider.name}</span>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      {phase >= 2 && (
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className="h-2 rounded-full bg-blue-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
