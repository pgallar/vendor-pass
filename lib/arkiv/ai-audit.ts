import { arkivWalletClient, jsonToPayload } from './client';
import { PROJECT_SLUG, getStoreSource } from './validations';

export interface AiAuditLog {
  detectedType: string;
  confidence: number;
  model: string;
  summary: string;
}

export async function recordAiExtractionAudit(audit: AiAuditLog) {
  if (getStoreSource() !== 'arkiv') {
    // Modo en memoria, no registrar en Arkiv real.
    console.log('[AI Audit] Extracción finalizada:', audit);
    return;
  }

  const wallet = arkivWalletClient();
  
  const payload = jsonToPayload({
    event: 'ai_extraction',
    ...audit,
    timestamp: new Date().toISOString()
  });

  const attributes = [
    { key: 'project', value: PROJECT_SLUG },
    { key: 'entityType', value: 'ai_audit_log' },
    { key: 'model', value: audit.model },
    { key: 'confidence', value: audit.confidence },
    { key: 'createdAt', value: Date.now() },
  ];

  try {
    await wallet.createEntity({
      payload,
      attributes,
      contentType: 'application/json',
      expiresIn: 30 * 24 * 60 * 60, // 30 días de retención
    });
  } catch (error) {
    console.error('Failed to record AI audit log in Arkiv', error);
  }
}
