import { describe, it, expect } from 'vitest';
import { withTimeout } from './with-timeout';
import { PLAN_LIMITS, getUserPlanLimits, canCreateBrand, getAvailableProviders } from './plan-limits';
import { getScoreLabel, LLM_PROVIDER_COLORS } from './score-labels';

describe('withTimeout', () => {
  it('resolves when promise completes before timeout', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 1000);
    expect(result).toBe('ok');
  });

  it('rejects when promise exceeds timeout', async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 5000));
    await expect(withTimeout(slow, 50)).rejects.toThrow('Timeout: 50ms');
  });

  it('cleans up timer on success', async () => {
    // Should not leak timers
    const result = await withTimeout(Promise.resolve(42), 1000);
    expect(result).toBe(42);
  });

  it('passes through rejection from original promise', async () => {
    const failing = Promise.reject(new Error('original error'));
    await expect(withTimeout(failing, 1000)).rejects.toThrow('original error');
  });
});

describe('Plan Limits', () => {
  it('free plan has correct limits', () => {
    const limits = PLAN_LIMITS.free;
    expect(limits.maxBrands).toBe(1);
    expect(limits.maxQueriesPerDay).toBe(5);
    expect(limits.providers).toEqual(['openai']);
    expect(limits.historyDays).toBe(7);
    expect(limits.premiumRecommendations).toBe(false);
    expect(limits.emailAlerts).toBe(false);
  });

  it('pro plan has correct limits', () => {
    const limits = PLAN_LIMITS.pro;
    expect(limits.maxBrands).toBe(5);
    expect(limits.maxQueriesPerDay).toBe(50);
    expect(limits.providers).toEqual(['openai', 'anthropic', 'perplexity']);
    expect(limits.historyDays).toBe(90);
    expect(limits.premiumRecommendations).toBe(true);
    expect(limits.emailAlerts).toBe(true);
  });

  it('agency plan has correct limits', () => {
    const limits = PLAN_LIMITS.agency;
    expect(limits.maxBrands).toBe(25);
    expect(limits.historyDays).toBe(-1); // unlimited
  });

  it('getUserPlanLimits returns correct plan', () => {
    expect(getUserPlanLimits('free').maxBrands).toBe(1);
    expect(getUserPlanLimits('pro').maxBrands).toBe(5);
    expect(getUserPlanLimits('agency').maxBrands).toBe(25);
  });

  it('canCreateBrand enforces limits', () => {
    expect(canCreateBrand('free', 0)).toBe(true);
    expect(canCreateBrand('free', 1)).toBe(false);
    expect(canCreateBrand('free', 5)).toBe(false);
    expect(canCreateBrand('pro', 4)).toBe(true);
    expect(canCreateBrand('pro', 5)).toBe(false);
    expect(canCreateBrand('agency', 24)).toBe(true);
    expect(canCreateBrand('agency', 25)).toBe(false);
  });

  it('getAvailableProviders returns correct providers', () => {
    expect(getAvailableProviders('free')).toEqual(['openai']);
    expect(getAvailableProviders('pro')).toEqual(['openai', 'anthropic', 'perplexity']);
    expect(getAvailableProviders('agency')).toEqual(['openai', 'anthropic', 'perplexity']);
  });
});

describe('Score Labels', () => {
  it('returns Invisible for score 0', () => {
    const label = getScoreLabel(0);
    expect(label.label).toBe('Invisible');
    expect(label.color).toBe('#EF4444');
    expect(label.tailwindText).toBe('text-red-500');
    expect(label.tailwindBg).toBe('bg-red-50');
  });

  it('returns Invisible for score 30', () => {
    expect(getScoreLabel(30).label).toBe('Invisible');
  });

  it('returns Baja visibilidad for score 31-50', () => {
    expect(getScoreLabel(31).label).toBe('Baja visibilidad');
    expect(getScoreLabel(50).label).toBe('Baja visibilidad');
  });

  it('returns Visibilidad media for score 51-70', () => {
    expect(getScoreLabel(51).label).toBe('Visibilidad media');
    expect(getScoreLabel(70).label).toBe('Visibilidad media');
  });

  it('returns Buena visibilidad for score 71-85', () => {
    expect(getScoreLabel(71).label).toBe('Buena visibilidad');
    expect(getScoreLabel(85).label).toBe('Buena visibilidad');
  });

  it('returns Alta visibilidad for score 86-100', () => {
    expect(getScoreLabel(86).label).toBe('Alta visibilidad');
    expect(getScoreLabel(100).label).toBe('Alta visibilidad');
  });

  it('has correct LLM provider colors', () => {
    expect(LLM_PROVIDER_COLORS.openai.label).toBe('ChatGPT');
    expect(LLM_PROVIDER_COLORS.anthropic.label).toBe('Claude');
    expect(LLM_PROVIDER_COLORS.perplexity.label).toBe('Perplexity');
    expect(LLM_PROVIDER_COLORS.openai.color).toBe('#059669');
    expect(LLM_PROVIDER_COLORS.anthropic.color).toBe('#F97316');
    expect(LLM_PROVIDER_COLORS.perplexity.color).toBe('#3B82F6');
  });
});
