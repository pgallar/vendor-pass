import { sendEmail } from '@/lib/email/transport';
import {
  renderExpirationDigest,
  type ExpirationAlertItem,
} from '@/lib/email/templates/expiration-digest';
import { documentStatus } from '@/lib/status';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { VendorDocument } from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';

export type NotificationType = 'expiring_30d' | 'expiring_7d' | 'expired';

export type SendExpirationResult = {
  sent: number;
  skipped: number;
  errors: string[];
};

type PendingAlert = {
  documentId: string;
  notificationType: NotificationType;
  recipientEmail: string;
  recipientName: string | null;
  item: ExpirationAlertItem;
};

const MS_PER_DAY = 86_400_000;

export function classifyExpirationAlert(
  doc: VendorDocument,
  now = new Date(),
): NotificationType | null {
  const status = documentStatus(doc, now);
  if (status === 'vencido') return 'expired';
  const expires = new Date(doc.expires_at + 'T00:00:00Z');
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diffDays = Math.floor((expires.getTime() - today.getTime()) / MS_PER_DAY);
  if (diffDays <= 7) return 'expiring_7d';
  if (diffDays <= 30) return 'expiring_30d';
  return null;
}

export async function sendExpirationNotifications(
  now = new Date(),
  supabase?: SupabaseClient,
): Promise<SendExpirationResult> {
  const sb = supabase ?? supabaseAdmin();
  const result: SendExpirationResult = { sent: 0, skipped: 0, errors: [] };

  const [{ data: docs, error: docsErr }, { data: vendors, error: vendorsErr }, { data: sentRows, error: sentErr }] =
    await Promise.all([
      sb.from('documents').select('*'),
      sb.from('vendors').select('id,name,owner_email,owner_name'),
      sb.from('email_notifications').select('document_id,notification_type'),
    ]);

  if (docsErr) throw docsErr;
  if (vendorsErr) throw vendorsErr;
  if (sentErr) throw sentErr;

  const vendorById = new Map((vendors ?? []).map(v => [v.id, v]));
  const sentKeys = new Set(
    (sentRows ?? []).map(r => `${r.document_id}:${r.notification_type}`),
  );

  const pendingByEmail = new Map<string, PendingAlert[]>();

  for (const doc of (docs ?? []) as VendorDocument[]) {
    const vendor = vendorById.get(doc.vendor_id);
    const email = vendor?.owner_email?.trim();
    if (!email) continue;

    const notificationType = classifyExpirationAlert(doc, now);
    if (!notificationType) continue;

    const key = `${doc.id}:${notificationType}`;
    if (sentKeys.has(key)) {
      result.skipped++;
      continue;
    }

    const pending: PendingAlert = {
      documentId: doc.id,
      notificationType,
      recipientEmail: email,
      recipientName: vendor?.owner_name ?? null,
      item: {
        vendorName: vendor?.name ?? 'Proveedor',
        documentName: doc.document_name,
        documentType: doc.document_type,
        expiresAt: doc.expires_at,
        status: documentStatus(doc, now),
        criticality: doc.criticality,
      },
    };

    const group = pendingByEmail.get(email) ?? [];
    group.push(pending);
    pendingByEmail.set(email, group);
  }

  for (const [email, pending] of pendingByEmail) {
    const recipientName = pending[0]?.recipientName ?? null;
    const message = renderExpirationDigest({
      recipientName,
      alerts: pending.map(p => p.item),
    });

    try {
      await sendEmail({
        to: email,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      const rows = pending.map(p => ({
        document_id: p.documentId,
        notification_type: p.notificationType,
        recipient_email: p.recipientEmail,
      }));

      const { error: insertErr } = await sb.from('email_notifications').insert(rows);
      if (insertErr) throw insertErr;

      result.sent++;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : String(err);
      result.errors.push(`${email}: ${msg}`);
    }
  }

  return result;
}
