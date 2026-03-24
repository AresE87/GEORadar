import type { LLMProvider, ScoreInput, ScoreResult, ScoreWeights, ParsedResponse } from '@/types';

export function getDefaultWeights(): ScoreWeights {
  return { mention: 0.40, primary: 0.35, sentiment: 0.25 };
}

export function formatScore(score: number): string {
  return Math.round(score).toString();
}

function calculateProviderScore(responses: ParsedResponse[], weights: ScoreWeights): number {
  const total = responses.length;
  if (total === 0) return 0;

  const mentioned = responses.filter((r) => r.brandMentioned);
  const primary = responses.filter((r) => r.mentionType === 'primary');

  const mentionRate = (mentioned.length / total) * 100;
  const primaryRate = (primary.length / total) * 100;

  let sentimentScore: number;
  if (mentioned.length === 0) {
    sentimentScore = 0;
  } else {
    const sentimentValues: number[] = mentioned.map((r) => {
      if (r.sentiment === 'positive') return 100;
      if (r.sentiment === 'negative') return 0;
      return 50;
    });
    sentimentScore = sentimentValues.reduce((a, b) => a + b, 0) / sentimentValues.length;
  }

  const raw = mentionRate * weights.mention + primaryRate * weights.primary + sentimentScore * weights.sentiment;
  return Math.min(100, Math.max(0, raw));
}

export function calculateScore(input: ScoreInput): ScoreResult {
  const { responses, weights } = input;

  if (responses.length === 0) {
    return {
      overallScore: 0,
      mentionRate: 0,
      primaryRate: 0,
      sentimentScore: 0,
      byProvider: {},
      totalQueries: 0,
      totalMentions: 0,
      totalPrimary: 0,
      providersAvailable: 0,
    };
  }

  const total = responses.length;
  const mentioned = responses.filter((r) => r.brandMentioned);
  const primary = responses.filter((r) => r.mentionType === 'primary');

  const mentionRate = (mentioned.length / total) * 100;
  const primaryRate = (primary.length / total) * 100;

  let sentimentScore: number;
  if (mentioned.length === 0) {
    sentimentScore = 0; // No mentions → no sentiment contribution → score=0
  } else {
    const sentimentValues: number[] = mentioned.map((r) => {
      if (r.sentiment === 'positive') return 100;
      if (r.sentiment === 'negative') return 0;
      return 50;
    });
    sentimentScore = sentimentValues.reduce((a, b) => a + b, 0) / sentimentValues.length;
  }

  const overallScore = Math.min(
    100,
    Math.max(0, mentionRate * weights.mention + primaryRate * weights.primary + sentimentScore * weights.sentiment)
  );

  // Score by provider
  const providerGroups = new Map<LLMProvider, ParsedResponse[]>();
  for (const r of responses) {
    const existing = providerGroups.get(r.provider) ?? [];
    existing.push(r);
    providerGroups.set(r.provider, existing);
  }

  const byProvider: Partial<Record<LLMProvider, number>> = {};
  for (const [provider, providerResponses] of providerGroups) {
    byProvider[provider] = calculateProviderScore(providerResponses, weights);
  }

  return {
    overallScore,
    mentionRate,
    primaryRate,
    sentimentScore,
    byProvider,
    totalQueries: total,
    totalMentions: mentioned.length,
    totalPrimary: primary.length,
    providersAvailable: providerGroups.size,
  };
}
