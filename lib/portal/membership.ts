import type { SupabaseClient } from '@supabase/supabase-js';
import type { PortalRole } from '@/lib/types';

export interface MemberVendor {
  vendor_id: string;
  role: PortalRole;
  vendor: { id: string; name: string; category: string | null; area: string | null };
}

/** Lista los proveedores donde el usuario es miembro del portal. RLS limita a lo permitido. */
export async function listMemberVendors(
  supabase: SupabaseClient,
  userId: string,
): Promise<MemberVendor[]> {
  const { data, error } = await supabase
    .from('vendor_portal_members')
    .select('vendor_id, role, vendor:vendors(id, name, category, area)')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MemberVendor[];
}

/** Devuelve el rol si el usuario es miembro del vendor, o null si no lo es. */
export async function requirePortalMember(
  supabase: SupabaseClient,
  userId: string,
  vendorId: string,
): Promise<PortalRole | null> {
  const { data, error } = await supabase
    .from('vendor_portal_members')
    .select('role')
    .eq('user_id', userId)
    .eq('vendor_id', vendorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? (data.role as PortalRole) : null;
}
