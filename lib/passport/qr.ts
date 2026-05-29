export { buildVerifyUrl } from '@/lib/passport/verify-url';

/** Genera el QR de una URL como data URL PNG (solo para el PDF del pasaporte). */
export async function generateQrDataUrl(url: string): Promise<string> {
  const QRCode = (await import('qrcode')).default;
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 240,
  });
}
