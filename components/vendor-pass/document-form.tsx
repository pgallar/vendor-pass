'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/vendor-pass/button';
import { FormField, Input, Select, Textarea } from '@/components/vendor-pass/form-field';
import { Calendar, FileText, Link as LinkIcon, Upload, Hash, Sparkles } from 'lucide-react';
import { DOCUMENT_TYPES } from '@/lib/documents';
import type { ExtractedDocument } from '@/lib/types';

export { DOCUMENT_TYPES } from '@/lib/documents';

export interface DocumentFormState {
  document_type: string;
  document_name: string;
  issued_at: string;
  expires_at: string;
  criticality: string;
  file_url: string;
  file_hash: string;
  notes: string;
}

export interface DocumentFormProps {
  vendorId: string;
  documentId?: string;
  initial: DocumentFormState;
  submitLabel: string;
  onCancel: () => void;
}

function AiBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
      <Sparkles size={10} aria-hidden="true" /> IA
    </span>
  );
}

export function DocumentForm({ vendorId, documentId, initial, submitLabel, onCancel }: DocumentFormProps) {
  const router = useRouter();
  const isEdit = Boolean(documentId);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUrlFallback, setShowUrlFallback] = useState(Boolean(initial.file_url));
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof DocumentFormState, string>>>({});
  const [form, setForm] = useState<DocumentFormState>(initial);
  const [aiFields, setAiFields] = useState<Set<string>>(new Set());
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [aiExtracting, setAiExtracting] = useState(false);
  const [aiSummary, setAiSummary] = useState<string>('');

  function handleChange<K extends keyof DocumentFormState>(key: K, value: DocumentFormState[K]) {
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

  function applyExtraction(ex: ExtractedDocument) {
    const filled = new Set<string>();
    setForm(prev => {
      const next = { ...prev };
      const maybe = (key: keyof DocumentFormState, value: string) => {
        if (value && !prev[key]) {
          next[key] = value;
          filled.add(key);
        }
      };
      maybe('document_type', ex.document_type !== 'otro' ? ex.document_type : '');
      maybe('document_name', ex.document_name);
      maybe('issued_at', ex.issued_at);
      maybe('expires_at', ex.expires_at);
      if (ex.criticality && !filled.has('criticality')) {
        next.criticality = ex.criticality;
        filled.add('criticality');
      }
      // Volcar metadatos extra en notas si están vacías
      if (!prev.notes) {
        const meta = [
          ex.issuer && `Emisor: ${ex.issuer}`,
          ex.policy_number && `N°: ${ex.policy_number}`,
          ex.coverage && `Cobertura: ${ex.coverage}`,
        ].filter(Boolean);
        if (meta.length) {
          next.notes = meta.join(' · ');
          filled.add('notes');
        }
      }
      return next;
    });
    setAiFields(filled);
    setAiConfidence(ex.confidence);
    setAiSummary(ex.summary);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    setAiExtracting(true);

    const uploadBody = new FormData();
    uploadBody.append('file', file);
    uploadBody.append('vendorId', vendorId);

    const extractBody = new FormData();
    extractBody.append('file', file);

    const [uploadRes, extractRes] = await Promise.allSettled([
      fetch('/api/upload', { method: 'POST', body: uploadBody }),
      fetch('/api/documents/extract', { method: 'POST', body: extractBody }),
    ]);

    setUploading(false);
    setAiExtracting(false);

    if (uploadRes.status === 'fulfilled' && uploadRes.value.ok) {
      const { fileUrl, fileHash } = await uploadRes.value.json();
      setForm(prev => ({ ...prev, file_url: fileUrl, file_hash: fileHash }));
    } else {
      const data =
        uploadRes.status === 'fulfilled' ? await uploadRes.value.json().catch(() => ({})) : {};
      setUploadError(data.error ?? 'Error subiendo archivo');
    }

    if (extractRes.status === 'fulfilled' && extractRes.value.ok) {
      const { extracted } = await extractRes.value.json();
      applyExtraction(extracted as ExtractedDocument);
    }
    // Si la extracción falla o no está configurada, se ignora en silencio: el form sigue manual.
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof DocumentFormState, string>> = {};
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
    const payload = {
      ...form,
      file_hash: form.file_hash || null,
      file_url: form.file_url || null,
    };
    const res = await fetch(
      isEdit ? `/api/documents/${documentId}` : '/api/documents',
      {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? payload : { ...payload, vendor_id: vendorId }),
      },
    );
    setLoading(false);
    if (res.ok) router.push(`/vendors/${vendorId}`);
    else alert(isEdit ? 'Error actualizando documento' : 'Error creando documento');
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {aiExtracting && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-primary">
          <Sparkles size={15} className="animate-pulse" aria-hidden="true" />
          Analizando documento con IA…
        </div>
      )}
      {!aiExtracting && aiConfidence !== null && (
        <div className="flex flex-col gap-1 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
          <span className="inline-flex items-center gap-2 font-medium text-primary">
            <Sparkles size={15} aria-hidden="true" />
            Campos precargados por IA · confianza {Math.round(aiConfidence * 100)}%
          </span>
          {aiSummary && <span className="text-xs text-muted-foreground">{aiSummary}</span>}
          <span className="text-xs text-muted-foreground">Revisá y corregí antes de guardar.</span>
        </div>
      )}
      <section aria-labelledby="doc-heading" className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
        <h2 id="doc-heading" className="text-sm font-semibold text-foreground">
          Datos del documento
        </h2>

        <FormField
          id="document_type"
          label={<>Tipo de documento {aiFields.has('document_type') && <AiBadge />}</>}
          required
          error={errors.document_type}
        >
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

        <FormField
          id="document_name"
          label={<>Nombre del documento {aiFields.has('document_name') && <AiBadge />}</>}
          required
          error={errors.document_name}
        >
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
          <FormField
            id="issued_at"
            label={<>Fecha de emisión {aiFields.has('issued_at') && <AiBadge />}</>}
            required
            error={errors.issued_at}
          >
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

          <FormField
            id="expires_at"
            label={<>Fecha de vencimiento {aiFields.has('expires_at') && <AiBadge />}</>}
            required
            error={errors.expires_at}
          >
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

        <FormField
          id="criticality"
          label={<>Criticidad {aiFields.has('criticality') && <AiBadge />}</>}
          required
        >
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

        {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}

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

        <FormField
          id="notes"
          label={<>Notas {aiFields.has('notes') && <AiBadge />}</>}
        >
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
          {loading ? 'Guardando…' : submitLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="w-full min-h-11"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
