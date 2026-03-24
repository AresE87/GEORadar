import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Brand } from '@/types';

interface Props {
  onBrandChange: (brandId: string) => void;
  initialBrandId?: string;
}

export default function BrandSelector({ onBrandChange, initialBrandId }: Props) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selected, setSelected] = useState(initialBrandId ?? '');

  useEffect(() => {
    async function fetchBrands() {
      try {
        const res = await fetch('/api/brands');
        const data = await res.json();
        const fetchedBrands = data.brands ?? [];
        setBrands(fetchedBrands);
        if (fetchedBrands.length > 0 && !selected) {
          const first = fetchedBrands[0].id;
          setSelected(first);
          onBrandChange(first);
        }
      } catch (err) {
        console.error('Failed to fetch brands:', err);
      }
    }
    fetchBrands();
  }, []);

  function handleChange(value: string | null) {
    if (!value) return;
    setSelected(value);
    onBrandChange(value);
  }

  if (brands.length <= 1) return null;

  return (
    <Select value={selected} onValueChange={handleChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Selecciona marca" />
      </SelectTrigger>
      <SelectContent>
        {brands.map((brand) => (
          <SelectItem key={brand.id} value={brand.id}>
            {brand.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
