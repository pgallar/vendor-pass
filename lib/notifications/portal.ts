import { sendEmail } from '@/lib/email/transport';
import {
  renderPortalInvite,
  renderDocumentSubmitted,
  renderDocumentApproved,
  renderDocumentRejected,
  renderDocumentAnchored,
} from '@/lib/email/templates/portal';

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

export async function notifyPortalInvite(to: string, vendorName: string, token: string) {
  await sendEmail({ to, ...renderPortalInvite({ vendorName, token }) });
}

export async function notifyDocumentSubmitted(to: string, vendorName: string, documentName: string, vendorId: string) {
  await sendEmail({ to, ...renderDocumentSubmitted({ vendorName, documentName, vendorId }) });
}

export async function notifyDocumentApproved(to: string, documentName: string, vendorId: string) {
  await sendEmail({ to, ...renderDocumentApproved({ documentName, vendorId }) });
}

export async function notifyDocumentRejected(to: string, documentName: string, reason: string, vendorId: string) {
  await sendEmail({ to, ...renderDocumentRejected({ documentName, reason, vendorId }) });
}

export async function notifyDocumentAnchored(to: string, documentName: string, documentId: string) {
  const verifyUrl = `${appUrl()}/verify/${documentId}`;
  await sendEmail({ to, ...renderDocumentAnchored({ documentName, verifyUrl }) });
}
