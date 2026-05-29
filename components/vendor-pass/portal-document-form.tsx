'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/vendor-pass/button';
import { FormField, Input, Select } from '@/components/vendor-pass/form-field';
import { DOCUMENT_TYPES } from '@/lib/documents';
import { FileText } from 'lucide-react';

export function PortalDocumentForm({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0].value);
  const [documentName, setDocumentName] = useState('');
  const [issuedAt, setIssuedAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!documentName.trim() || !expiresAt) {
      setError('Completá el nombre y la fecha de vencimiento.');
      return;
    }
    setSubmitting(true);
    const createRes = await fetch('/api/portal/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendor_id: vendorId,
        document_type: documentType,
        document_name: documentName.trim(),
        issued_at: issuedAt || null,
        expires_at: expiresAt,
        criticality: 'normal',
        file_url: fileUrl.trim() || null,
      }),
    });
    if (!createRes.ok) {
      setSubmitting(false);
      const d = await createRes.json().catch(() => ({}));
      setError(d.error ?? 'Error subiendo el documento');
      return;
    }
    const { document } = await createRes.json();
    const submitRes = await fetch(`/api/portal/documents/${document.id}/submit`, { method: 'POST' });
    setSubmitting(false);
    if (!submitRes.ok) {
      const d = await submitRes.json().catch(() => ({}));
      setError(d.error ?? 'El documento se guardó pero no se pudo enviar a revisión');
      return;
    }
    router.push(`/portal/vendors/${vendorId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
      <FormField id="document_type" label="Tipo de documento">
        <Select
          id="document_type"
          value={documentType}
          onChange={e => setDocumentType(e.target.value)}
          options={DOCUMENT_TYPES}
        />
      </FormField>
      <FormField id="document_name" label="Nombre" required>
        <Input
          id="document_name"
          value={documentName}
          onChange={e => setDocumentName(e.target.value)}
          leftAddon={<FileText size={15} />}
          className="min-h-11"
          required
        />
      </FormField>
      <FormField id="issued_at" label="Fecha de emisión">
        <Input id="issued_at" type="date" value={issuedAt} onChange={e => setIssuedAt(e.target.value)} className="min-h-11" />
      </FormField>
      <FormField id="expires_at" label="Vence" required>
        <Input id="expires_at" type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="min-h-11" required />
      </FormField>
      <FormField id="file_url" label="Enlace al archivo (PDF)" hint="Pegá la URL del documento">
        <Input id="file_url" value={fileUrl} onChange={e => setFileUrl(e.target.value)} className="min-h-11" placeholder="https://…" />
      </FormField>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full min-h-11">
        Subir y enviar a revisión
      </Button>
    </form>
  );
}
