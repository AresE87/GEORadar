import type { MentionType, Sentiment, ParseResult } from '@/types';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detect if brand is mentioned in text.
 * Uses word boundary regex first, falls back to case-insensitive indexOf
 * for brands with special characters where \b doesn't work (e.g. C++, Café René).
 */
function isBrandMentioned(text: string, brandName: string): boolean {
  const lowerText = text.toLowerCase();
  const lowerBrand = brandName.toLowerCase();

  // Always check simple case-insensitive inclusion first
  if (!lowerText.includes(lowerBrand)) return false;

  // Try word boundary regex (works for most alphanumeric brands)
  try {
    const escaped = escapeRegex(brandName);
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(text)) return true;
  } catch {
    // Regex failed, fall through to indexOf check
  }

  // Fallback: indexOf with manual boundary checks for special chars
  const pos = lowerText.indexOf(lowerBrand);
  if (pos === -1) return false;

  // Check that the match is reasonably standalone (not embedded in a longer word)
  const charBefore = pos > 0 ? lowerText[pos - 1] : ' ';
  const charAfter = pos + lowerBrand.length < lowerText.length
    ? lowerText[pos + lowerBrand.length]
    : ' ';

  // If brand has special chars, be more lenient with boundaries
  const hasSpecialChars = /[^a-z0-9\s]/i.test(brandName);
  if (hasSpecialChars) return true;

  // For purely alphanumeric brands, check word boundaries
  const isWordChar = (c: string) => /[a-z0-9]/i.test(c);
  return !isWordChar(charBefore) && !isWordChar(charAfter);
}

function detectListPosition(text: string, brand: string): number | null {
  const lowerBrand = brand.toLowerCase();
  const lines = text.split('\n');

  for (const line of lines) {
    const match = line.match(/^\s*(\d+)[.)]\s*/);
    if (match && line.toLowerCase().includes(lowerBrand)) {
      return parseInt(match[1], 10);
    }
    const hashMatch = line.match(/^\s*#(\d+)\s*/);
    if (hashMatch && line.toLowerCase().includes(lowerBrand)) {
      return parseInt(hashMatch[1], 10);
    }
  }

  return null;
}

const NEGATIVE_SIGNALS = [
  'not recommended', 'avoid', 'downside', 'issue with',
  'problem with', 'limitation', 'lacks', 'falls short',
];

const POSITIVE_SIGNALS = [
  'recommended', 'excellent', 'top choice', 'best', 'leading',
  'popular', 'well-known', 'trusted', 'innovative', 'powerful',
  'reliable', 'great', 'excelente', 'recomendado', 'mejor',
  'confiable', 'líder',
];

function extractContext(text: string, brand: string, chars: number): string {
  const lowerText = text.toLowerCase();
  const lowerBrand = brand.toLowerCase();
  const pos = lowerText.indexOf(lowerBrand);
  if (pos === -1) return '';
  const start = Math.max(0, pos - chars);
  const end = Math.min(text.length, pos + lowerBrand.length + chars);
  return text.slice(start, end).toLowerCase();
}

function classifyMentionType(
  text: string,
  brand: string,
  position: number | null
): MentionType {
  if (position === 1) return 'primary';

  const context = extractContext(text, brand, 150);
  for (const signal of NEGATIVE_SIGNALS) {
    if (context.includes(signal)) return 'negative';
  }

  // First mention in first 200 chars without list context
  const lowerText = text.toLowerCase();
  const lowerBrand = brand.toLowerCase();
  const firstMention = lowerText.indexOf(lowerBrand);
  if (firstMention !== -1 && firstMention < 200 && position === null) {
    return 'primary';
  }

  return 'secondary';
}

function classifySentiment(text: string, brand: string): Sentiment {
  const context = extractContext(text, brand, 150);
  if (!context) return 'neutral';

  let positiveCount = 0;
  let negativeCount = 0;

  for (const signal of POSITIVE_SIGNALS) {
    if (context.includes(signal)) positiveCount++;
  }
  for (const signal of NEGATIVE_SIGNALS) {
    if (context.includes(signal)) negativeCount++;
  }

  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

function detectCompetitors(text: string, competitors: string[]): string[] {
  return competitors.filter((comp) => isBrandMentioned(text, comp));
}

export function parseMention(
  responseText: string,
  brandName: string,
  competitors: string[]
): ParseResult {
  if (!responseText || !brandName) {
    return {
      brandMentioned: false,
      mentionType: 'not_mentioned',
      mentionPosition: null,
      sentiment: 'neutral',
      competitorsMentioned: detectCompetitors(responseText || '', competitors),
    };
  }

  const brandMentioned = isBrandMentioned(responseText, brandName);

  if (!brandMentioned) {
    return {
      brandMentioned: false,
      mentionType: 'not_mentioned',
      mentionPosition: null,
      sentiment: 'neutral',
      competitorsMentioned: detectCompetitors(responseText, competitors),
    };
  }

  const mentionPosition = detectListPosition(responseText, brandName);
  const mentionType = classifyMentionType(responseText, brandName, mentionPosition);
  const sentiment = classifySentiment(responseText, brandName);
  const competitorsMentioned = detectCompetitors(responseText, competitors);

  return {
    brandMentioned,
    mentionType,
    mentionPosition,
    sentiment,
    competitorsMentioned,
  };
}
