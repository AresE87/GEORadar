import type { LLMResponse, VisibilityScore, ScoreTrend, ScoreLabel, LLMProvider } from './types';

export function calculateDailyGeoScore(
  responses: LLMResponse[]
): {
  mention_rate: number;
  primary_rate: number;
  sentiment_score: number;
  overall_score: number;
  openai_score: number;
  anthropic_score: number;
  perplexity_score: number;
} {
  const total = responses.length;

  if (total === 0) {
    return {
      mention_rate: 0,
      primary_rate: 0,
      sentiment_score: 0,
      overall_score: 0,
      openai_score: 0,
      anthropic_score: 0,
      perplexity_score: 0,
    };
  }

  const mentioned = responses.filter((r) => r.brand_mentioned).length;
  const primary = responses.filter((r) => r.mention_type === 'primary').length;
  const positive = responses.filter((r) => r.sentiment === 'positive').length;
  const neutral = responses.filter((r) => r.sentiment === 'neutral').length;
  const negative = responses.filter((r) => r.sentiment === 'negative').length;

  const mention_rate = (mentioned / total) * 100;
  const primary_rate = (primary / total) * 100;

  const sentimentTotal = positive + neutral + negative;
  const sentiment_score =
    sentimentTotal > 0
      ? ((positive * 100 + neutral * 50) / sentimentTotal)
      : 50;

  const overall_score =
    mention_rate * 0.4 + primary_rate * 0.35 + sentiment_score * 0.25;

  const openai_score = calculateProviderScore(responses, 'openai');
  const anthropic_score = calculateProviderScore(responses, 'anthropic');
  const perplexity_score = calculateProviderScore(responses, 'perplexity');

  return {
    mention_rate: round2(mention_rate),
    primary_rate: round2(primary_rate),
    sentiment_score: round2(sentiment_score),
    overall_score: round2(overall_score),
    openai_score: round2(openai_score),
    anthropic_score: round2(anthropic_score),
    perplexity_score: round2(perplexity_score),
  };
}

function calculateProviderScore(responses: LLMResponse[], provider: LLMProvider): number {
  const providerResponses = responses.filter((r) => r.llm_provider === provider);
  const total = providerResponses.length;

  if (total === 0) return 0;

  const mentioned = providerResponses.filter((r) => r.brand_mentioned).length;
  const primary = providerResponses.filter((r) => r.mention_type === 'primary').length;
  const positive = providerResponses.filter((r) => r.sentiment === 'positive').length;
  const neutral = providerResponses.filter((r) => r.sentiment === 'neutral').length;
  const negative = providerResponses.filter((r) => r.sentiment === 'negative').length;

  const mentionRate = (mentioned / total) * 100;
  const primaryRate = (primary / total) * 100;
  const sentimentTotal = positive + neutral + negative;
  const sentimentScore =
    sentimentTotal > 0 ? ((positive * 100 + neutral * 50) / sentimentTotal) : 50;

  return mentionRate * 0.4 + primaryRate * 0.35 + sentimentScore * 0.25;
}

export function getScoreTrend(scores: VisibilityScore[], days: number): ScoreTrend {
  if (scores.length < 6) return 'stable';

  const sorted = [...scores].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const recent = sorted.slice(-3);
  const previous = sorted.slice(-6, -3);

  const recentAvg =
    recent.reduce((sum, s) => sum + Number(s.overall_score), 0) / recent.length;
  const previousAvg =
    previous.reduce((sum, s) => sum + Number(s.overall_score), 0) / previous.length;

  const delta = recentAvg - previousAvg;

  if (delta > 5) return 'up';
  if (delta < -5) return 'down';
  return 'stable';
}

export function getScoreLabel(score: number): ScoreLabel {
  if (score <= 30) return { label: 'Invisible', color: 'red' };
  if (score <= 50) return { label: 'Baja visibilidad', color: 'orange' };
  if (score <= 70) return { label: 'Visibilidad media', color: 'yellow' };
  if (score <= 85) return { label: 'Buena visibilidad', color: 'blue' };
  return { label: 'Alta visibilidad', color: 'green' };
}

export function getAuditScoreLabel(score: number): string {
  if (score <= 30) return 'Invisible — ChatGPT no te conoce o te ignora';
  if (score <= 60) return 'Baja visibilidad — apareces pero no como opción principal';
  if (score <= 80) return 'Visibilidad media — presente pero mejorable';
  return 'Alta visibilidad — apareces como referencia en tu categoría';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
