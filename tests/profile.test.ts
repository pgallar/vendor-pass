import { describe, it, expect } from 'vitest';
import {
  validatePasswordChange,
  validateProfileFields,
  validateAvatarFile,
  getInitials,
  AVATAR_MAX_BYTES,
} from '@/lib/profile/validation';

describe('validatePasswordChange', () => {
  it('acepta un cambio válido', () => {
    expect(validatePasswordChange({ current: 'viejo123', next: 'nuevo123', confirm: 'nuevo123' })).toBeNull();
  });
  it('exige la contraseña actual', () => {
    expect(validatePasswordChange({ current: '', next: 'nuevo123', confirm: 'nuevo123' })).toMatch(/actual/i);
  });
  it('exige mínimo 6 caracteres', () => {
    expect(validatePasswordChange({ current: 'viejo123', next: '123', confirm: '123' })).toMatch(/6/);
  });
  it('exige que coincidan', () => {
    expect(validatePasswordChange({ current: 'viejo123', next: 'nuevo123', confirm: 'otra123' })).toMatch(/coinciden/i);
  });
  it('exige que sea distinta de la actual', () => {
    expect(validatePasswordChange({ current: 'igual123', next: 'igual123', confirm: 'igual123' })).toMatch(/distinta/i);
  });
});

describe('validateProfileFields', () => {
  it('no devuelve errores con datos válidos', () => {
    expect(validateProfileFields({ full_name: 'Ana Pérez', phone: '+54 11 1234-5678', organization: 'ACME' })).toEqual({});
  });
  it('acepta campos vacíos (todos opcionales)', () => {
    expect(validateProfileFields({ full_name: null, phone: null, organization: null })).toEqual({});
  });
  it('rechaza nombre demasiado largo', () => {
    expect(validateProfileFields({ full_name: 'x'.repeat(81), phone: null, organization: null }).full_name).toBeDefined();
  });
  it('rechaza teléfono con caracteres inválidos', () => {
    expect(validateProfileFields({ full_name: null, phone: 'abc!!', organization: null }).phone).toBeDefined();
  });
});

describe('validateAvatarFile', () => {
  it('acepta PNG dentro del límite', () => {
    expect(validateAvatarFile({ type: 'image/png', size: 1000 })).toBeNull();
  });
  it('rechaza un PDF', () => {
    expect(validateAvatarFile({ type: 'application/pdf', size: 1000 })).toMatch(/PNG|JPG/i);
  });
  it('rechaza imágenes que superan el límite', () => {
    expect(validateAvatarFile({ type: 'image/png', size: AVATAR_MAX_BYTES + 1 })).toMatch(/MB/);
  });
});

describe('getInitials', () => {
  it('toma las iniciales de nombre y apellido', () => {
    expect(getInitials('Ana Pérez', 'ana@acme.com')).toBe('AP');
  });
  it('usa dos letras de un nombre simple', () => {
    expect(getInitials('Ana', null)).toBe('AN');
  });
  it('cae al correo si no hay nombre', () => {
    expect(getInitials(null, 'pablo@acme.com')).toBe('PA');
  });
  it('devuelve "?" si no hay datos', () => {
    expect(getInitials(null, null)).toBe('?');
  });
});
