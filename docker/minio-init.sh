#!/bin/sh
set -e

MINIO_HOST="${MINIO_HOST:-minio}"
MINIO_PORT="${MINIO_PORT:-9000}"
BUCKET="${S3_BUCKET:-vendor-pass-evidence}"

echo "Esperando MinIO en ${MINIO_HOST}:${MINIO_PORT}..."
until mc alias set local "http://${MINIO_HOST}:${MINIO_PORT}" "${S3_ACCESS_KEY:-minioadmin}" "${S3_SECRET_KEY:-minioadmin}" 2>/dev/null; do
  sleep 2
done

mc mb --ignore-existing "local/${BUCKET}"
mc anonymous set download "local/${BUCKET}"
echo "Bucket ${BUCKET} listo (lectura pública)"
