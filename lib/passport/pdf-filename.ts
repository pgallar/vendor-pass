/** Nombre de archivo: passport-{proveedor}.pdf */
export function passportPdfFilename(vendorName: string): string {
  const slug = vendorName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  return `passport-${slug || 'proveedor'}.pdf`;
}
