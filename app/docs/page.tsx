import { DocPageHeader, DocCard } from '@/components/docs/doc-primitives';
import { DOC_NAV } from '@/components/docs/doc-nav';

export default function DocsIndexPage() {
  const sections = DOC_NAV.filter(i => i.href !== '/docs');
  return (
    <>
      <DocPageHeader
        title="Documentación de VendorPass"
        description="Aprendé a gestionar el cumplimiento de tus proveedores con respaldo verificable en blockchain."
      />
      <p className="text-sm text-muted-foreground">
        VendorPass centraliza los documentos de cumplimiento de tus proveedores (seguros, certificados,
        habilitaciones), calcula su estado de vigencia automáticamente y los ancla en Arkiv Network para
        que cualquiera pueda verificar su autenticidad e inmutabilidad.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sections.map(s => (
          <DocCard key={s.href} icon={s.icon} title={s.label} description={s.description} href={s.href} />
        ))}
      </div>
    </>
  );
}
