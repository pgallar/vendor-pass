export interface DocumentTypeOption {
  value: string;
  label: string;
}

export const DOCUMENT_TYPES: DocumentTypeOption[] = [
  { value: 'poliza_art', label: 'Póliza ART' },
  { value: 'habilitacion', label: 'Habilitación' },
  { value: 'constancia_fiscal', label: 'Constancia fiscal' },
  { value: 'seguro_rc', label: 'Seguro RC' },
  { value: 'certificado_iso', label: 'Certificado ISO' },
  { value: 'otro', label: 'Otro' },
];

export const DOCUMENT_TYPE_VALUES = DOCUMENT_TYPES.map(t => t.value);
