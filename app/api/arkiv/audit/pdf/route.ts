import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { buildAuditReport } from '@/lib/api-keys/data';
import { renderAuditPdf } from '@/lib/arkiv/render-audit-pdf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  try {
    const report = await buildAuditReport(auth.supabase, auth.user.id);
    const pdfBuffer = await renderAuditPdf(report);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="reporte-auditoria-arkiv.pdf"',
      },
    });
  } catch (err) {
    console.error('Error generando PDF de auditoría:', err);
    return NextResponse.json(
      { error: 'Error interno generando el reporte de auditoría' },
      { status: 500 }
    );
  }
}
