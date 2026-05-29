import { createHash, randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { documentToValidationEntity } from '@/lib/arkiv/entity';
import { getStore } from '@/lib/arkiv/validations';
import { immutableFieldsChanged } from '@/lib/documents/lifecycle';
import { DOCUMENT_TYPE_VALUES } from '@/lib/documents';
import { isAiConfigured } from '@/lib/ai/client';
import { buildDocumentInputFromExtraction } from '@/lib/api-keys/document-from-extraction';
import { assertAiExtractionAvailable } from '@/lib/api-keys/ai-extract';
import { extractDocumentFields } from '@/lib/ai/extract';
import { parseBase64File } from '@/lib/api-keys/file-bytes';
import { getOwnedDocument, getOwnedVendor } from '@/lib/api-keys/scope';
import type { DocumentInput, VendorInput } from '@/lib/api-keys/types';
import { documentStatus } from '@/lib/status';
import { uploadEvidence } from '@/lib/storage/s3';
import type { ExtractedDocument, VendorDocument } from '@/lib/types';

export type { DocumentInput, VendorInput } from '@/lib/api-keys/types';

function trimOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function validateDocumentInput(body: DocumentInput) {
  if (!body.vendor_id?.trim()) throw new Error('vendor_id es requerido');
  if (!body.document_name?.trim()) throw new Error('document_name es requerido');
  if (!body.issued_at?.trim() || !body.expires_at?.trim()) {
    throw new Error('issued_at y expires_at son requeridos (YYYY-MM-DD)');
  }
  if (!DOCUMENT_TYPE_VALUES.includes(body.document_type)) {
    throw new Error(`document_type inválido. Valores: ${DOCUMENT_TYPE_VALUES.join(', ')}`);
  }
  if (body.criticality !== 'critical' && body.criticality !== 'normal') {
    throw new Error('criticality debe ser "critical" o "normal"');
  }
}

async function vendorInfo(supabase: SupabaseClient, vendorId: string) {
  const { data } = await supabase
    .from('vendors')
    .select('name, owner_email, owner_name')
    .eq('id', vendorId)
    .maybeSingle();
  return data;
}

async function syncDocumentArkiv(supabase: SupabaseClient, doc: VendorDocument) {
  if (doc.lifecycle_status !== 'anchored') return;
  const vendor = await vendorInfo(supabase, doc.vendor_id);
  await getStore().upsert(documentToValidationEntity(doc, vendor));
}

export async function createVendor(
  supabase: SupabaseClient,
  userId: string,
  input: VendorInput,
) {
  const name = input.name?.trim();
  if (!name) throw new Error('El nombre del proveedor es requerido');

  const { data, error } = await supabase
    .from('vendors')
    .insert({
      name,
      category: trimOrNull(input.category),
      owner_name: trimOrNull(input.owner_name),
      owner_email: trimOrNull(input.owner_email),
      area: trimOrNull(input.area),
      notes: trimOrNull(input.notes),
      user_id: userId,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Error creando proveedor');
  return data;
}

export async function updateVendor(
  supabase: SupabaseClient,
  userId: string,
  vendorId: string,
  input: Partial<VendorInput>,
) {
  const owned = await getOwnedVendor(supabase, userId, vendorId);
  if (!owned) return null;

  const name = input.name !== undefined ? input.name.trim() : undefined;
  if (name !== undefined && !name) throw new Error('El nombre del proveedor es requerido');

  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.name = name;
  if (input.category !== undefined) patch.category = trimOrNull(input.category);
  if (input.owner_name !== undefined) patch.owner_name = trimOrNull(input.owner_name);
  if (input.owner_email !== undefined) patch.owner_email = trimOrNull(input.owner_email);
  if (input.area !== undefined) patch.area = trimOrNull(input.area);
  if (input.notes !== undefined) patch.notes = trimOrNull(input.notes);

  const { data, error } = await supabase
    .from('vendors')
    .update(patch)
    .eq('id', vendorId)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Error actualizando proveedor');
  return data;
}

export async function deleteVendor(supabase: SupabaseClient, userId: string, vendorId: string) {
  const owned = await getOwnedVendor(supabase, userId, vendorId);
  if (!owned) return null;

  const { data: docs } = await supabase.from('documents').select('id').eq('vendor_id', vendorId);
  const { error } = await supabase.from('vendors').delete().eq('id', vendorId).eq('user_id', userId);
  if (error) throw new Error(error.message);

  const store = getStore();
  for (const doc of docs ?? []) {
    await store.remove(doc.id);
  }
  return { ok: true as const, documentsRemoved: (docs ?? []).length };
}

async function uploadVendorBuffer(
  vendorId: string,
  buffer: Buffer,
  mime: string,
  filename: string,
) {
  if (!process.env.S3_ENDPOINT) {
    throw new Error('Almacenamiento de archivos no configurado en el servidor');
  }
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_') || 'archivo';
  const fileHash = createHash('sha256').update(buffer).digest('hex');
  const key = `evidence/${vendorId}/${randomUUID()}-${safeName}`;
  const { url } = await uploadEvidence(buffer, mime, key);
  return { fileUrl: url, fileHash };
}

export async function uploadVendorFile(
  supabase: SupabaseClient,
  userId: string,
  vendorId: string,
  file: { filename: string; mime_type: string; content_base64: string },
) {
  const owned = await getOwnedVendor(supabase, userId, vendorId);
  if (!owned) return null;

  const buffer = parseBase64File(file);
  return uploadVendorBuffer(vendorId, buffer, file.mime_type, file.filename);
}

export async function createDocument(
  supabase: SupabaseClient,
  userId: string,
  input: DocumentInput,
) {
  validateDocumentInput(input);
  const owned = await getOwnedVendor(supabase, userId, input.vendor_id);
  if (!owned) return null;

  const { data: doc, error } = await supabase
    .from('documents')
    .insert({
      vendor_id: input.vendor_id,
      document_type: input.document_type,
      document_name: input.document_name.trim(),
      issued_at: input.issued_at,
      expires_at: input.expires_at,
      criticality: input.criticality,
      file_url: input.file_url ?? null,
      file_hash: input.file_hash ?? null,
      notes: trimOrNull(input.notes),
    })
    .select('*')
    .single();
  if (error || !doc) throw new Error(error?.message ?? 'Error creando documento');

  const typed = doc as VendorDocument;
  await syncDocumentArkiv(supabase, typed);
  return { ...typed, status: documentStatus(typed) };
}

export async function updateDocument(
  supabase: SupabaseClient,
  userId: string,
  documentId: string,
  input: Partial<DocumentInput>,
) {
  const existing = await getOwnedDocument(supabase, userId, documentId);
  if (!existing) return null;

  if (input.vendor_id && input.vendor_id !== existing.vendor_id) {
    throw new Error('No se puede cambiar el proveedor de un documento');
  }

  if (existing.lifecycle_status === 'anchored') {
    const changed = immutableFieldsChanged(existing, {
      document_type: input.document_type,
      issued_at: input.issued_at,
      expires_at: input.expires_at,
      file_hash: input.file_hash,
    });
    if (changed.length > 0) {
      throw new Error(
        `El documento está anclado en Arkiv: no se pueden modificar ${changed.join(', ')}.`,
      );
    }
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.document_type !== undefined) {
    if (!DOCUMENT_TYPE_VALUES.includes(input.document_type)) {
      throw new Error(`document_type inválido. Valores: ${DOCUMENT_TYPE_VALUES.join(', ')}`);
    }
    patch.document_type = input.document_type;
  }
  if (input.document_name !== undefined) patch.document_name = input.document_name.trim();
  if (input.issued_at !== undefined) patch.issued_at = input.issued_at;
  if (input.expires_at !== undefined) patch.expires_at = input.expires_at;
  if (input.criticality !== undefined) patch.criticality = input.criticality;
  if (input.file_url !== undefined) patch.file_url = input.file_url;
  if (input.file_hash !== undefined) patch.file_hash = input.file_hash;
  if (input.notes !== undefined) patch.notes = trimOrNull(input.notes);

  const { data: doc, error } = await supabase
    .from('documents')
    .update(patch)
    .eq('id', documentId)
    .select('*')
    .single();
  if (error || !doc) throw new Error(error?.message ?? 'Error actualizando documento');

  const typed = doc as VendorDocument;
  await syncDocumentArkiv(supabase, typed);
  return { ...typed, status: documentStatus(typed) };
}

export async function deleteDocument(
  supabase: SupabaseClient,
  userId: string,
  documentId: string,
) {
  const existing = await getOwnedDocument(supabase, userId, documentId);
  if (!existing) return null;

  const { error } = await supabase.from('documents').delete().eq('id', documentId);
  if (error) throw new Error(error.message);
  await getStore().remove(documentId);
  return { ok: true as const };
}

/** Sube archivo y crea el documento en un solo paso. */
export async function createDocumentWithFile(
  supabase: SupabaseClient,
  userId: string,
  input: DocumentInput & {
    filename: string;
    mime_type: string;
    content_base64: string;
  },
) {
  const upload = await uploadVendorFile(supabase, userId, input.vendor_id, {
    filename: input.filename,
    mime_type: input.mime_type,
    content_base64: input.content_base64,
  });
  if (!upload) return null;

  return createDocument(supabase, userId, {
    ...input,
    file_url: upload.fileUrl,
    file_hash: upload.fileHash,
  });
}

export type CreateDocumentFromFileInput = {
  vendor_id: string;
  filename: string;
  mime_type: string;
  content_base64: string;
  /** Si true (default) y OPENROUTER_API_KEY está configurada, extrae metadatos del archivo. */
  extract_with_ai?: boolean;
  document_type?: string;
  document_name?: string;
  issued_at?: string;
  expires_at?: string;
  criticality?: DocumentInput['criticality'];
  notes?: string | null;
};

/**
 * Sube el archivo, opcionalmente extrae campos con OpenRouter y crea el documento.
 * Los campos explícitos en input tienen prioridad sobre la extracción IA.
 */
export async function createDocumentFromFileWithAi(
  supabase: SupabaseClient,
  userId: string,
  input: CreateDocumentFromFileInput,
) {
  const owned = await getOwnedVendor(supabase, userId, input.vendor_id);
  if (!owned) return null;

  const buffer = parseBase64File(input);
  const upload = await uploadVendorBuffer(
    input.vendor_id,
    buffer,
    input.mime_type,
    input.filename,
  );

  const wantAi = input.extract_with_ai !== false;
  let extracted: ExtractedDocument | null = null;

  if (wantAi) {
    if (!isAiConfigured()) {
      throw new Error(
        'extract_with_ai está activo pero OPENROUTER_API_KEY no está configurada. ' +
          'Desactivá extract_with_ai y proveé todos los metadatos, o configurá OpenRouter.',
      );
    }
    assertAiExtractionAvailable();
    extracted = await extractDocumentFields(buffer, input.mime_type);
  }

  const docInput = buildDocumentInputFromExtraction(
    input.vendor_id,
    upload,
    extracted,
    {
      document_type: input.document_type,
      document_name: input.document_name,
      issued_at: input.issued_at,
      expires_at: input.expires_at,
      criticality: input.criticality,
      notes: input.notes,
    },
  );

  const document = await createDocument(supabase, userId, docInput);
  return { document, extracted, upload };
}
