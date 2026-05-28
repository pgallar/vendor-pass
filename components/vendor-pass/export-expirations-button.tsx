'use client';

import { useState } from 'react';
import { Button } from './button';
import { Download } from 'lucide-react';

export function ExportExpirationsButton({ windowDays }: { windowDays: string }) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/export/expirations?window=${windowDays}`);
      if (!res.ok) {
        alert('Error exportando CSV');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vencimientos-${windowDays}d.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      loading={loading}
      onClick={handleExport}
      className="min-h-11"
    >
      {!loading && <Download size={14} aria-hidden="true" />}
      Exportar CSV
    </Button>
  );
}
