import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listMemberVendors } from '@/lib/portal/membership';

export default async function PortalHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/portal');

  const vendors = await listMemberVendors(supabase, user.id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-foreground">Tus proveedores</h1>
      {vendors.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Todavía no fuiste asociado a ningún proveedor. Si recibiste una invitación, abrí su enlace.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {vendors.map(v => (
          <li key={v.vendor_id}>
            <Link
              href={`/portal/vendors/${v.vendor_id}`}
              className="block bg-card border border-border rounded-xl p-4 hover:border-primary"
            >
              <p className="text-sm font-medium text-foreground">{v.vendor.name}</p>
              <p className="text-xs text-muted-foreground">{v.vendor.category ?? 'Proveedor'} · rol: {v.role}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
