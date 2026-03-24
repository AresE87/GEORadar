// ========== DATABASE TYPES ==========
export type Plan = 'free' | 'pro' | 'agency';
export type LLMProvider = 'openai' | 'anthropic' | 'perplexity';
export type MentionType = 'primary' | 'secondary' | 'negative' | 'not_mentioned';
export type Sentiment = 'positive' | 'neutral' | 'negative';
export type QueryCategory = 'brand_direct' | 'category_search' | 'problem_search' | 'comparison';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';
export type RecommendationType =
  | 'content_gap'
  | 'citation_opportunity'
  | 'schema_markup'
  | 'competitor_comparison'
  | 'faq_content'
  | 'definition_page';
export type Priority = 'high' | 'medium' | 'low';

// ========== ENTITY INTERFACES ==========
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: Plan;
  stripe_customer_id: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Brand {
  id: string;
  user_id: string;
  name: string;
  domain: string | null;
  description: string | null;
  industry: string | null;
  competitors: string[];
  target_keywords: string[];
  monitoring_active: boolean;
  last_scanned_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QueryTemplate {
  id: string;
  brand_id: string;
  query_text: string;
  query_category: QueryCategory;
  is_active: boolean;
  created_at: string;
}

export interface LLMResponse {
  id: string;
  brand_id: string;
  query_template_id: string;
  scan_date: string;
  llm_provider: LLMProvider;
  llm_model: string;
  query_text: string;
  response_text: string;
  brand_mentioned: boolean;
  mention_type: MentionType;
  mention_position: number | null;
  sentiment: Sentiment;
  competitors_mentioned: string[];
  response_length: number | null;
  latency_ms: number | null;
  error: string | null;
  created_at: string;
}

export interface VisibilityScore {
  id: string;
  brand_id: string;
  score_date: string;
  overall_score: number;
  mention_rate: number;
  primary_rate: number;
  sentiment_score: number;
  openai_score: number;
  anthropic_score: number;
  perplexity_score: number;
  total_queries: number;
  total_mentions: number;
  total_primary: number;
  providers_available: number;
  created_at: string;
}

export interface Recommendation {
  id: string;
  brand_id: string;
  recommendation_type: RecommendationType;
  priority: Priority;
  title: string;
  description: string;
  action_items: string[];
  estimated_impact: string | null;
  is_premium: boolean;
  generated_at: string;
  expires_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  plan: Plan;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditLead {
  id: string;
  email: string | null;
  brand_name: string;
  domain: string | null;
  audit_result: AuditResult;
  ip_address: string | null;
  user_agent: string | null;
  shared: boolean;
  created_at: string;
}

// ========== API TYPES ==========
export interface AuditResult {
  score: number;
  label: string;
  color: string;
  responses: AuditResponseItem[];
  quick_wins: QuickWin[];
  audit_id: string;
}

export interface AuditResponseItem {
  provider: LLMProvider;
  query: string;
  response_excerpt: string;
  brand_mentioned: boolean;
  mention_type: MentionType;
}

export interface QuickWin {
  title: string;
  description: string;
  impact: Priority;
}

// ========== LLM ROUTER TYPES ==========
export interface RouterJob {
  queryTemplateId: string;
  queryText: string;
  provider: LLMProvider;
}

export interface RouterResult {
  responses: RouterResponse[];
  errors: RouterError[];
  stats: RouterStats;
}

export interface RouterResponse {
  queryTemplateId: string;
  queryText: string;
  provider: LLMProvider;
  responseText: string;
  latencyMs: number;
}

export interface RouterError {
  queryTemplateId: string;
  provider: LLMProvider;
  error: string;
}

export interface RouterStats {
  totalJobs: number;
  successful: number;
  failed: number;
  durationMs: number;
  providersAvailable: number;
}

// ========== PARSER TYPES ==========
export interface ParseResult {
  brandMentioned: boolean;
  mentionType: MentionType;
  mentionPosition: number | null;
  sentiment: Sentiment;
  competitorsMentioned: string[];
}

// ========== SCORE TYPES ==========
export interface ScoreInput {
  responses: ParsedResponse[];
  weights: ScoreWeights;
}

export interface ParsedResponse {
  provider: LLMProvider;
  brandMentioned: boolean;
  mentionType: MentionType;
  sentiment: Sentiment;
}

export interface ScoreWeights {
  mention: number;
  primary: number;
  sentiment: number;
}

export interface ScoreResult {
  overallScore: number;
  mentionRate: number;
  primaryRate: number;
  sentimentScore: number;
  byProvider: Partial<Record<LLMProvider, number>>;
  totalQueries: number;
  totalMentions: number;
  totalPrimary: number;
  providersAvailable: number;
}

export interface ScoreLabel {
  label: string;
  color: string;
  tailwindText: string;
  tailwindBg: string;
}

// ========== LLM PROVIDER TYPES ==========
export interface LLMProviderConfig {
  apiKey: string;
  model: string;
  timeout: number;
}

export interface LLMQueryResult {
  responseText: string;
  model: string;
  latencyMs: number;
}

export type ProviderFn = (prompt: string) => Promise<LLMQueryResult>;

// ========== PLAN LIMITS ==========
export interface PlanLimits {
  maxBrands: number;
  maxQueriesPerDay: number;
  providers: LLMProvider[];
  historyDays: number;
  premiumRecommendations: boolean;
  emailAlerts: boolean;
}
