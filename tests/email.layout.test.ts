import { describe, it, expect } from 'vitest';
import {
  buildPlainText,
  renderStatusBadge,
  wrapEmailLayout,
} from '@/lib/email/templates/layout';
import { BRAND_NAME } from '@/lib/email/brand';

describe('wrapEmailLayout', () => {
  it('includes brand header, card body and footer', () => {
    const html = wrapEmailLayout({
      title: 'Título de prueba',
      bodyHtml: '<p>Contenido</p>',
      cta: { label: 'Ir a la app', url: 'https://example.com/action' },
    });

    expect(html).toContain('lang="es"');
    expect(html).toContain(BRAND_NAME);
    expect(html).toContain('Cumplimiento de proveedores');
    expect(html).toContain('Título de prueba');
    expect(html).toContain('Contenido');
    expect(html).toContain('href="https://example.com/action"');
    expect(html).toContain('Ir a la app');
    expect(html).toContain('#4f46e5');
  });

  it('escapes HTML in title and preheader', () => {
    const html = wrapEmailLayout({
      preheader: '<script>alert(1)</script>',
      title: 'A & B <C>',
      bodyHtml: '<p>ok</p>',
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('A &amp; B &lt;C&gt;');
  });
});

describe('renderStatusBadge', () => {
  it('uses semantic colors per status', () => {
    expect(renderStatusBadge('vencido')).toContain('#991b1b');
    expect(renderStatusBadge('por_vencer')).toContain('#92400e');
    expect(renderStatusBadge('vigente')).toContain('#166534');
  });
});

describe('buildPlainText', () => {
  it('assembles greeting, paragraphs, cta and footer', () => {
    const text = buildPlainText({
      greeting: 'Hola Ana,',
      paragraphs: ['Línea 1', '', 'Línea 2'],
      cta: { label: 'Ver', url: 'https://example.com' },
    });

    expect(text).toContain('Hola Ana,');
    expect(text).toContain('Línea 1');
    expect(text).toContain('Ver: https://example.com');
    expect(text).toContain(`— ${BRAND_NAME}`);
  });
});
