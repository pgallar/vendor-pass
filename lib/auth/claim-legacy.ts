/** Reclama proveedores demo huérfanos (user_id IS NULL) para el usuario actual. */
export async function claimLegacyVendors(): Promise<number> {
  const res = await fetch('/api/auth/claim-legacy', { method: 'POST', credentials: 'same-origin' });
  if (!res.ok) return 0;
  const json = (await res.json()) as { claimed?: number };
  return json.claimed ?? 0;
}
