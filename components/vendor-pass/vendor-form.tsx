'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/vendor-pass/button';
import { FormField, Input, Textarea } from '@/components/vendor-pass/form-field';
import { Building2, Mail, User, MapPin } from 'lucide-react';

export interface VendorFormState {
  name: string;
  category: string;
  owner_name: string;
  owner_email: string;
  area: string;
  notes: string;
}

export function VendorForm({
  vendorId,
  initial,
}: {
  vendorId: string;
  initial: VendorFormState;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<VendorFormState>>({});
  const [form, setForm] = useState<VendorFormState>(initial);

  function handleChange(key: keyof VendorFormState, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const newErrors: Partial<VendorFormState> = {};
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
    const res = await fetch(`/api/vendors/${vendorId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.ok) router.push(`/vendors/${vendorId}`);
    else alert('Error actualizando proveedor');
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <section className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">Datos del proveedor</h2>
        <FormField id="name" label="Nombre" required error={errors.name}>
          <Input
            id="name"
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
            value={form.category}
            onChange={e => handleChange('category', e.target.value)}
            className="min-h-11"
          />
        </FormField>
        <FormField id="area" label="Área / sitio">
          <Input
            id="area"
            value={form.area}
            onChange={e => handleChange('area', e.target.value)}
            leftAddon={<MapPin size={15} />}
            className="min-h-11"
          />
        </FormField>
      </section>

      <section className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">Contacto interno</h2>
        <FormField id="owner_name" label="Owner interno">
          <Input
            id="owner_name"
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
            value={form.owner_email}
            onChange={e => handleChange('owner_email', e.target.value)}
            error={!!errors.owner_email}
            leftAddon={<Mail size={15} />}
            className="min-h-11"
          />
        </FormField>
      </section>

      <section className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">Notas</h2>
        <FormField id="notes" label="Notas adicionales">
          <Textarea
            id="notes"
            value={form.notes}
            onChange={e => handleChange('notes', e.target.value)}
            rows={3}
          />
        </FormField>
      </section>

      <div className="flex flex-col gap-2">
        <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full min-h-11">
          {loading ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="w-full min-h-11"
          onClick={() => router.push(`/vendors/${vendorId}`)}
          disabled={loading}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
