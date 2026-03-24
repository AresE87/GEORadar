import { useState } from 'react';
import BrandSelector from './BrandSelector';
import ScoreOverview from './ScoreOverview';
import VisibilityTrendChart from './VisibilityTrendChart';
import RecommendationCard from './RecommendationCard';
import QueryResponses from './QueryResponses';
import type { Plan } from '@/types';

interface Props {
  plan: Plan;
  initialBrandId?: string;
}

export default function DashboardContainer({ plan, initialBrandId }: Props) {
  const [brandId, setBrandId] = useState(initialBrandId ?? '');

  if (!brandId) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Bienvenido a GEORadar</h2>
        <p className="text-slate-500 mb-4">Agrega tu primera marca para comenzar a monitorear</p>
        <a href="/dashboard/brands" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          Agregar marca
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BrandSelector onBrandChange={setBrandId} initialBrandId={brandId} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ScoreOverview brandId={brandId} />
        <VisibilityTrendChart brandId={brandId} plan={plan} />
        <div className="col-span-full lg:col-span-1">
          <RecommendationCard brandId={brandId} plan={plan} limit={3} />
        </div>
        <QueryResponses brandId={brandId} plan={plan} />
      </div>
    </div>
  );
}
