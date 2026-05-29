import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/vendor-pass/app-shell';
import { PageHeader } from '@/components/vendor-pass/page-header';
import { ReviewQueue, type ReviewDoc } from '@/components/vendor-pass/review-queue';

export default async function VendorReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/vendors/${id}/reviews`);

  const { data: vendor } = await supabase.from('vendors').select('id, name').eq('id', id).maybeSingle();
  if (!vendor) notFound();

  const { data: docs } = await supabase
    .from('documents')
    .select('id, document_name, document_type, expires_at')
    .eq('vendor_id', id)
    .eq('review_status', 'submitted')
    .order('expires_at', { ascending: true });

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-2xl">
        <PageHeader
          title={`Revisiones · ${vendor.name}`}
          description="Documentos enviados por el proveedor pendientes de tu aprobación."
        />
        <ReviewQueue docs={(docs ?? []) as ReviewDoc[]} />
      </div>
    </AppShell>
  );
}
