import { documentToValidationEntity } from '@/lib/arkiv/entity';
import { getStore } from '@/lib/arkiv/validations';
import type { ValidationLookup } from '@/lib/arkiv/validations';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { VendorDocument } from '@/lib/types';

export type ValidationResolveSource = 'store' | 'postgres';

export type ResolvedValidationLookup = ValidationLookup & {
  resolvedFrom: ValidationResolveSource;
};

/** Arkiv/memoria primero; Postgres si falta (p. ej. workers distintos en dev o sin sync). */
export async function resolveValidationLookup(
  documentId: string,
): Promise<ResolvedValidationLookup | null> {
  const fromStore = await getStore().getByDocumentId(documentId);
  if (fromStore) {
    return { ...fromStore, resolvedFrom: 'store' };
  }

  const sb = supabaseAdmin();
  const { data: doc, error } = await sb
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .maybeSingle();

  if (error || !doc) return null;

  const { data: vendor } = await sb
    .from('vendors')
    .select('id,name,owner_email,owner_name')
    .eq('id', doc.vendor_id)
    .maybeSingle();

  return {
    entity: documentToValidationEntity(doc as VendorDocument, vendor),
    entityKey: null,
    resolvedFrom: 'postgres',
  };
}
