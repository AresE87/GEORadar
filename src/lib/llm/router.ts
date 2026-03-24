import pLimit from 'p-limit';
import { queryOpenAI } from './providers/openai';
import { queryAnthropic } from './providers/anthropic';
import { queryPerplexity } from './providers/perplexity';
import { withTimeout } from '@/lib/utils/with-timeout';
import type { LLMProvider, QueryTemplate, RouterResult, RouterResponse, RouterError, RouterStats } from '@/types';
import type { ProviderFn } from './types';

const PROVIDERS_MAP: Record<LLMProvider, { fn: ProviderFn; timeout: number }> = {
  openai: { fn: queryOpenAI, timeout: 10_000 },
  anthropic: { fn: queryAnthropic, timeout: 10_000 },
  perplexity: { fn: queryPerplexity, timeout: 10_000 },
};

interface RouterJob {
  queryTemplateId: string;
  queryText: string;
  provider: LLMProvider;
}

export async function executeRouter(
  queries: QueryTemplate[],
  providers: LLMProvider[],
  _brandName: string
): Promise<RouterResult> {
  const maxConcurrent = Number(import.meta.env.MAX_QUERIES_CONCURRENT) || 3;
  const limit = pLimit(maxConcurrent);
  const startTime = Date.now();

  const jobs: RouterJob[] = queries.flatMap((q) =>
    providers.map((p) => ({
      queryTemplateId: q.id,
      queryText: q.query_text,
      provider: p,
    }))
  );

  const results = await Promise.allSettled(
    jobs.map((job) =>
      limit(async () => {
        const config = PROVIDERS_MAP[job.provider];
        const result = await withTimeout(config.fn(job.queryText), config.timeout);
        return {
          queryTemplateId: job.queryTemplateId,
          queryText: job.queryText,
          provider: job.provider,
          responseText: result.responseText,
          latencyMs: result.latencyMs,
        } satisfies RouterResponse;
      })
    )
  );

  const responses: RouterResponse[] = [];
  const errors: RouterError[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      responses.push(result.value);
    } else {
      const job = jobs[index];
      errors.push({
        queryTemplateId: job.queryTemplateId,
        provider: job.provider,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  });

  const providersAvailable = new Set(responses.map((r) => r.provider)).size;

  const stats: RouterStats = {
    totalJobs: jobs.length,
    successful: responses.length,
    failed: errors.length,
    durationMs: Date.now() - startTime,
    providersAvailable,
  };

  return { responses, errors, stats };
}

export async function executeAuditRouter(
  brandName: string,
  queries: string[]
): Promise<RouterResult> {
  const limit = pLimit(3);
  const startTime = Date.now();

  const results = await Promise.allSettled(
    queries.map((queryText, index) =>
      limit(async () => {
        const result = await withTimeout(queryOpenAI(queryText), 10_000);
        return {
          queryTemplateId: `audit-${index}`,
          queryText,
          provider: 'openai' as LLMProvider,
          responseText: result.responseText,
          latencyMs: result.latencyMs,
        } satisfies RouterResponse;
      })
    )
  );

  const responses: RouterResponse[] = [];
  const errors: RouterError[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      responses.push(result.value);
    } else {
      errors.push({
        queryTemplateId: `audit-${index}`,
        provider: 'openai',
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  });

  const stats: RouterStats = {
    totalJobs: queries.length,
    successful: responses.length,
    failed: errors.length,
    durationMs: Date.now() - startTime,
    providersAvailable: responses.length > 0 ? 1 : 0,
  };

  return { responses, errors, stats };
}
