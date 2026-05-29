export type EmailConfig = {
  enabled: boolean;
  host: string;
  port: number;
  from: string;
  fromName: string;
  user?: string;
  pass?: string;
};

export function getEmailConfig(): EmailConfig {
  return {
    enabled: process.env.EMAIL_NOTIFICATIONS_ENABLED !== 'false',
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number(process.env.SMTP_PORT ?? 1025),
    from: process.env.SMTP_FROM ?? 'noreply@vendorpass.local',
    fromName: process.env.SMTP_FROM_NAME ?? 'VendorPass',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  };
}
