import type { SupabaseClient } from '@supabase/supabase-js';

export async function userVendorIds(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('vendors').select('id').eq('user_id', userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((v: { id: string }) => v.id);
}

/** Verifica que el proveedor pertenezca al usuario; devuelve null si no existe o no es del dueño. */
export async function getOwnedVendor(
  supabase: SupabaseClient,
  userId: string,
  vendorId: string,
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('vendors')
    .select('id')
    .eq('id', vendorId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Verifica que el documento pertenezca a un proveedor del usuario. */
export async function getOwnedDocument(
  supabase: SupabaseClient,
  userId: string,
  documentId: string,
) {
  const ids = await userVendorIds(supabase, userId);
  if (!ids.length) return null;

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .in('vendor_id', ids)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
