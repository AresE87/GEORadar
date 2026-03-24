import { useState } from 'react';
import { CheckCircle2, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  initialBrandName?: string;
  initialEmail?: string;
}

const INDUSTRIES = [
  'Technology', 'SaaS', 'E-commerce', 'Marketing', 'Finance',
  'Health', 'Education', 'Legal', 'Real Estate', 'Agency', 'Consulting', 'Other',
];

export default function OnboardingWizard({ initialBrandName, initialEmail }: Props) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [brandName, setBrandName] = useState(initialBrandName ?? '');
  const [domain, setDomain] = useState('');
  const [industry, setIndustry] = useState('');
  const [competitors, setCompetitors] = useState('');
  const [brandId, setBrandId] = useState('');

  async function handleCreateBrand() {
    if (!brandName) return;
    setLoading(true);
    try {
      const res = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: brandName,
          domain: domain || undefined,
          industry: industry || undefined,
          competitors: competitors
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();
      if (data.brand?.id) {
        setBrandId(data.brand.id);
        setStep(3);
      }
    } catch (err) {
      console.error('Failed to create brand:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleFinish() {
    setLoading(true);
    try {
      // Trigger first scan
      await fetch(`/api/visibility/${brandId}/scan`, { method: 'POST' });
    } catch {
      // Non-blocking
    }
    window.location.href = '/dashboard';
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`rounded-full transition-all ${
                  s === step ? 'w-8 h-2 bg-blue-600' : s < step ? 'w-2 h-2 bg-blue-600' : 'w-2 h-2 bg-slate-300'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-slate-400 text-center mb-6">Paso {step} de 4</p>

          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="text-center space-y-4">
              <h2 className="text-xl font-bold text-slate-900">
                {initialBrandName
                  ? `Tu score de ${initialBrandName} fue registrado`
                  : 'Configura tu monitoreo de visibilidad en IA'}
              </h2>
              <p className="text-sm text-slate-500">
                Vamos a configurar tu monitoreo continuo en 2 minutos.
              </p>
              <Button className="w-full mt-4" onClick={() => setStep(2)}>
                Empezar <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Step 2: Brand config */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Configura tu marca</h2>
              <div>
                <label className="text-sm font-medium text-slate-700">Nombre de la marca *</label>
                <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="ej. HubSpot" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Dominio</label>
                <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="ej. hubspot.com" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Industria</label>
                <Select value={industry} onValueChange={(v) => { if (v) setIndustry(v); }}>
                  <SelectTrigger><SelectValue placeholder="Selecciona industria" /></SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((ind) => (
                      <SelectItem key={ind} value={ind.toLowerCase()}>{ind}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Competidores (separados por coma)</label>
                <Input value={competitors} onChange={(e) => setCompetitors(e.target.value)} placeholder="ej. Coda, Confluence, Notion" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Atrás
                </Button>
                <Button className="flex-1" onClick={handleCreateBrand} disabled={!brandName || loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Guardar marca
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Review queries */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Queries generados</h2>
              <p className="text-sm text-slate-500">
                Se generaron 8 preguntas automáticamente para monitorear tu visibilidad en ChatGPT, Claude y Perplexity.
              </p>
              <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm text-slate-600">
                <p>• What is {brandName}?</p>
                <p>• Tell me about {brandName}</p>
                <p>• Best {industry || 'software'} tools</p>
                <p>• Top alternatives to {brandName}</p>
                <p>• ...y 4 más</p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Atrás
                </Button>
                <Button className="flex-1" onClick={() => setStep(4)}>
                  Usar queries por defecto <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 4 && (
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-50 rounded-full flex items-center justify-center animate-[scale_0.3s_ease-out]">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Todo listo!</h2>
              <p className="text-sm text-slate-500">
                Tu primer scan se ejecutará en los próximos minutos.
              </p>
              <Button className="w-full mt-4" onClick={handleFinish} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Ir al Dashboard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
