import { useState, useEffect, useCallback } from 'react';
import ScoreOverview from './ScoreOverview';
import VisibilityTrendChart from './VisibilityTrendChart';
import QueryResponses from './QueryResponses';
import type { Brand, VisibilityScore, LLMResponse, Recommendation } from '../lib/types';

// Demo data for when no API is connected
const DEMO_BRAND: Brand = {
  id: 'demo',
  user_id: 'demo',
  name: 'Tu Marca',
  domain: null,
  description: 'Agrega tu marca para empezar',
  industry: null,
  competitors: [],
  target_keywords: [],
  plan: 'free',
  monitoring_active: true,
  created_at: new Date().toISOString(),
  last_scanned_at: null,
};

export default function DashboardApp() {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [scores, setScores] = useState<VisibilityScore[]>([]);
  const [responses, setResponses] = useState<LLMResponse[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddBrand, setShowAddBrand] = useState(false);

  // Form state for adding brand
  const [newBrand, setNewBrand] = useState({
    name: '',
    domain: '',
    description: '',
    industry: '',
    competitors: '',
  });

  useEffect(() => {
    // In a real app, fetch from API with auth token
    setLoading(false);
    setShowAddBrand(true);
  }, []);

  const handleScanNow = useCallback(async () => {
    if (!brand || scanning) return;
    setScanning(true);
    try {
      // Would call /api/visibility/{brandId}/scan
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } finally {
      setScanning(false);
    }
  }, [brand, scanning]);

  const handleAddBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    // Would call POST /api/brands
    const fakeBrand: Brand = {
      id: crypto.randomUUID(),
      user_id: 'user',
      name: newBrand.name,
      domain: newBrand.domain || null,
      description: newBrand.description || null,
      industry: newBrand.industry || null,
      competitors: newBrand.competitors.split(',').map((c) => c.trim()).filter(Boolean),
      target_keywords: [],
      plan: 'free',
      monitoring_active: true,
      created_at: new Date().toISOString(),
      last_scanned_at: null,
    };
    setBrand(fakeBrand);
    setShowAddBrand(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  // Onboarding: no brands yet
  if (showAddBrand && !brand) {
    return (
      <div className="max-w-lg mx-auto mt-16">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Agrega tu primera marca
          </h2>
          <p className="text-slate-500 mt-2">
            Empieza a monitorear cómo apareces en ChatGPT, Claude y Perplexity.
          </p>
        </div>

        <form onSubmit={handleAddBrand} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nombre de la marca *
            </label>
            <input
              type="text"
              required
              value={newBrand.name}
              onChange={(e) => setNewBrand({ ...newBrand, name: e.target.value })}
              placeholder="Ej: Notion, Linear, Mi Empresa"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Dominio
            </label>
            <input
              type="text"
              value={newBrand.domain}
              onChange={(e) => setNewBrand({ ...newBrand, domain: e.target.value })}
              placeholder="Ej: notion.so"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Descripción
            </label>
            <input
              type="text"
              value={newBrand.description}
              onChange={(e) => setNewBrand({ ...newBrand, description: e.target.value })}
              placeholder="¿Qué hace tu empresa?"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Industria
            </label>
            <input
              type="text"
              value={newBrand.industry}
              onChange={(e) => setNewBrand({ ...newBrand, industry: e.target.value })}
              placeholder="Ej: project management SaaS"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Competidores (separados por coma)
            </label>
            <input
              type="text"
              value={newBrand.competitors}
              onChange={(e) => setNewBrand({ ...newBrand, competitors: e.target.value })}
              placeholder="Ej: Asana, Monday, ClickUp"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
          >
            Agregar marca y escanear
          </button>
        </form>
      </div>
    );
  }

  const activeBrand = brand ?? DEMO_BRAND;

  return (
    <div className="space-y-6">
      {/* Brand header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{activeBrand.name}</h1>
          {activeBrand.last_scanned_at && (
            <p className="text-sm text-slate-500">
              Último scan: {new Date(activeBrand.last_scanned_at).toLocaleString('es')}
            </p>
          )}
        </div>
      </div>

      {/* Score Overview */}
      <ScoreOverview
        brand={activeBrand}
        scores={scores}
        onScanNow={handleScanNow}
        scanning={scanning}
      />

      {/* Trend Chart */}
      <VisibilityTrendChart scores={scores} days={30} />

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Recomendaciones Prioritarias
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {recommendations.slice(0, 3).map((rec) => (
              <div key={rec.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <span className={`inline-block px-2 py-0.5 text-xs rounded-full mb-2 ${
                  rec.priority === 'critical' ? 'bg-red-100 text-red-700' :
                  rec.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                  rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {rec.priority}
                </span>
                <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">{rec.title}</h4>
                <p className="text-xs text-slate-500 mt-1">{rec.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Query Responses */}
      <QueryResponses responses={responses} brand={activeBrand} />
    </div>
  );
}
