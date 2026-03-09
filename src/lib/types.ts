// ==========================================
// GEORadar — Tipos compartidos
// ==========================================

export type BrandPlan = 'free' | 'pro' | 'agency';
export type QueryCategory = 'brand_direct' | 'category_search' | 'problem_search' | 'comparison';
export type LLMProvider = 'openai' | 'anthropic' | 'perplexity' | 'gemini';
export type MentionType = 'primary' | 'secondary' | 'negative' | 'not_mentioned';
export type Sentiment = 'positive' | 'neutral' | 'negative' | 'not_mentioned';
export type RecommendationType =
  | 'content_gap'
  | 'citation_opportunity'
  | 'schema_markup'
  | 'competitor_comparison'
  | 'faq_content'
  | 'definition_page';
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type ScoreTrend = 'up' | 'down' | 'stable';

export interface Brand {
  id: string;
  user_id: string;
  name: string;
  domain: string | null;
  description: string | null;
  industry: string | null;
  competitors: string[];
  target_keywords: string[];
  plan: BrandPlan;
  monitoring_active: boolean;
  created_at: string;
  last_scanned_at: string | null;
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
  query_template_id: string | null;
  llm_provider: LLMProvider;
  llm_model: string;
  query_text: string;
  response_text: string;
  brand_mentioned: boolean;
  mention_type: MentionType;
  mention_position: number | null;
  sentiment: Sentiment;
  competitors_mentioned: string[];
  response_quality: number | null;
  scanned_at: string;
}

export interface VisibilityScore {
  id: string;
  brand_id: string;
  date: string;
  overall_score: number;
  mention_rate: number;
  primary_rate: number;
  sentiment_score: number;
  openai_score: number;
  anthropic_score: number;
  perplexity_score: number;
  queries_run: number;
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
  is_completed: boolean;
  generated_at: string;
}

export interface AuditLead {
  id: string;
  email: string | null;
  domain: string | null;
  brand_name: string;
  audit_result: AuditResult | null;
  converted_to_user: boolean;
  created_at: string;
}

export interface AuditResult {
  score: number;
  score_label: string;
  responses: AuditResponseItem[];
  quick_wins: string[];
  cta: string;
}

export interface AuditResponseItem {
  llm: string;
  mentioned: boolean;
  context: string | null;
}

export interface MentionResult {
  brand_mentioned: boolean;
  mention_type: MentionType;
  mention_position: number | null;
  mention_context: string | null;
  competitors_mentioned: string[];
  sentiment: Sentiment;
}

export interface LLMQueryResponse {
  provider: LLMProvider;
  model: string;
  response_text: string;
  latency_ms: number;
  error?: string;
}

export interface ScoreLabel {
  label: string;
  color: string;
}
