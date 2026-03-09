import type { QueryCategory } from './types';

interface TemplateConfig {
  query_text: string;
  query_category: QueryCategory;
}

export function generateDefaultTemplates(
  brandName: string,
  industry: string | null,
  competitors: string[],
  description: string | null
): TemplateConfig[] {
  const mainCompetitor = competitors[0] ?? 'la competencia';
  const industryText = industry ?? 'su industria';
  const useCase = description ?? industryText;

  return [
    {
      query_text: `¿Qué es ${brandName}?`,
      query_category: 'brand_direct',
    },
    {
      query_text: `¿Cuáles son las mejores herramientas de ${industryText}?`,
      query_category: 'category_search',
    },
    {
      query_text: `¿Qué alternativas a ${mainCompetitor} existen?`,
      query_category: 'comparison',
    },
    {
      query_text: `¿Cómo resolver ${useCase}?`,
      query_category: 'problem_search',
    },
    {
      query_text: `${brandName} vs ${mainCompetitor}, ¿cuál recomiendas?`,
      query_category: 'comparison',
    },
    {
      query_text: `Recomiéndame herramientas para ${useCase}`,
      query_category: 'category_search',
    },
    {
      query_text: `¿${brandName} es buena opción para empresas?`,
      query_category: 'brand_direct',
    },
    {
      query_text: `¿Cuáles son los pros y contras de ${brandName}?`,
      query_category: 'brand_direct',
    },
  ];
}
