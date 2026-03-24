import { useState } from 'react';
import AuditForm from './AuditForm';
import AuditLoading from './AuditLoading';
import AuditResult from './AuditResult';
import type { AuditResult as AuditResultType } from '@/types';

interface Props {
  theme?: 'light' | 'dark';
}

type AuditState = 'form' | 'loading' | 'result' | 'error';

export default function AuditContainer({ theme = 'light' }: Props) {
  const [state, setState] = useState<AuditState>('form');
  const [brandName, setBrandName] = useState('');
  const [result, setResult] = useState<AuditResultType | null>(null);
  const [error, setError] = useState('');

  async function handleSubmit(name: string, email?: string) {
    setBrandName(name);
    setState('loading');
    setError('');

    try {
      const res = await fetch('/api/audit/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_name: name, email }),
      });

      if (res.status === 429) {
        setError('Has alcanzado el límite de consultas. Intenta de nuevo en 30 minutos.');
        setState('error');
        return;
      }

      if (!res.ok) {
        setError('Error al analizar. Intenta de nuevo.');
        setState('error');
        return;
      }

      const data = await res.json() as AuditResultType;
      setResult(data);
      setState('result');
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
      setState('error');
    }
  }

  if (state === 'loading') {
    return <AuditLoading brandName={brandName} />;
  }

  if (state === 'result' && result) {
    return <AuditResult result={result} brandName={brandName} />;
  }

  if (state === 'error') {
    return (
      <div className="w-full max-w-xl mx-auto text-center space-y-4">
        <p className="text-red-500">{error}</p>
        <button
          onClick={() => setState('form')}
          className="text-sm text-blue-600 hover:underline"
        >
          Intentar de nuevo
        </button>
      </div>
    );
  }

  return <AuditForm onSubmit={handleSubmit} theme={theme} />;
}
