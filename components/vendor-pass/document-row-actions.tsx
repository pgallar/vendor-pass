'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from './button';
import { Pencil, Trash2 } from 'lucide-react';

export function DocumentRowActions({
  documentId,
  vendorId,
}: {
  documentId: string;
  vendorId: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm('¿Eliminar este documento? Esta acción no se puede deshacer.')) return;
    setDeleting(true);
    const res = await fetch(`/api/documents/${documentId}`, { method: 'DELETE' });
    setDeleting(false);
    if (res.ok) router.refresh();
    else alert('Error eliminando documento');
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      <Link
        href={`/vendors/${vendorId}/documents/${documentId}/edit`}
        className="inline-flex items-center justify-center min-h-11 min-w-11 text-muted-foreground hover:text-foreground"
        title="Editar documento"
      >
        <Pencil size={14} aria-hidden="true" />
        <span className="sr-only">Editar</span>
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="min-h-11 min-w-11 px-2 text-muted-foreground hover:text-destructive"
        onClick={handleDelete}
        loading={deleting}
        title="Eliminar documento"
        aria-label="Eliminar documento"
      >
        {!deleting && <Trash2 size={14} aria-hidden="true" />}
      </Button>
    </div>
  );
}
