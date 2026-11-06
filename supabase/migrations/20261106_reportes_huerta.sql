-- Ejecutar una vez en Supabase SQL Editor. Se puede volver a ejecutar sin efectos (idempotente).
--
-- Relaciona cada reporte satelital con una huerta:
--   * reportes.huerta_id (nullable): los reportes existentes NO se modifican ni se asignan solos.
--   * Llave foránea hacia huertas(id). Si se borra una huerta, sus reportes se conservan con huerta_id = null.
--   * Índice para consultar los reportes de una huerta por fecha.
--   * Un trigger que impide asociar un reporte a una huerta de otra cuenta (al crear y al actualizar).

alter table public.reportes
  add column if not exists huerta_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'reportes_huerta_id_fkey' and conrelid = 'public.reportes'::regclass
  ) then
    alter table public.reportes
      add constraint reportes_huerta_id_fkey
      foreign key (huerta_id) references public.huertas(id) on delete set null;
  end if;
end $$;

create index if not exists reportes_user_huerta_fecha_idx
  on public.reportes (user_email, huerta_id, created_at desc);

-- Validación de propiedad: la huerta del reporte debe ser del mismo usuario (user_email).
-- Se aplica en INSERT y en UPDATE de huerta_id o user_email, venga de la app, de un proceso
-- automático o del SQL Editor. No depende de RLS.
create or replace function public.reportes_validar_huerta()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.huerta_id is not null and not exists (
    select 1 from public.huertas h
    where h.id = new.huerta_id and h.user_email = new.user_email
  ) then
    raise exception 'La huerta % no pertenece a %', new.huerta_id, new.user_email
      using errcode = '23503';
  end if;
  return new;
end;
$$;

drop trigger if exists reportes_validar_huerta on public.reportes;
create trigger reportes_validar_huerta
before insert or update of huerta_id, user_email
on public.reportes
for each row execute function public.reportes_validar_huerta();

-- Si una huerta cambia de dueño, sus reportes no deben quedar ligados a otra cuenta.
create or replace function public.huertas_proteger_reportes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_email is distinct from old.user_email and exists (
    select 1 from public.reportes r where r.huerta_id = old.id and r.user_email = old.user_email
  ) then
    raise exception 'La huerta % tiene reportes de %; reasígnalos antes de cambiar su dueño', old.id, old.user_email;
  end if;
  return new;
end;
$$;

drop trigger if exists huertas_proteger_reportes on public.huertas;
create trigger huertas_proteger_reportes
before update of user_email on public.huertas
for each row execute function public.huertas_proteger_reportes();

comment on column public.reportes.huerta_id is
  'Huerta a la que corresponde el reporte. Debe pertenecer al mismo user_email (trigger reportes_validar_huerta).';

-- NOTA SOBRE RLS
-- La app autentica con Firebase y Supabase todavía no recibe ese JWT (ver 20260911_create_huertas.sql),
-- así que una política RLS basada en auth.jwt() no puede identificar al usuario. La regla de propiedad
-- queda garantizada por el trigger anterior. Si más adelante se habilita RLS en reportes con el JWT de
-- Firebase, agregar a las políticas de INSERT/UPDATE:
--   with check (
--     user_email = auth.jwt() ->> 'email'
--     and (huerta_id is null or exists (
--       select 1 from public.huertas h where h.id = huerta_id and h.user_email = auth.jwt() ->> 'email'))
--   )
