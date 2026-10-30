-- Ejecutar una vez en Supabase SQL Editor.
-- Modo recorrido: la app toma fotos con GPS durante el recorrido, las sube cuando hay
-- internet y el procesador (GitHub Actions, carpeta processor/) las pasa al modelo.
--
-- Flujo de estados de un recorrido:
--   subiendo   → la app está subiendo fotos
--   pendiente  → todas las fotos subieron; el procesador lo tomará en su siguiente ronda
--   procesando → el procesador lo está analizando
--   listo      → hay resultados (tabla hallazgos) y se envió la notificación
--   error      → falló; se reintenta hasta 3 veces (columna intentos)

create table if not exists public.recorridos (
  id uuid primary key default gen_random_uuid(),
  user_email text not null references public.users(user_email) on update cascade on delete cascade,
  huerta_id uuid references public.huertas(id) on delete set null,
  estado text not null default 'subiendo'
    check (estado in ('subiendo', 'pendiente', 'procesando', 'listo', 'error')),
  iniciado_at timestamp with time zone not null default now(),
  terminado_at timestamp with time zone,
  fotos_total integer not null default 0 check (fotos_total >= 0),
  fotos_analizadas integer not null default 0 check (fotos_analizadas >= 0),
  hallazgos_total integer not null default 0 check (hallazgos_total >= 0),
  -- Ruta GPS para dibujar el recorrido: [{ "lat": .., "lng": .., "t": "ISO-8601" }, ...]
  ruta jsonb not null default '[]'::jsonb check (jsonb_typeof(ruta) = 'array'),
  intentos integer not null default 0,
  error text,
  procesado_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists recorridos_user_idx on public.recorridos (user_email, created_at desc);
create index if not exists recorridos_estado_idx on public.recorridos (estado) where estado in ('pendiente', 'procesando', 'error');

-- Cada foto que la app sube durante un recorrido (se borra del almacenamiento al procesarse).
create table if not exists public.recorrido_fotos (
  id uuid primary key default gen_random_uuid(),
  recorrido_id uuid not null references public.recorridos(id) on delete cascade,
  storage_path text not null,
  tomada_at timestamp with time zone not null,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  precision_m double precision,
  orden integer not null default 0,
  created_at timestamp with time zone not null default now(),
  unique (recorrido_id, storage_path)
);

create index if not exists recorrido_fotos_recorrido_idx on public.recorrido_fotos (recorrido_id, tomada_at);

-- Resultados: un hallazgo agrupa fotos seguidas y cercanas con el mismo diagnóstico.
create table if not exists public.hallazgos (
  id uuid primary key default gen_random_uuid(),
  recorrido_id uuid not null references public.recorridos(id) on delete cascade,
  user_email text not null references public.users(user_email) on update cascade on delete cascade,
  huerta_id uuid references public.huertas(id) on delete set null,
  tomada_at timestamp with time zone not null,
  lat double precision,
  lng double precision,
  fruto text not null,
  estado text not null,
  confianza double precision not null check (confianza between 0 and 1),
  confianza_fruto double precision check (confianza_fruto between 0 and 1),
  fotos_en_grupo integer not null default 1,
  -- Miniatura en el bucket "recorridos" (las fotos originales se borran al procesar).
  miniatura_path text,
  created_at timestamp with time zone not null default now()
);

create index if not exists hallazgos_recorrido_idx on public.hallazgos (recorrido_id, tomada_at);
create index if not exists hallazgos_user_idx on public.hallazgos (user_email, created_at desc);
create index if not exists hallazgos_huerta_idx on public.hallazgos (huerta_id);

-- Tokens de notificaciones push (Expo) de cada dispositivo.
create table if not exists public.push_tokens (
  token text primary key,
  user_email text not null references public.users(user_email) on update cascade on delete cascade,
  plataforma text,
  updated_at timestamp with time zone not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_email);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists recorridos_touch on public.recorridos;
create trigger recorridos_touch before update on public.recorridos
for each row execute function public.touch_updated_at();

-- Bucket privado para las fotos de los recorridos y las miniaturas de hallazgos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recorridos', 'recorridos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Permisos, con el mismo modelo que el resto de la app (Firebase Auth + clave anon):
-- la app sube fotos y lee resultados; el procesador usa la clave service_role.
grant select, insert, update on public.recorridos to anon, authenticated;
grant select, insert on public.recorrido_fotos to anon, authenticated;
grant select on public.hallazgos to anon, authenticated;
grant select, insert, update, delete on public.push_tokens to anon, authenticated;

drop policy if exists "recorridos: subir fotos" on storage.objects;
create policy "recorridos: subir fotos" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'recorridos' and (storage.foldername(name))[1] = 'fotos');

drop policy if exists "recorridos: ver miniaturas" on storage.objects;
create policy "recorridos: ver miniaturas" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'recorridos' and (storage.foldername(name))[1] = 'hallazgos');

comment on table public.recorridos is
  'Recorridos con fotos automáticas y GPS. Los procesa processor/procesar_recorridos.py (GitHub Actions).';

-- IMPORTANTE (igual que en huertas): la app autentica con Firebase y Supabase no recibe
-- ese JWT, así que no se activa RLS. Antes de publicar datos sensibles, configure Firebase
-- como proveedor de autenticación de terceros en Supabase y agregue políticas por
-- user_email = auth.jwt() ->> 'email'.
