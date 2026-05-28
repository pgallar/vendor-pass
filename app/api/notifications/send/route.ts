import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { sendExpirationNotifications } from '@/lib/notifications/expirations';

export async function POST() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  if (process.env.EMAIL_NOTIFICATIONS_ENABLED === 'false') {
    return NextResponse.json({ error: 'Notificaciones por email deshabilitadas' }, { status: 503 });
  }

  try {
    const result = await sendExpirationNotifications(undefined, auth.supabase);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error enviando notificaciones';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
