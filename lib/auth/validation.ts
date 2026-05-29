export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'El correo es requerido.';
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return 'Ingresá un correo válido.';
  return null;
}

export function validatePassword(pw: string): string | null {
  if (!pw) return 'La contraseña es requerida.';
  if (pw.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
  return null;
}

export function validatePasswordConfirm(pw: string, confirm: string): string | null {
  if (!confirm) return 'Confirmá tu contraseña.';
  if (pw !== confirm) return 'Las contraseñas no coinciden.';
  return null;
}
