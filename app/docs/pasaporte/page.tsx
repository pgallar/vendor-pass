import { DocPageHeader, DocSteps } from '@/components/docs/doc-primitives';

export default function DocsPasaportePage() {
  return (
    <>
      <DocPageHeader
        title="Pasaporte de cumplimiento"
        description="Compartí un resumen verificable del estado de un proveedor."
      />

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-foreground">Qué incluye</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          El pasaporte es un PDF con el estado actual del proveedor, el listado de sus documentos vigentes y un
          enlace o código QR de verificación pública respaldado por Arkiv.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-foreground">Verificación pública</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Cualquier tercero puede verificar el pasaporte sin tener cuenta en VendorPass, contrastando la huella
          del documento contra el registro en Arkiv Network.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-foreground">Generar y compartir</h2>
        <DocSteps
          steps={[
            {
              title: 'Abrir la pestaña Pasaporte',
              description: 'Desde la ficha del proveedor, entrá a la pestaña "Pasaporte".',
            },
            {
              title: 'Generar el PDF',
              description: 'Hacé clic en generar para crear el pasaporte con los datos actuales.',
            },
            {
              title: 'Compartir',
              description: 'Enviá el enlace o el QR a quien necesite verificar el cumplimiento.',
            },
          ]}
        />
      </section>
    </>
  );
}
