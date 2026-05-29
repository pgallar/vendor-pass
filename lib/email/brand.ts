/** Brand tokens for HTML emails (hex for client compatibility). */
export const EMAIL_BRAND = {
  primary: '#4f46e5',
  primaryForeground: '#ffffff',
  background: '#f8fafc',
  foreground: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  card: '#ffffff',
  brandMuted: '#e0e7ff',
  status: {
    vencido: { bg: '#fee2e2', text: '#991b1b' },
    por_vencer: { bg: '#fef3c7', text: '#92400e' },
    vigente: { bg: '#dcfce7', text: '#166534' },
  },
  critical: { bg: '#fee2e2', text: '#991b1b' },
} as const;

export const FONT_STACK = "'Inter', Arial, Helvetica, sans-serif";
export const EMAIL_MAX_WIDTH = 600;
export const BRAND_NAME = 'VendorPass';
export const BRAND_TAGLINE = 'Cumplimiento de proveedores';
