import { describe, it, expect } from 'vitest';
import { calculateScore, getDefaultWeights, formatScore } from './calculator';
import type { ParsedResponse, ScoreWeights } from '@/types';

const weights = getDefaultWeights();

function makeResponses(
  count: number,
  mentioned: number,
  primary: number,
  sentiment: 'positive' | 'neutral' | 'negative' = 'positive'
): ParsedResponse[] {
  const responses: ParsedResponse[] = [];
  for (let i = 0; i < count; i++) {
    const isMentioned = i < mentioned;
    const isPrimary = i < primary;
    responses.push({
      provider: i % 3 === 0 ? 'openai' : i % 3 === 1 ? 'anthropic' : 'perplexity',
      brandMentioned: isMentioned,
      mentionType: !isMentioned ? 'not_mentioned' : isPrimary ? 'primary' : 'secondary',
      sentiment: isMentioned ? sentiment : 'neutral',
    });
  }
  return responses;
}

describe('Score Calculator', () => {
  // SC-01: 0 mentions from 15 responses
  it('returns score=0 with 0 mentions, no NaN', () => {
    const result = calculateScore({
      responses: makeResponses(15, 0, 0),
      weights,
    });
    expect(result.overallScore).toBe(0);
    expect(result.mentionRate).toBe(0);
    expect(result.primaryRate).toBe(0);
    expect(result.totalMentions).toBe(0);
    expect(Number.isNaN(result.overallScore)).toBe(false);
    expect(Number.isNaN(result.mentionRate)).toBe(false);
    expect(Number.isNaN(result.sentimentScore)).toBe(false);
  });

  // SC-02: 0 responses total (all LLMs failed)
  it('returns score=0 with 0 responses, no Infinity', () => {
    const result = calculateScore({
      responses: [],
      weights,
    });
    expect(result.overallScore).toBe(0);
    expect(result.mentionRate).toBe(0);
    expect(result.primaryRate).toBe(0);
    expect(result.totalQueries).toBe(0);
    expect(Number.isFinite(result.overallScore)).toBe(true);
    expect(result.providersAvailable).toBe(0);
  });

  // SC-03: 15/15 mentions all primary
  it('calculates high score with 100% primary mentions', () => {
    const result = calculateScore({
      responses: makeResponses(15, 15, 15, 'positive'),
      weights,
    });
    expect(result.mentionRate).toBe(100);
    expect(result.primaryRate).toBe(100);
    expect(result.overallScore).toBeGreaterThanOrEqual(95);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  // SC-04: All negative sentiment
  it('returns low score with all negative sentiment', () => {
    const result = calculateScore({
      responses: makeResponses(15, 15, 0, 'negative'),
      weights,
    });
    expect(result.mentionRate).toBe(100);
    expect(result.sentimentScore).toBe(0); // negative = 0
    expect(result.overallScore).toBeLessThan(50);
  });

  // SC-05: Only 5 responses (1 LLM)
  it('calculates partial score with only 1 LLM', () => {
    const responses: ParsedResponse[] = Array(5).fill(null).map((_, i) => ({
      provider: 'openai' as const,
      brandMentioned: i < 3,
      mentionType: i < 1 ? 'primary' as const : i < 3 ? 'secondary' as const : 'not_mentioned' as const,
      sentiment: i < 3 ? 'positive' as const : 'neutral' as const,
    }));
    const result = calculateScore({ responses, weights });
    expect(result.totalQueries).toBe(5);
    expect(result.providersAvailable).toBe(1);
    expect(result.overallScore).toBeGreaterThan(0);
    expect(Number.isNaN(result.overallScore)).toBe(false);
  });

  // SC-07: Score with 0 mentions → sentimentScore=0 (no sentiment contribution)
  it('uses sentimentScore=0 when 0 mentions', () => {
    const result = calculateScore({
      responses: makeResponses(15, 0, 0),
      weights,
    });
    // 0 mentions → sentimentScore = 0, overallScore = 0
    expect(result.sentimentScore).toBe(0);
    expect(result.overallScore).toBe(0);
  });

  // SC-08: Rounding
  it('calculates mention_rate with proper values', () => {
    const result = calculateScore({
      responses: makeResponses(15, 10, 4, 'positive'),
      weights,
    });
    // 10/15 = 66.666...%
    expect(result.mentionRate).toBeCloseTo(66.67, 0);
    expect(result.totalMentions).toBe(10);
    expect(result.totalPrimary).toBe(4);
  });

  // HAPPY: Weighted formula correct
  it('calculates overall score with correct weighted formula', () => {
    // 10/15 mentioned, 4 primary, all positive
    const result = calculateScore({
      responses: makeResponses(15, 10, 4, 'positive'),
      weights,
    });
    const expectedMentionRate = (10 / 15) * 100;
    const expectedPrimaryRate = (4 / 15) * 100;
    const expectedSentiment = 100; // all positive
    const expected = expectedMentionRate * 0.40 + expectedPrimaryRate * 0.35 + expectedSentiment * 0.25;
    expect(result.overallScore).toBeCloseTo(expected, 1);
  });

  // Provider breakdown
  it('breaks down scores by provider', () => {
    const result = calculateScore({
      responses: makeResponses(15, 10, 4, 'positive'),
      weights,
    });
    expect(result.byProvider).toBeDefined();
    expect(result.providersAvailable).toBeGreaterThan(0);
  });

  // Clamping
  it('clamps score to 0-100 range', () => {
    const result = calculateScore({
      responses: makeResponses(15, 15, 15, 'positive'),
      weights,
    });
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
  });

  // formatScore
  it('formatScore rounds to integer string', () => {
    expect(formatScore(66.67)).toBe('67');
    expect(formatScore(0)).toBe('0');
    expect(formatScore(100)).toBe('100');
    expect(formatScore(33.3)).toBe('33');
  });

  // getDefaultWeights
  it('returns correct default weights summing ~1.0', () => {
    const w = getDefaultWeights();
    expect(w.mention).toBe(0.40);
    expect(w.primary).toBe(0.35);
    expect(w.sentiment).toBe(0.25);
    expect(w.mention + w.primary + w.sentiment).toBeCloseTo(1.0);
  });
});
