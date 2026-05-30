import path from 'node:path';

export interface FixtureSpec {
  /** Ruta absoluta al PDF de prueba. */
  file: string;
  /** Etiqueta legible para el nombre del test. */
  label: string;
  /** Valor de enum DOCUMENT_TYPES esperado de la IA. */
  expectedType: string;
  /** Si true, el tipo se valida estricto; si false, como soft (la IA puede mapear a 'otro'). */
  typeStrict: boolean;
  /** Fecha de vencimiento impresa en el PDF (YYYY-MM-DD). */
  expectedExpires: string;
}

const dir = path.resolve(process.cwd(), 'tests/e2e/fixtures');

export const FIXTURES: FixtureSpec[] = [
  {
    file: path.join(dir, '01-poliza-art-logistica-norte.pdf'),
    label: 'Póliza ART — Logística Norte',
    expectedType: 'poliza_art',
    typeStrict: true,
    expectedExpires: '2025-12-31',
  },
  {
    file: path.join(dir, '02-seguro-rc-constructora-del-sur.pdf'),
    label: 'Seguro RC — Constructora del Sur',
    expectedType: 'seguro_rc',
    typeStrict: true,
    expectedExpires: '2026-01-31',
  },
  {
    file: path.join(dir, '03-certificado-iso9001-metalurgica-pampa.pdf'),
    label: 'ISO 9001 — Metalúrgica Pampa',
    expectedType: 'certificado_iso',
    typeStrict: true,
    expectedExpires: '2026-03-02',
  },
  {
    file: path.join(dir, '04-habilitacion-comercial-servicios-it-rosario.pdf'),
    label: 'Habilitación — Servicios IT Rosario',
    expectedType: 'habilitacion',
    typeStrict: true,
    expectedExpires: '2026-01-14',
  },
  {
    file: path.join(dir, '05-aptitud-medica-laboral-alimentos-del-plata.pdf'),
    label: 'Aptitud Médica — Alimentos del Plata',
    expectedType: 'otro',
    typeStrict: false,
    expectedExpires: '2026-04-14',
  },
];
