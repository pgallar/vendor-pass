import type { SupabaseClient } from '@supabase/supabase-js';
import { getStore } from '@/lib/arkiv/validations';
import { documentToValidationEntity } from '@/lib/arkiv/entity';
import { canAnchor } from '@/lib/documents/lifecycle';
import type { VendorDocument } from '@/lib/types';

type VendorInfo = {
  name?: string | null;
  owner_email?: string | null;
  owner_name?: string | null;
};

export type AnchorResult = {
  document: VendorDocument;
  arkivEntityKey: string | null;
  anchoredAt: string;
};

/**
 * Ancla un documento en Arkiv tras la confirmación humana:
 * 1) valida que sea anclable (canAnchor);
 * 2) upsert de la validación (recalcula status vía documentToValidationEntity);
 * 3) cachea el entityKey + anchored_at + lifecycle_status='anchored' en Postgres.
 */
export async function anchorDocument(
  supabase: SupabaseClient,
  doc: VendorDocument,
  vendor: VendorInfo | null | undefined,
): Promise<AnchorResult> {
  const check = canAnchor(doc);
  if (!check.ok) throw new Error(check.reason);

  const store = getStore();
  const anchoredAt = new Date().toISOString();

  // Escribe (o actualiza) la entidad de validación en Arkiv.
  await store.upsert(documentToValidationEntity(doc, vendor, anchoredAt));

  // Lee el entityKey resultante para cachearlo en Postgres (en memoria es null).
  const lookup = await store.getByDocumentId(doc.id);
  const arkivEntityKey = lookup?.entityKey ?? null;

  const { data: updated, error } = await supabase
    .from('documents')
    .update({
      lifecycle_status: 'anchored',
      anchored_at: anchoredAt,
      arkiv_entity_key: arkivEntityKey,
      updated_at: anchoredAt,
    })
    .eq('id', doc.id)
    .select()
    .single();
  if (error || !updated) throw new Error(error?.message ?? 'No se pudo persistir el anclaje');

  return { document: updated as VendorDocument, arkivEntityKey, anchoredAt };
}
