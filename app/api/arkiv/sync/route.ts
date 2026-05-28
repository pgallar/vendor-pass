import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { syncDocumentsToArkiv } from '@/lib/arkiv/sync';
import { sendExpirationNotifications } from '@/lib/notifications/expirations';

export async function POST() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  try {
    const syncResult = await syncDocumentsToArkiv({ supabase: auth.supabase });
    let emailResult = { sent: 0, skipped: 0, errors: [] as string[] };
    if (
      syncResult.total > 0 &&
      syncResult.failed === 0 &&
      process.env.EMAIL_NOTIFICATIONS_ENABLED !== 'false'
    ) {
      emailResult = await sendExpirationNotifications(undefined, auth.supabase);
    }

    return NextResponse.json({
      sync: syncResult,
      emails: emailResult,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error en sincronización';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
