import type { Plan, LLMProvider, PlanLimits } from '@/types';

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxBrands: 1,
    maxQueriesPerDay: 5,
    providers: ['openai'],
    historyDays: 7,
    premiumRecommendations: false,
    emailAlerts: false,
  },
  pro: {
    maxBrands: 5,
    maxQueriesPerDay: 50,
    providers: ['openai', 'anthropic', 'perplexity'],
    historyDays: 90,
    premiumRecommendations: true,
    emailAlerts: true,
  },
  agency: {
    maxBrands: 25,
    maxQueriesPerDay: 200,
    providers: ['openai', 'anthropic', 'perplexity'],
    historyDays: -1, // unlimited
    premiumRecommendations: true,
    emailAlerts: true,
  },
};

export function getUserPlanLimits(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}

export function canCreateBrand(plan: Plan, currentCount: number): boolean {
  return currentCount < PLAN_LIMITS[plan].maxBrands;
}

export function getAvailableProviders(plan: Plan): LLMProvider[] {
  return PLAN_LIMITS[plan].providers;
}
