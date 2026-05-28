/**
 * PDF mínimo con texto de compliance para pruebas de extracción IA.
 * Generado como fixture estático (sin dependencias externas).
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

function escapePdfText(text) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildCompliancePdf(lines) {
  const body = lines.map((line, i) => `(${escapePdfText(line)}) Tj 0 -14 Td`).join('\n');
  const stream = `BT /F1 11 Tf 50 750 Td ${body} ET`;
  const streamLen = Buffer.byteLength(stream, 'utf8');

  const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length ${streamLen}>>stream
${stream}
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000059 00000 n 
0000000114 00000 n 
0000000261 00000 n 
0000000${(350 + streamLen).toString().padStart(3, '0')} 00000 n 
trailer<</Size 6/Root 1 0 R>>
startxref
${400 + streamLen}
%%EOF`;

  return Buffer.from(pdf, 'utf8');
}

const lines = [
  'SEGURO DE RESPONSABILIDAD CIVIL',
  'Aseguradora Demo SA',
  'Poliza N: POL-RC-2026-001',
  'Fecha emision: 2026-01-15',
  'Fecha vencimiento: 2026-12-31',
  'Cobertura: USD 1.000.000',
];

const outDir = join(__dir, 'fixtures');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'compliance-test.pdf');
writeFileSync(outPath, buildCompliancePdf(lines));
console.log('Wrote', outPath);
