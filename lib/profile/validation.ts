export const AVATAR_ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg']);
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export interface PasswordChangeInput {
  current: string;
  next: string;
  confirm: string;
}

/** Devuelve un mensaje de error o null si el cambio es válido. */
export function validatePasswordChange(input: PasswordChangeInput): string | null {
  if (!input.current) return 'Ingresá tu contraseña actual.';
  if (input.next.length < 6) return 'La nueva contraseña debe tener al menos 6 caracteres.';
  if (input.next !== input.confirm) return 'Las contraseñas no coinciden.';
  if (input.next === input.current) return 'La nueva contraseña debe ser distinta de la actual.';
  return null;
}

export interface ProfileFieldsInput {
  full_name: string | null;
  phone: string | null;
  organization: string | null;
}

/** Devuelve un mapa de errores por campo (vacío = válido). */
export function validateProfileFields(
  input: ProfileFieldsInput,
): Partial<Record<keyof ProfileFieldsInput, string>> {
  const errors: Partial<Record<keyof ProfileFieldsInput, string>> = {};
  if (input.full_name && input.full_name.length > 80) errors.full_name = 'Máximo 80 caracteres.';
  if (input.organization && input.organization.length > 120) errors.organization = 'Máximo 120 caracteres.';
  if (input.phone && !/^[+\d\s()-]{6,30}$/.test(input.phone)) errors.phone = 'Teléfono inválido.';
  return errors;
}

/** Devuelve un mensaje de error o null si el archivo es un avatar válido. */
export function validateAvatarFile(file: { type: string; size: number }): string | null {
  if (!AVATAR_ALLOWED_TYPES.has(file.type)) return 'Formato no permitido. Usá PNG o JPG.';
  if (file.size > AVATAR_MAX_BYTES) return 'La imagen supera los 5 MB.';
  return null;
}

/** Iniciales para el avatar de respaldo: del nombre, o del usuario del correo. */
export function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name && name.trim()) || (email ? email.split('@')[0] : '');
  if (!source) return '?';
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}
