insert into public.vendors (id, name, category, owner_name, owner_email, area) values
  ('11111111-1111-1111-1111-111111111111', 'Constructora Sur S.A.', 'Obras', 'Ana Pérez', 'ana@aper.com', 'Planta Norte'),
  ('22222222-2222-2222-2222-222222222222', 'Seguridad Total', 'Servicios', 'Luis Gómez', 'luis@aper.com', 'Corporativo'),
  ('33333333-3333-3333-3333-333333333333', 'Logística Andina', 'Transporte', 'María Ruiz', 'maria@aper.com', 'Planta Sur');

insert into public.documents (vendor_id, document_type, document_name, issued_at, expires_at, criticality, notes) values
  ('11111111-1111-1111-1111-111111111111', 'poliza_art', 'Póliza ART 2026', '2025-06-01', '2026-06-15', 'critical', 'Renovación anual'),
  ('11111111-1111-1111-1111-111111111111', 'habilitacion', 'Habilitación municipal', '2024-01-10', '2027-01-10', 'critical', null),
  ('22222222-2222-2222-2222-222222222222', 'certif_seguridad', 'Cert. seguridad operativa', '2024-05-01', '2026-05-01', 'critical', 'VENCIDA'),
  ('22222222-2222-2222-2222-222222222222', 'contrato', 'Contrato marco', '2024-01-01', '2027-01-01', 'normal', null),
  ('33333333-3333-3333-3333-333333333333', 'seguro_flota', 'Seguro flota 2026', '2025-08-01', '2026-08-01', 'critical', null);
