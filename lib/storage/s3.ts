import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
]);

function s3Client() {
  const endpoint = process.env.S3_ENDPOINT;
  if (!endpoint) {
    throw new Error('S3_ENDPOINT is not configured');
  }
  return new S3Client({
    region: process.env.S3_REGION ?? 'us-east-1',
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? 'minioadmin',
      secretAccessKey: process.env.S3_SECRET_KEY ?? 'minioadmin',
    },
  });
}

function publicUrl(bucket: string, key: string): string {
  const base = (process.env.S3_PUBLIC_URL ?? process.env.S3_ENDPOINT ?? '').replace(/\/$/, '');
  return `${base}/${bucket}/${key}`;
}

export async function uploadEvidence(
  buffer: Buffer,
  mime: string,
  key: string,
): Promise<{ url: string }> {
  const bucket = process.env.S3_BUCKET ?? 'vendor-pass-evidence';
  const client = s3Client();
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: mime,
  }));
  return { url: publicUrl(bucket, key) };
}

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_TYPES.has(mime);
}

export { MAX_BYTES };
