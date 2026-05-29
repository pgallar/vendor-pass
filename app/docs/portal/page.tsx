import { DocPageHeader, DocSteps, DocCallout } from '@/components/docs/doc-primitives';

export default function DocsPortalPage() {
  return (
    <>
      <DocPageHeader
        title="Portal de proveedores"
        description="Dejá que tus proveedores carguen y renueven sus propios documentos."
      />

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-foreground">Cómo funciona</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Invitás a un proveedor por correo electrónico. El contacto accede a un portal de autogestión donde
          puede subir y renovar documentos. Vos revisás lo que envía, lo aprobás y, si corresponde, lo anclás
          en Arkiv.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-foreground">Invitar a un proveedor</h2>
        <DocSteps
          steps={[
            {
              title: 'Abrir el portal',
              description: 'Desde la ficha del proveedor, andá a "Portal" → "Invitar".',
            },
            {
              title: 'Ingresar el correo',
              description: 'Escribí el correo del contacto que va a gestionar los documentos.',
            },
            {
              title: 'Enviar la invitación',
              description: 'El proveedor recibe un enlace para acceder al portal y cargar documentos.',
            },
            {
              title: 'Revisar y aprobar',
              description: 'Revisá lo que envía el proveedor y aprobá los documentos que cumplan los requisitos.',
            },
          ]}
        />
      </section>

      <DocCallout variant="info">
        <p>
          Los documentos enviados por el portal entran como &quot;enviados&quot; y requieren tu aprobación
          antes de contar para el estado de cumplimiento.
        </p>
      </DocCallout>
    </>
  );
}
