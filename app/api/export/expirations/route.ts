import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { getStore } from '@/lib/arkiv/validations';
import { createClient } from '@/lib/supabase/server';

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(req: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const windowDays = Number(searchParams.get('window') ?? '30');

  const store = getStore();
  const sb = await createClient();
  const [expired, soon, { data: vendors }] = await Promise.all([
    store.listExpired(),
    store.listExpiringSoon(windowDays),
    sb.from('vendors').select('id, name'),
  ]);

  const vendorNames = new Map((vendors ?? []).map(v => [v.id, v.name as string]));
  const rows = [...expired, ...soon];

  const header = [
    'vendor_id',
    'vendor_name',
    'document_id',
    'document_name',
    'document_type',
    'expires_at',
    'status',
    'criticality',
  ].join(',');

  const lines = rows.map(r =>
    [
      r.vendorId,
      vendorNames.get(r.vendorId) ?? '',
      r.documentId,
      r.documentName,
      r.documentType,
      r.expiresAt,
      r.status,
      r.criticality,
    ]
      .map(v => csvEscape(String(v)))
      .join(','),
  );

  const csv = [header, ...lines].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="vencimientos-${windowDays}d.csv"`,
    },
  });
}
