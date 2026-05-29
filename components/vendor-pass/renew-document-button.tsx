'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Repeat } from 'lucide-react';
import { Button } from '@/components/vendor-pass/button';

export function RenewDocumentButton({ documentId, vendorId }: { documentId: string; vendorId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRenew() {
    if (!confirm('Crear una renovación de este documento? Se generará un borrador que lo reemplazará al anclarse.')) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/documents/${documentId}/renew`, { method: 'POST' });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'No se pudo renovar');
      return;
    }
    const { document } = await res.json();
    router.push(`/vendors/${vendorId}/documents/${document.id}/edit`);
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleRenew}
        loading={loading}
        leftIcon={<Repeat size={14} />}
        className="min-h-11"
      >
        Renovar documento
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
