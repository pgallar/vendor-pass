'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/vendor-pass/app-shell';
import { PageHeader } from '@/components/vendor-pass/page-header';
import { Button } from '@/components/vendor-pass/button';
import { FormField, Input, Textarea } from '@/components/vendor-pass/form-field';
import { Building2, Mail, User, MapPin } from 'lucide-react';

interface FormState {
  name: string;
  category: string;
  owner_name: string;
  owner_email: string;
  area: string;
  notes: string;
}

export default function NewVendorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [form, setForm] = useState<FormState>({
    name: '', category: '', owner_name: '', owner_email: '', area: '', notes: '',
  });

  function handleChange(key: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const newErrors: Partial<FormState> = {};
    if (!form.name.trim()) newErrors.name = 'El nombre es requerido';
    if (form.owner_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.owner_email)) {
      newErrors.owner_email = 'Formato de correo inválido';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    const res = await fetch('/api/vendors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.ok) {
      const { vendor } = await res.json();
      router.push(`/vendors/${vendor.id}`);
    } else {
      alert('Error creando proveedor');
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Nuevo proveedor"
          description="Registra los datos del proveedor"
          backHref="/vendors"
          backLabel="Volver a proveedores"
          breadcrumbs={[
            { label: 'Proveedores', href: '/vendors' },
            { label: 'Nuevo' },
          ]}
        />

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
          <section aria-labelledby="vendor-heading" className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
            <h2 id="vendor-heading" className="text-sm font-semibold text-foreground">
              Datos del proveedor
            </h2>

            <FormField id="name" label="Nombre" required error={errors.name}>
              <Input
                id="name"
                placeholder="Razón social o nombre comercial"
                value={form.name}
                onChange={e => handleChange('name', e.target.value)}
                error={!!errors.name}
                leftAddon={<Building2 size={15} />}
                className="min-h-11"
              />
            </FormField>

            <FormField id="category" label="Categoría">
              <Input
                id="category"
                placeholder="Ej. Logística, manufactura…"
                value={form.category}
                onChange={e => handleChange('category', e.target.value)}
                className="min-h-11"
              />
            </FormField>

            <FormField id="area" label="Área / sitio">
              <Input
                id="area"
                placeholder="Planta, región, sitio…"
                value={form.area}
                onChange={e => handleChange('area', e.target.value)}
                leftAddon={<MapPin size={15} />}
                className="min-h-11"
              />
            </FormField>
          </section>

          <section aria-labelledby="contact-heading" className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
            <h2 id="contact-heading" className="text-sm font-semibold text-foreground">
              Contacto interno
            </h2>

            <FormField id="owner_name" label="Owner interno">
              <Input
                id="owner_name"
                placeholder="Nombre del responsable"
                value={form.owner_name}
                onChange={e => handleChange('owner_name', e.target.value)}
                leftAddon={<User size={15} />}
                className="min-h-11"
              />
            </FormField>

            <FormField id="owner_email" label="Email del owner" error={errors.owner_email}>
              <Input
                id="owner_email"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="owner@empresa.mx"
                value={form.owner_email}
                onChange={e => handleChange('owner_email', e.target.value)}
                error={!!errors.owner_email}
                leftAddon={<Mail size={15} />}
                className="min-h-11"
              />
            </FormField>
          </section>

          <section aria-labelledby="notes-heading" className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
            <h2 id="notes-heading" className="text-sm font-semibold text-foreground">
              Notas
            </h2>
            <FormField id="notes" label="Notas adicionales">
              <Textarea
                id="notes"
                placeholder="Información relevante sobre el proveedor…"
                value={form.notes}
                onChange={e => handleChange('notes', e.target.value)}
                rows={3}
              />
            </FormField>
          </section>

          <div className="flex flex-col gap-2">
            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full min-h-11">
              {loading ? 'Guardando…' : 'Registrar proveedor'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="w-full min-h-11"
              onClick={() => router.push('/vendors')}
              disabled={loading}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
