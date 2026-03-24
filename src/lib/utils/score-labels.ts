import type { LLMProvider, ScoreLabel } from '@/types';

export function getScoreLabel(score: number): ScoreLabel {
  if (score <= 30) {
    return {
      label: 'Invisible',
      color: '#EF4444',
      tailwindText: 'text-red-500',
      tailwindBg: 'bg-red-50',
    };
  }
  if (score <= 50) {
    return {
      label: 'Baja visibilidad',
      color: '#F97316',
      tailwindText: 'text-orange-500',
      tailwindBg: 'bg-orange-50',
    };
  }
  if (score <= 70) {
    return {
      label: 'Visibilidad media',
      color: '#EAB308',
      tailwindText: 'text-yellow-500',
      tailwindBg: 'bg-yellow-50',
    };
  }
  if (score <= 85) {
    return {
      label: 'Buena visibilidad',
      color: '#3B82F6',
      tailwindText: 'text-blue-500',
      tailwindBg: 'bg-blue-50',
    };
  }
  return {
    label: 'Alta visibilidad',
    color: '#22C55E',
    tailwindText: 'text-green-500',
    tailwindBg: 'bg-green-50',
  };
}

export const LLM_PROVIDER_COLORS: Record<
  LLMProvider,
  { color: string; label: string; icon: string }
> = {
  openai: { color: '#059669', label: 'ChatGPT', icon: 'Sparkles' },
  anthropic: { color: '#F97316', label: 'Claude', icon: 'Bot' },
  perplexity: { color: '#3B82F6', label: 'Perplexity', icon: 'Search' },
};
