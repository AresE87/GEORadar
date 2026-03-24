import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  onSubmit: (brandName: string, email?: string) => void;
  theme?: 'light' | 'dark';
}

export default function AuditForm({ onSubmit, theme = 'light' }: Props) {
  const [brandName, setBrandName] = useState('');
  const [email, setEmail] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!brandName.trim()) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    setLoading(true);
    onSubmit(brandName.trim(), email.trim() || undefined);
  }

  const isDark = theme === 'dark';

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto space-y-3">
      <div className={shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}>
        <Input
          type="text"
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          placeholder="ej. HubSpot, Notion, tu marca..."
          maxLength={100}
          autoFocus
          className={`h-12 text-lg rounded-lg border-2 ${
            isDark
              ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50'
              : 'border-slate-300 focus:border-blue-500'
          }`}
        />
      </div>
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Tu email para el reporte completo (opcional)"
        className={`h-10 text-sm ${
          isDark ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50' : ''
        }`}
      />
      <Button
        type="submit"
        disabled={loading}
        className={`w-full h-12 text-lg font-semibold rounded-lg transition-all hover:scale-[1.02] ${
          isDark ? 'bg-blue-500 hover:bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
        Analizar Visibilidad IA
      </Button>
      <p className={`text-xs text-center ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
        Gratis. Sin registro. Resultados en 15 segundos.
      </p>
    </form>
  );
}
