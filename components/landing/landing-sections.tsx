import Link from 'next/link';
import {
  ShieldCheck,
  FileCheck2,
  Link2,
  Users,
  BellRing,
  History,
  Sparkles,
  AlertTriangle,
  FileX,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/vendor-pass/button';

const FEATURES = [
  {
    icon: FileCheck2,
    title: 'Pasaporte de cumplimiento',
    description: 'PDF verificable con QR y hash anclado para compartir con auditores o clientes.',
  },
  {
    icon: Link2,
    title: 'Anclaje en Arkiv',
    description: 'Cada documento queda inmutable y auditable en blockchain.',
  },
  {
    icon: Users,
    title: 'Portal de proveedores',
    description: 'Autogestión para que el proveedor suba y renueve documentos sin fricción.',
  },
  {
    icon: BellRing,
    title: 'Alertas de vencimiento',
    description: 'Notificaciones automáticas antes de que un certificado o póliza venza.',
  },
  {
    icon: History,
    title: 'Historial inmutable',
    description: 'Línea de tiempo de eventos de cada documento, imposible de alterar.',
  },
  {
    icon: Sparkles,
    title: 'IA de extracción',
    description: 'Subís un PDF y la IA extrae tipo, fechas y datos para precargar el formulario.',
  },
] as const;

const PAIN_POINTS = [
  {
    pain: 'Documentos vencidos sin aviso',
    painDetail: 'Descubrís el problema cuando ya es tarde para operar.',
    solution: 'Alertas proactivas y dashboard de vencimientos',
    solutionDetail: 'VendorPass te avisa antes y centraliza el estado de cada proveedor.',
    icon: AlertTriangle,
  },
  {
    pain: 'Certificados falsificables',
    painDetail: 'Un PDF editado puede pasar una auditoría superficial.',
    solution: 'Anclaje criptográfico en Arkiv',
    solutionDetail: 'Cada documento queda con prueba verificable de existencia e integridad.',
    icon: FileX,
  },
  {
    pain: 'Auditorías manuales lentas',
    painDetail: 'Emails, carpetas compartidas y hojas de cálculo desactualizadas.',
    solution: 'Pasaporte verificable en un link',
    solutionDetail: 'Compartís un pasaporte con QR; el auditor valida sin depender de tu palabra.',
    icon: Clock,
  },
] as const;

const STEPS = [
  { n: 1, title: 'Cargás proveedores y documentos', desc: 'Seguros, certificados, habilitaciones en un solo lugar.' },
  { n: 2, title: 'La IA extrae y precarga los datos', desc: 'Menos carga manual; más precisión en fechas y tipos.' },
  { n: 3, title: 'Anclás el documento en Arkiv', desc: 'Registro inmutable en blockchain de Arkiv Network.' },
  { n: 4, title: 'Compartís el pasaporte verificable', desc: 'Cualquiera puede validar vigencia e integridad sin acceso a tu cuenta.' },
] as const;

export function LandingSections() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-20 text-center">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
          <ShieldCheck size={16} className="text-primary" aria-hidden="true" />
          Cumplimiento documental con respaldo blockchain
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          El cumplimiento de tus proveedores, verificable en blockchain
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          VendorPass centraliza los documentos de tus proveedores — seguros, certificados,
          habilitaciones — los ancla en Arkiv Network y genera un pasaporte de cumplimiento que
          cualquiera puede verificar.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button variant="primary" size="lg" asChild>
            <Link href="/register">Crear cuenta gratis</Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/login">Acceder</Link>
          </Button>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Anclaje inmutable en Arkiv · Pasaporte PDF verificable · Auditable por terceros
        </p>
      </section>

      {/* Problema → Solución */}
      <section className="border-y border-border bg-card py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold text-foreground sm:text-3xl">
            De dolores operativos a cumplimiento demostrable
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            Tres fricciones habituales y cómo VendorPass las resuelve con proceso y prueba
            criptográfica.
          </p>
          <ul className="mt-12 grid gap-6 md:grid-cols-3">
            {PAIN_POINTS.map(({ pain, painDetail, solution, solutionDetail, icon: Icon }) => (
              <li
                key={pain}
                className="flex flex-col rounded-2xl border border-border bg-background p-6"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                  <Icon size={20} className="text-destructive" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-foreground">{pain}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{painDetail}</p>
                <div className="my-4 h-px bg-border" />
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{solution}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{solutionDetail}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20 scroll-mt-20">
        <h2 className="text-center text-2xl font-bold text-foreground sm:text-3xl">
          Todo lo que necesitás para gestionar proveedores
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          Desde la carga hasta la verificación pública, en una plataforma pensada para equipos de
          compras y compliance.
        </p>
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <li
              key={title}
              className="rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <Icon size={22} className="text-primary" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Cómo funciona */}
      <section
        id="como-funciona"
        className="border-t border-border bg-secondary/30 py-20 scroll-mt-20"
      >
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold text-foreground sm:text-3xl">
            Cómo funciona
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Cuatro pasos desde el PDF hasta el pasaporte que podés compartir con confianza.
          </p>
          <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ n, title, desc }) => (
              <li key={n} className="relative flex flex-col items-center text-center">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground"
                  aria-hidden="true"
                >
                  {n}
                </span>
                <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Diferencial Arkiv */}
      <section id="arkiv" className="mx-auto max-w-6xl px-4 py-20 scroll-mt-20">
        <div className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background p-8 sm:p-12">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                Diferencial Arkiv
              </p>
              <h2 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
                Verificable por terceros, sin confiar solo en VendorPass
              </h2>
              <p className="mt-4 text-muted-foreground">
                El anclaje en Arkiv Network deja una prueba criptográfica de que el documento
                existió en una fecha y no fue alterado después. Auditores, clientes o reguladores
                pueden validar vigencia e integridad sin acceso a tu cuenta ni a nuestra base de
                datos como única fuente de verdad.
              </p>
            </div>
            <div className="flex h-32 w-full max-w-sm shrink-0 items-center justify-center rounded-2xl border border-border bg-card lg:h-40">
              <div className="flex flex-col items-center gap-2 text-center">
                <Link2 size={40} className="text-primary" aria-hidden="true" />
                <span className="text-xs font-medium text-muted-foreground">
                  Hash anclado · Timeline inmutable
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-6xl px-4 pb-24 text-center">
        <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
          Empezá a gestionar el cumplimiento con respaldo blockchain
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
          Creá tu cuenta gratis y centralizá el cumplimiento de tus proveedores con pasaportes
          verificables desde el primer documento.
        </p>
        <div className="mt-8">
          <Button variant="primary" size="lg" asChild>
            <Link href="/register">Crear cuenta gratis</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
