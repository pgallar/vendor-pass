import { DocPageHeader, DocSteps, DocCallout } from '@/components/docs/doc-primitives';

export default function DocsAnclajeArkivPage() {
  return (
    <>
      <DocPageHeader
        title="Anclaje en Arkiv"
        description="Hacé que tus documentos sean inmutables y verificables en blockchain."
      />

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-foreground">¿Qué es anclar?</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Al anclar un documento, VendorPass registra su huella (hash) y metadatos en Arkiv Network. Queda una
          prueba criptográfica de su existencia y contenido en un momento dado, imposible de alterar después.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-foreground">Ciclo de vida</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Un documento pasa por tres etapas: <strong className="text-foreground">borrador</strong> (en
          preparación), <strong className="text-foreground">pendiente de anclaje</strong> (listo para
          registrar) y <strong className="text-foreground">anclado</strong> (inmutable en blockchain). Una vez
          anclado, los campos clave del documento no se pueden modificar.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-foreground">Anclar un documento</h2>
        <DocSteps
          steps={[
            {
              title: 'Verificar el archivo',
              description: 'El documento debe tener su archivo cargado y la huella calculada.',
            },
            {
              title: 'Aprobar y anclar',
              description: 'Desde la ficha del documento, aprobá y ejecutá el anclaje.',
            },
            {
              title: 'Confirmar en Arkiv',
              description:
                'VendorPass registra la entidad en Arkiv Network y guarda la referencia para verificación futura.',
            },
          ]}
        />
      </section>

      <DocCallout variant="warning">
        <p>
          El anclaje es irreversible: un documento anclado no puede editarse. Para cambios, se genera una nueva
          versión que reemplaza a la anterior.
        </p>
      </DocCallout>
    </>
  );
}
