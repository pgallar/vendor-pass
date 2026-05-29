import { isAllowedMime, MAX_BYTES } from '@/lib/storage/s3';

export type Base64FileInput = {
  content_base64: string;
  mime_type: string;
};

/** Decodifica y valida un archivo en base64 (mismo criterio que upload y extract). */
export function parseBase64File(file: Base64FileInput): Buffer {
  const buffer = Buffer.from(file.content_base64, 'base64');
  if (buffer.length === 0) throw new Error('Archivo vacío o base64 inválido');
  if (buffer.length > MAX_BYTES) throw new Error('Archivo demasiado grande (máx. 10 MB)');
  if (!isAllowedMime(file.mime_type)) {
    throw new Error('Tipo no permitido. Usá application/pdf, image/png o image/jpeg.');
  }
  return buffer;
}
