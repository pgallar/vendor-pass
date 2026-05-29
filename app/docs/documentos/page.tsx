import { DocPageHeader, DocSteps, DocCallout } from '@/components/docs/doc-primitives';

export default function DocsDocumentosPage() {
  return (
    <>
      <DocPageHeader
        title="Documentos de cumplimiento"
        description="Cargá documentos con fecha de vencimiento y dejá que la IA precargue los datos."
      />

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-foreground">Tipos de documento</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Podés registrar seguros, certificados, habilitaciones u otros tipos de documento. Cada uno lleva una
          fecha de vencimiento que determina si está vigente, por vencer o vencido.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-foreground">Subir un documento</h2>
        <DocSteps
          steps={[
            {
              title: 'Abrir el proveedor',
              description: 'Desde la ficha del proveedor, hacé clic en "Agregar documento".',
            },
            {
              title: 'Subir el archivo',
              description: 'Cargá el PDF o una imagen del documento.',
            },
            {
              title: 'Revisar la extracción',
              description:
                'La IA extrae tipo, fechas y datos clave y precarga el formulario para que los revises.',
            },
            {
              title: 'Confirmar y guardar',
              description: 'Verificá que los datos sean correctos y confirmá para guardar el documento.',
            },
          ]}
        />
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-foreground">Extracción con IA</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Al subir un PDF o una foto, VendorPass usa IA de visión para leer el documento y precargar el tipo,
          las fechas de emisión y vencimiento, el número de póliza y otros campos relevantes. Siempre tenés la
          última palabra: nada se guarda hasta que lo confirmás.
        </p>
      </section>

      <DocCallout variant="info">
        <p>La IA acelera la carga, pero los datos siempre quedan sujetos a tu confirmación.</p>
      </DocCallout>
    </>
  );
}
