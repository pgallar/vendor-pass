import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requirePortalMember } from '@/lib/portal/membership';
import { Button } from '@/components/vendor-pass/button';
import type { ReviewStatus } from '@/lib/types';

const REVIEW_LABEL: Record<ReviewStatus, string> = {
  portal_draft: 'Borrador',
  submitted: 'En revisión',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  anchored: 'Anclado',
};

export default async function PortalVendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/portal/vendors/${id}`);

  const role = await requirePortalMember(supabase, user.id, id);
  if (!role) notFound();

  const { data: vendor } = await supabase.from('vendors').select('id, name').eq('id', id).maybeSingle();
  if (!vendor) notFound();

  const { data: docs } = await supabase
    .from('documents')
    .select('id, document_name, document_type, expires_at, review_status, rejection_reason')
    .eq('vendor_id', id)
    .order('expires_at', { ascending: true });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-foreground">{vendor.name}</h1>
        {role === 'uploader' && (
          <Button asChild variant="primary" size="sm">
            <Link href={`/portal/vendors/${id}/documents/new`}>Subir documento</Link>
          </Button>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {(docs ?? []).map(d => (
          <li key={d.id} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{d.document_name}</p>
              <span className="text-xs font-medium text-muted-foreground">{REVIEW_LABEL[d.review_status as ReviewStatus]}</span>
            </div>
            <p className="text-xs text-muted-foreground">{d.document_type} · vence {d.expires_at}</p>
            {d.review_status === 'rejected' && d.rejection_reason && (
              <p className="text-xs text-destructive">Motivo de rechazo: {d.rejection_reason}</p>
            )}
          </li>
        ))}
        {(docs ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No hay documentos cargados todavía.</p>
        )}
      </ul>
    </div>
  );
}
