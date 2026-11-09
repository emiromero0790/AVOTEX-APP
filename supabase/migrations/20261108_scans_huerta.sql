-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 20261108 · Escaneos individuales asociados a huertas + integridad de huerta_id
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Cómo ejecutarlo: Supabase → SQL Editor → New query → pegar TODO este archivo → Run.
-- Se puede ejecutar más de una vez (cada paso comprueba si ya existe).
--
-- Qué hace:
--   1. public.scans.huerta_id uuid NULL (solo si falta). Los escaneos existentes quedan con NULL y siguen
--      apareciendo en el historial general. No toca ninguna otra columna ni agrega NOT NULL.
--   2. Llave foránea scans.huerta_id → huertas(id) ON DELETE SET NULL (si se borra la huerta, el escaneo
--      se conserva sin huerta). Si ya existe una llave foránea sobre esa columna, no se duplica.
--   3. Índices para el historial por usuario, huerta y fecha.
--   4. Integridad (triggers), porque la llave foránea sola NO impide usar la huerta de otra cuenta:
--        · scans y recorridos: huerta_id debe ser NULL o una huerta con el MISMO user_email.
--        · hallazgos: huerta_id siempre es la de su recorrido (se copia sola; también el NULL).
--        · si cambia la huerta de un recorrido, sus hallazgos la heredan.
--   5. Quita el trigger scans_asignar_huerta de una versión anterior de 20261107 (asignaba por GPS y
--      contradecía la elección «No asignar a ninguna huerta»).
--
-- No requiere 20261107 (id / lat / lng / imagen de scans): esa migración es opcional e independiente.
-- No usa la columna huertas.poligono (PostGIS); solo ids y user_email.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

-- 1. Columna ─────────────────────────────────────────────────────────────────────────────────────
alter table public.scans add column if not exists huerta_id uuid;

-- 2. Llave foránea (no se duplica si ya existe una sobre scans.huerta_id) ────────────────────────
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.scans'::regclass
      and c.contype = 'f'
      and c.confrelid = 'public.huertas'::regclass
      and a.attname = 'huerta_id'
  ) then
    alter table public.scans
      add constraint scans_huerta_id_fkey
      foreign key (huerta_id) references public.huertas(id) on delete set null;
  end if;
end $$;

-- 3. Índices ─────────────────────────────────────────────────────────────────────────────────────
-- Historial filtrado por usuario + huerta, ordenado por fecha (la app filtra por user_email o user_id).
create index if not exists idx_scans_user_huerta_fecha on public.scans (user_email, huerta_id, created_at desc);
create index if not exists idx_scans_userid_fecha on public.scans (user_id, created_at desc);
-- Para la llave foránea (ON DELETE SET NULL) y los conteos por huerta.
create index if not exists idx_scans_huerta on public.scans (huerta_id) where huerta_id is not null;

-- 4. Integridad de huerta_id ─────────────────────────────────────────────────────────────────────
-- 4a. scans y recorridos: la huerta debe ser del mismo usuario que el registro.
create or replace function public.avx_huerta_del_mismo_usuario()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.huerta_id is not null and not exists (
    select 1 from public.huertas h
    where h.id = new.huerta_id
      and new.user_email is not null
      and h.user_email = new.user_email
  ) then
    raise exception 'La huerta % no pertenece a %', new.huerta_id, coalesce(new.user_email, '(sin correo)')
      using errcode = '23503', hint = 'Usa una huerta del mismo user_email o NULL.';
  end if;
  return new;
end;
$$;

drop trigger if exists scans_huerta_del_usuario on public.scans;
create trigger scans_huerta_del_usuario
  before insert or update of huerta_id, user_email on public.scans
  for each row execute function public.avx_huerta_del_mismo_usuario();

drop trigger if exists recorridos_huerta_del_usuario on public.recorridos;
create trigger recorridos_huerta_del_usuario
  before insert or update of huerta_id, user_email on public.recorridos
  for each row execute function public.avx_huerta_del_mismo_usuario();

-- 4b. hallazgos: heredan SIEMPRE la huerta de su recorrido (y deben ser del mismo usuario).
create or replace function public.avx_hallazgo_hereda_huerta()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  r record;
begin
  select huerta_id, user_email into r from public.recorridos where id = new.recorrido_id;
  if not found then
    return new; -- la llave foránea recorrido_id se encarga
  end if;
  if r.user_email is distinct from new.user_email then
    raise exception 'El hallazgo y su recorrido % son de usuarios distintos', new.recorrido_id using errcode = '23514';
  end if;
  new.huerta_id := r.huerta_id;
  return new;
end;
$$;

drop trigger if exists hallazgos_hereda_huerta on public.hallazgos;
create trigger hallazgos_hereda_huerta
  before insert or update of huerta_id, recorrido_id, user_email on public.hallazgos
  for each row execute function public.avx_hallazgo_hereda_huerta();

-- 4c. Si cambia la huerta de un recorrido, sus hallazgos la siguen.
create or replace function public.avx_recorrido_propaga_huerta()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.hallazgos
     set huerta_id = new.huerta_id
   where recorrido_id = new.id
     and huerta_id is distinct from new.huerta_id;
  return null;
end;
$$;

drop trigger if exists recorridos_propaga_huerta on public.recorridos;
create trigger recorridos_propaga_huerta
  after update of huerta_id on public.recorridos
  for each row
  when (old.huerta_id is distinct from new.huerta_id)
  execute function public.avx_recorrido_propaga_huerta();

-- 5. Trigger antiguo de asignación por GPS (si existe) ───────────────────────────────────────────
drop trigger if exists scans_asignar_huerta on public.scans;
drop function if exists public.scans_asignar_huerta();

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN (opcional: ejecutar después, cada consulta por separado)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Columna y llave foránea:
--   select column_name, data_type, is_nullable from information_schema.columns
--    where table_schema = 'public' and table_name = 'scans' and column_name = 'huerta_id';
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.scans'::regclass and contype = 'f';
-- Triggers instalados:
--   select event_object_table, trigger_name, action_timing, event_manipulation
--     from information_schema.triggers where trigger_name like '%huerta%' order by 1, 2;
-- RLS y políticas reales (para revisar la seguridad):
--   select relname, relrowsecurity from pg_class
--    where relnamespace = 'public'::regnamespace and relname in ('scans','huertas','recorridos','hallazgos','recorrido_fotos');
--   select tablename, policyname, roles, cmd, qual, with_check from pg_policies where schemaname = 'public';
-- Tipo real de huertas.poligono:
--   select format_type(atttypid, atttypmod) from pg_attribute
--    where attrelid = 'public.huertas'::regclass and attname = 'poligono';
-- Prueba de integridad (debe FALLAR con «no pertenece»): cambia los valores por un escaneo tuyo y una
-- huerta de OTRA cuenta, dentro de una transacción:
--   begin; update public.scans set huerta_id = '<huerta-de-otro>' where ctid = (select ctid from public.scans where user_email = '<tu-correo>' limit 1); rollback;
