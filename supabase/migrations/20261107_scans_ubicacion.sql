-- Ejecutar una vez en Supabase SQL Editor (se puede volver a ejecutar). No modifica registros existentes:
-- los escaneos anteriores quedan con ubicación e imagen vacías ("Ubicación no disponible" en la app).
--
-- Para que las fotos individuales (tabla scans) aparezcan en el mapa de Mis escaneos:
--   * id: identificador estable (la tabla no tenía llave primaria).
--   * lat, lng, precision_m: GPS del celular al tomar la foto (solo si el usuario ya dio permiso).
--   * imagen_path: la foto analizada, en el bucket "recorridos" bajo escaneos/<uid>/.
--   * huerta_id: se asigna sola si el punto cae dentro del perímetro de una huerta del mismo usuario.
-- La app funciona igual antes y después de ejecutar esto (lee y escribe con respaldo).

alter table public.scans add column if not exists id uuid not null default gen_random_uuid();
alter table public.scans add column if not exists lat double precision;
alter table public.scans add column if not exists lng double precision;
alter table public.scans add column if not exists precision_m double precision;
alter table public.scans add column if not exists imagen_path text;
alter table public.scans add column if not exists huerta_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.scans'::regclass and contype = 'p') then
    alter table public.scans add constraint scans_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'scans_huerta_id_fkey' and conrelid = 'public.scans'::regclass) then
    alter table public.scans add constraint scans_huerta_id_fkey foreign key (huerta_id) references public.huertas(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'scans_lat_lng_check' and conrelid = 'public.scans'::regclass) then
    alter table public.scans add constraint scans_lat_lng_check
      check ((lat is null and lng is null) or (lat between -90 and 90 and lng between -180 and 180));
  end if;
end $$;

create index if not exists scans_user_fecha_idx on public.scans (user_id, created_at desc);

-- Huerta por ubicación: la del mismo usuario cuyo perímetro contiene el punto (PostGIS).
create or replace function public.scans_asignar_huerta()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.huerta_id is null and new.lat is not null and new.lng is not null and new.user_email is not null then
    select h.id into new.huerta_id
    from public.huertas h
    where h.user_email = new.user_email
      and h.poligono is not null
      and st_covers(h.poligono, st_setsrid(st_makepoint(new.lng, new.lat), 4326)::geography)
    order by h.area_m2 asc
    limit 1;
  end if;
  -- Una huerta de otra cuenta nunca se acepta.
  if new.huerta_id is not null and not exists (
    select 1 from public.huertas h where h.id = new.huerta_id and h.user_email = new.user_email
  ) then
    new.huerta_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists scans_asignar_huerta on public.scans;
create trigger scans_asignar_huerta
before insert or update of lat, lng, huerta_id on public.scans
for each row execute function public.scans_asignar_huerta();

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
