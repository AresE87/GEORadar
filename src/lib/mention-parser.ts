import type { Brand, MentionResult, MentionType, Sentiment } from './types';
import { escapeRegex } from './utils';

const POSITIVE_WORDS = [
  'mejor', 'recomiendo', 'excelente', 'ideal', 'top', 'leading',
  'best', 'recommend', 'excellent', 'great', 'outstanding', 'superior',
  'popular', 'favorito', 'favorite', 'destacado', 'líder', 'leader',
  'potente', 'powerful', 'robusto', 'robust', 'confiable', 'reliable',
];

const NEGATIVE_WORDS = [
  'problema', 'limitado', 'caro', 'difícil', 'no recomiendo', 'evitar',
  'problem', 'limited', 'expensive', 'difficult', 'avoid', 'drawback',
  'desventaja', 'disadvantage', 'peor', 'worst', 'lento', 'slow',
  'complicado', 'complicated', 'buggy', 'unreliable', 'carece', 'lacks',
];

export function parseMention(responseText: string, brand: Brand): MentionResult {
  const text = responseText;
  const textLower = text.toLowerCase();

  // Detectar si la marca fue mencionada (case-insensitive)
  const brandNamePattern = new RegExp(escapeRegex(brand.name), 'i');
  const domainPattern = brand.domain
    ? new RegExp(escapeRegex(brand.domain), 'i')
    : null;

  const nameMatch = brandNamePattern.test(text);
  const domainMatch = domainPattern ? domainPattern.test(text) : false;
  const brandMentioned = nameMatch || domainMatch;

  // Encontrar competidores mencionados
  const competitorsMentioned = (brand.competitors ?? []).filter((comp) => {
    const pattern = new RegExp(escapeRegex(comp), 'i');
    return pattern.test(text);
  });

  if (!brandMentioned) {
    return {
      brand_mentioned: false,
      mention_type: 'not_mentioned',
      mention_position: null,
      mention_context: null,
      competitors_mentioned: competitorsMentioned,
      sentiment: 'not_mentioned',
    };
  }

  // Extraer contexto: las 2 oraciones donde aparece la mención
  const mentionContext = extractMentionContext(text, brand.name);

  // Detectar posición en lista
  const position = extractListPosition(text, brand.name);

  // Determinar tipo de mención
  const mentionType = determineMentionType(textLower, brand.name, position);

  // Detectar sentimiento
  const sentiment = detectSentiment(mentionContext);

  return {
    brand_mentioned: true,
    mention_type: mentionType,
    mention_position: position,
    mention_context: mentionContext,
    competitors_mentioned: competitorsMentioned,
    sentiment,
  };
}

function extractMentionContext(text: string, brandName: string): string | null {
  const sentences = text.split(/[.!?\n]+/).filter((s) => s.trim().length > 0);
  const pattern = new RegExp(escapeRegex(brandName), 'i');

  const matchingIndices: number[] = [];
  sentences.forEach((sentence, index) => {
    if (pattern.test(sentence)) {
      matchingIndices.push(index);
    }
  });

  if (matchingIndices.length === 0) return null;

  // Tomar las primeras 2 oraciones donde aparece
  const contextSentences = matchingIndices
    .slice(0, 2)
    .map((i) => sentences[i]!.trim());

  return contextSentences.join('. ');
}

export function extractListPosition(text: string, brandName: string): number | null {
  const lines = text.split('\n');
  const brandPattern = new RegExp(escapeRegex(brandName), 'i');

  for (const line of lines) {
    if (!brandPattern.test(line)) continue;

    // Detectar numeración: "1.", "1)", "1 -", "#1"
    const numberedMatch = line.match(/^\s*(?:#?\s*)?(\d+)[.):\-\s]/);
    if (numberedMatch) {
      return parseInt(numberedMatch[1]!, 10);
    }

    // Detectar bullet points con posición implícita por orden
    const bulletMatch = line.match(/^\s*[-*•]\s/);
    if (bulletMatch) {
      let bulletPosition = 0;
      for (const l of lines) {
        if (/^\s*[-*•]\s/.test(l)) {
          bulletPosition++;
          if (brandPattern.test(l)) return bulletPosition;
        }
      }
    }
  }

  return null;
}

function determineMentionType(
  textLower: string,
  brandName: string,
  position: number | null
): MentionType {
  const brandLower = brandName.toLowerCase();

  // Detectar mención negativa
  const negativePatterns = [
    `no recomiendo ${brandLower}`,
    `evitar ${brandLower}`,
    `problema con ${brandLower}`,
    `avoid ${brandLower}`,
    `don't recommend ${brandLower}`,
    `problems with ${brandLower}`,
    `${brandLower} tiene problemas`,
    `${brandLower} has issues`,
  ];

  for (const pattern of negativePatterns) {
    if (textLower.includes(pattern)) return 'negative';
  }

  // Si está en posición 1 de una lista → primary
  if (position === 1) return 'primary';

  // Si está en posición > 1 → secondary
  if (position !== null && position > 1) return 'secondary';

  // Detectar si es la única o principal recomendación
  const primaryIndicators = [
    `recomiendo ${brandLower}`,
    `${brandLower} es la mejor`,
    `${brandLower} is the best`,
    `recommend ${brandLower}`,
    `top pick: ${brandLower}`,
    `mi recomendación es ${brandLower}`,
  ];

  for (const pattern of primaryIndicators) {
    if (textLower.includes(pattern)) return 'primary';
  }

  return 'secondary';
}

export function detectSentiment(mentionContext: string | null): Sentiment {
  if (!mentionContext) return 'not_mentioned';

  const contextLower = mentionContext.toLowerCase();
  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of POSITIVE_WORDS) {
    if (contextLower.includes(word)) positiveCount++;
  }
  for (const word of NEGATIVE_WORDS) {
    if (contextLower.includes(word)) negativeCount++;
  }

  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}
