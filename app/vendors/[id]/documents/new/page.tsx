'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AppShell } from '@/components/vendor-pass/app-shell';
import { PageHeader } from '@/components/vendor-pass/page-header';
import { Button } from '@/components/vendor-pass/button';
import { FormField, Input, Select, Textarea } from '@/components/vendor-pass/form-field';
import { Calendar, FileText, Link as LinkIcon, Upload, Hash } from 'lucide-react';

const DOCUMENT_TYPES = [
  { value: 'poliza_art', label: 'Póliza ART' },
  { value: 'habilitacion', label: 'Habilitación' },
  { value: 'constancia_fiscal', label: 'Constancia fiscal' },
  { value: 'seguro_rc', label: 'Seguro RC' },
  { value: 'certificado_iso', label: 'Certificado ISO' },
  { value: 'otro', label: 'Otro' },
];

interface FormState {
  document_type: string;
  document_name: string;
  issued_at: string;
  expires_at: string;
  criticality: string;
  file_url: string;
  file_hash: string;
  notes: string;
}

export default function NewDocumentPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const vendorId = params.id;
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUrlFallback, setShowUrlFallback] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [form, setForm] = useState<FormState>({
    document_type: '',
    document_name: '',
    issued_at: '',
    expires_at: '',
    criticality: 'critical',
    file_url: '',
    file_hash: '',
    notes: '',
  });

  function handleChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (key in errors) setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function handleTipoChange(value: string) {
    const match = DOCUMENT_TYPES.find(t => t.value === value);
    setForm(prev => ({
      ...prev,
      document_type: value,
      document_name: match && !prev.document_name ? match.label : prev.document_name,
    }));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    const body = new FormData();
    body.append('file', file);
    body.append('vendorId', vendorId);
    const res = await fetch('/api/upload', { method: 'POST', body });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setUploadError(data.error ?? 'Error subiendo archivo');
      return;
    }
    const { fileUrl, fileHash } = await res.json();
    setForm(prev => ({ ...prev, file_url: fileUrl, file_hash: fileHash }));
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.document_type) newErrors.document_type = 'Selecciona el tipo de documento';
    if (!form.document_name.trim()) newErrors.document_name = 'El nombre es requerido';
    if (!form.issued_at) newErrors.issued_at = 'Ingresa la fecha de emisión';
    if (!form.expires_at) newErrors.expires_at = 'Ingresa la fecha de vencimiento';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        vendor_id: vendorId,
        file_hash: form.file_hash || null,
        file_url: form.file_url || null,
      }),
    });
    setLoading(false);
    if (res.ok) router.push(`/vendors/${vendorId}`);
    else alert('Error creando documento');
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Agregar documento"
          backHref={`/vendors/${vendorId}`}
          backLabel="Volver al proveedor"
          breadcrumbs={[
            { label: 'Proveedores', href: '/vendors' },
            { label: vendorId, href: `/vendors/${vendorId}` },
            { label: 'Nuevo documento' },
          ]}
        />

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
          <section aria-labelledby="doc-heading" className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
            <h2 id="doc-heading" className="text-sm font-semibold text-foreground">
              Datos del documento
            </h2>

            <FormField id="document_type" label="Tipo de documento" required error={errors.document_type}>
              <Select
                id="document_type"
                value={form.document_type}
                onChange={e => handleTipoChange(e.target.value)}
                placeholder="Selecciona el tipo"
                options={DOCUMENT_TYPES}
                error={!!errors.document_type}
                className="min-h-11"
              />
            </FormField>

            <FormField id="document_name" label="Nombre del documento" required error={errors.document_name}>
              <Input
                id="document_name"
                placeholder="Ej: Póliza ART 2025"
                value={form.document_name}
                onChange={e => handleChange('document_name', e.target.value)}
                error={!!errors.document_name}
                leftAddon={<FileText size={15} />}
                className="min-h-11"
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField id="issued_at" label="Fecha de emisión" required error={errors.issued_at}>
                <Input
                  id="issued_at"
                  type="date"
                  value={form.issued_at}
                  onChange={e => handleChange('issued_at', e.target.value)}
                  error={!!errors.issued_at}
                  leftAddon={<Calendar size={15} />}
                  className="min-h-11"
                />
              </FormField>

              <FormField id="expires_at" label="Fecha de vencimiento" required error={errors.expires_at}>
                <Input
                  id="expires_at"
                  type="date"
                  value={form.expires_at}
                  onChange={e => handleChange('expires_at', e.target.value)}
                  error={!!errors.expires_at}
                  leftAddon={<Calendar size={15} />}
                  className="min-h-11"
                />
              </FormField>
            </div>

            <FormField id="criticality" label="Criticidad" required>
              <Select
                id="criticality"
                value={form.criticality}
                onChange={e => handleChange('criticality', e.target.value)}
                options={[
                  { value: 'critical', label: 'Crítico' },
                  { value: 'normal', label: 'Normal' },
                ]}
                className="min-h-11"
              />
            </FormField>
          </section>

          <section aria-labelledby="evidence-heading" className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
            <h2 id="evidence-heading" className="text-sm font-semibold text-foreground">
              Evidencia
            </h2>

            <FormField
              id="file"
              label="Archivo de evidencia"
              hint="PDF o imagen (máx. 10 MB). Se almacena en S3 y se calcula hash SHA-256."
            >
              <label
                htmlFor="file"
                className="flex items-center justify-center gap-2 min-h-11 px-4 border border-dashed border-border rounded-lg cursor-pointer hover:bg-secondary/40 transition-colors"
              >
                <Upload size={16} className="text-muted-foreground" aria-hidden="true" />
                <span className="text-sm text-muted-foreground">
                  {uploading ? 'Subiendo…' : form.file_url ? 'Archivo cargado — cambiar' : 'Seleccionar archivo'}
                </span>
              </label>
              <input
                id="file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                className="sr-only"
                onChange={handleFileChange}
                disabled={uploading || loading}
              />
            </FormField>

            {uploadError && (
              <p className="text-xs text-destructive">{uploadError}</p>
            )}

            {form.file_hash && (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-secondary text-xs">
                <Hash size={14} className="text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                <code className="font-mono break-all text-muted-foreground">{form.file_hash}</code>
              </div>
            )}

            <button
              type="button"
              className="text-xs text-primary font-medium text-left"
              onClick={() => setShowUrlFallback(v => !v)}
            >
              {showUrlFallback ? 'Ocultar URL manual' : 'Usar URL manual (avanzado)'}
            </button>

            {showUrlFallback && (
              <FormField id="file_url" label="URL de evidencia" hint="Enlace externo si no subes archivo">
                <Input
                  id="file_url"
                  type="url"
                  inputMode="url"
                  placeholder="https://…"
                  value={form.file_url}
                  onChange={e => handleChange('file_url', e.target.value)}
                  leftAddon={<LinkIcon size={15} />}
                  className="min-h-11"
                />
              </FormField>
            )}

            <FormField id="notes" label="Notas">
              <Textarea
                id="notes"
                placeholder="Observaciones sobre el documento…"
                value={form.notes}
                onChange={e => handleChange('notes', e.target.value)}
                rows={3}
              />
            </FormField>
          </section>

          <div className="flex flex-col gap-2">
            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full min-h-11">
              {loading ? 'Guardando…' : 'Guardar documento'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="w-full min-h-11"
              onClick={() => router.push(`/vendors/${vendorId}`)}
              disabled={loading}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
