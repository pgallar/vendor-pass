import { DocPageHeader, DocSteps, DocCallout } from '@/components/docs/doc-primitives';

export default function DocsProveedoresPage() {
  return (
    <>
      <DocPageHeader
        title="Proveedores"
        description="Dá de alta y gestioná tus proveedores y su estado de cumplimiento."
      />

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-foreground">Estados de cumplimiento</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          VendorPass calcula automáticamente el estado de cada proveedor a partir de sus documentos. Hay tres
          estados posibles:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Vigente</strong> — todos los documentos están en regla.
          </li>
          <li>
            <strong className="text-foreground">Por vencer</strong> — algún documento vence pronto y requiere
            atención.
          </li>
          <li>
            <strong className="text-foreground">Vencido / Bloqueado</strong> — hay al menos un documento
            vencido.
          </li>
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          El estado del proveedor es el peor estado entre todos sus documentos: si uno está vencido, el
          proveedor queda vencido aunque el resto esté vigente.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-foreground">Dar de alta un proveedor</h2>
        <DocSteps
          steps={[
            {
              title: 'Ir a Proveedores',
              description: 'Entrá a "Proveedores" en el panel y hacé clic en "Nuevo proveedor".',
            },
            {
              title: 'Completar los datos',
              description: 'Ingresá el nombre del proveedor y sus datos de contacto.',
            },
            {
              title: 'Guardar',
              description:
                'Guardá el registro: el proveedor aparece en la lista con su estado inicial según los documentos que tenga cargados.',
            },
          ]}
        />
      </section>

      <DocCallout variant="tip">
        <p>
          El estado se recalcula solo cada vez que agregás, renovás o vence un documento — no hay que
          actualizarlo a mano.
        </p>
      </DocCallout>
    </>
  );
}
