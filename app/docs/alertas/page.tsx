import { DocPageHeader, DocCallout } from '@/components/docs/doc-primitives';

export default function DocsAlertasPage() {
  return (
    <>
      <DocPageHeader
        title="Alertas y vencimientos"
        description="Enterate antes de que un documento venza."
      />

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-foreground">Vencimientos</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          VendorPass marca los documentos como &quot;Por vencer&quot; según su fecha de vencimiento y los
          agrupa en la sección Vencimientos del panel para que puedas actuar a tiempo.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-foreground">Notificaciones por correo</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Se envían avisos automáticos por correo cuando un documento está por vencer o ya venció, para que no
          se te pase ningún plazo crítico.
        </p>
      </section>

      <DocCallout variant="tip">
        <p>Revisá la sección Vencimientos del panel para ver de un vistazo todo lo que requiere atención.</p>
      </DocCallout>
    </>
  );
}
