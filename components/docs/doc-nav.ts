import type { LucideIcon } from 'lucide-react';
import { BookOpen, Users, FileCheck2, Link2, BadgeCheck, UserPlus, BellRing, Plug } from 'lucide-react';

export type DocNavItem = {
  label: string;
  href: string;
  description: string;
  icon: LucideIcon;
};

export const DOC_NAV: DocNavItem[] = [
  { label: 'Introducción', href: '/docs', description: 'Qué es VendorPass y conceptos clave.', icon: BookOpen },
  { label: 'Proveedores', href: '/docs/proveedores', description: 'Alta, gestión y estados de proveedores.', icon: Users },
  { label: 'Documentos', href: '/docs/documentos', description: 'Carga de documentos y extracción con IA.', icon: FileCheck2 },
  { label: 'Anclaje en Arkiv', href: '/docs/anclaje-arkiv', description: 'Inmutabilidad y verificación en blockchain.', icon: Link2 },
  { label: 'Pasaporte', href: '/docs/pasaporte', description: 'Pasaporte de cumplimiento verificable.', icon: BadgeCheck },
  { label: 'Portal de proveedores', href: '/docs/portal', description: 'Autogestión y aprobación.', icon: UserPlus },
  { label: 'Alertas', href: '/docs/alertas', description: 'Notificaciones de vencimiento.', icon: BellRing },
  { label: 'Servidor MCP', href: '/docs/mcp', description: 'Conectá asistentes de IA por MCP.', icon: Plug },
];
