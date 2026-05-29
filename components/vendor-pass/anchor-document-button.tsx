'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/vendor-pass/button';
import { Anchor } from 'lucide-react';

export function AnchorDocumentButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAnchor() {
    if (!confirm('¿Anclar este documento en Arkiv? Tras el anclaje, las fechas, el tipo y el archivo quedan inmutables.')) {
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/documents/${documentId}/anchor`, { method: 'POST' });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? 'No se pudo anclar el documento en Arkiv.');
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      loading={loading}
      onClick={handleAnchor}
      leftIcon={<Anchor size={14} />}
      className="shrink-0 min-h-11"
    >
      Anclar
    </Button>
  );
}
