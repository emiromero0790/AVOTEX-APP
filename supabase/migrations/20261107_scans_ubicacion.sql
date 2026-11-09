-- Ejecutar una vez en Supabase SQL Editor (se puede volver a ejecutar). No modifica registros existentes:
-- los escaneos anteriores quedan con ubicación e imagen vacías ("Ubicación no disponible" en la app).
--
-- Para que las fotos individuales (tabla scans) aparezcan en el mapa de Mis escaneos:
--   * id: identificador estable (la tabla no tenía llave primaria).
--   * lat, lng, precision_m: GPS del celular al tomar la foto (solo si el usuario ya dio permiso).
--   * imagen_path: la foto analizada, en el bucket "recorridos" bajo escaneos/<uid>/.
-- OPCIONAL e independiente de la huerta: la relación scans.huerta_id está en 20261108_scans_huerta.sql.
-- (Antes este archivo también asignaba la huerta por GPS con un trigger; se quitó para no contradecir
--  la elección «No asignar a ninguna huerta» que hace el usuario en la app.)
-- La app funciona igual antes y después de ejecutar esto (lee y escribe con respaldo).

alter table public.scans add column if not exists id uuid not null default gen_random_uuid();
alter table public.scans add column if not exists lat double precision;
alter table public.scans add column if not exists lng double precision;
alter table public.scans add column if not exists precision_m double precision;
alter table public.scans add column if not exists imagen_path text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.scans'::regclass and contype = 'p') then
    alter table public.scans add constraint scans_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'scans_lat_lng_check' and conrelid = 'public.scans'::regclass) then
    alter table public.scans add constraint scans_lat_lng_check
      check ((lat is null and lng is null) or (lat between -90 and 90 and lng between -180 and 180));
  end if;
end $$;

create index if not exists scans_user_fecha_idx on public.scans (user_id, created_at desc);

-- (Sin trigger de huerta: la huerta la decide la app antes de la captura. Si una versión anterior de este
--  archivo ya creó el trigger, 20261108_scans_huerta.sql lo elimina.)

-- Fotos de escaneos individuales: subir y ver dentro de escaneos/ en el bucket privado "recorridos".
drop policy if exists "escaneos: subir fotos" on storage.objects;
create policy "escaneos: subir fotos" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'recorridos' and (storage.foldername(name))[1] = 'escaneos');

drop policy if exists "escaneos: ver fotos" on storage.objects;
create policy "escaneos: ver fotos" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'recorridos' and (storage.foldername(name))[1] = 'escaneos');

-- NOTA SOBRE RLS: igual que el resto de las tablas, la app usa Firebase y Supabase no recibe su JWT, así que
-- RLS no puede distinguir usuarios todavía. La app filtra siempre por user_id/user_email. Para aislar los datos
-- de verdad hay que configurar Firebase como proveedor de terceros en Supabase (Auth → Third-party) y crear
-- políticas con auth.jwt(); está documentado en supabase/migrations/20260911_create_huertas.sql.
