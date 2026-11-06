-- Ejecutar una vez en Supabase SQL Editor (se puede volver a ejecutar).
--
-- Problema: el flujo "Procesar recorridos" de GitHub Actions está programado cada 10 minutos, pero
-- GitHub retrasa u omite muchas ejecuciones programadas (hubo huecos de más de 14 horas).
-- Solución: en cuanto un recorrido queda en estado "pendiente", Supabase le pide a GitHub que corra
-- el flujo (workflow_dispatch). El horario de GitHub se queda como respaldo, y además pg_cron revisa
-- cada 15 minutos si quedó algo pendiente.
--
-- ANTES de ejecutar este archivo, guarda el token de GitHub en Supabase Vault (ver PASO 1 abajo).
-- El token NUNCA va en este archivo ni en el repositorio.

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 1 (manual, una sola vez): guardar el token en Vault
-- ─────────────────────────────────────────────────────────────────────────
-- En el SQL Editor, ejecuta SOLO esta línea, pegando tu token:
--
--   select vault.create_secret('github_pat_XXXXXXXX', 'github_dispatch_token', 'Token para correr Procesar recorridos');
--
-- Para cambiarlo cuando caduque:
--
--   select vault.update_secret(id, 'github_pat_NUEVO') from vault.secrets where name = 'github_dispatch_token';

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 2: extensiones, función y trigger
-- ─────────────────────────────────────────────────────────────────────────
create extension if not exists pg_net with schema extensions;

-- Pide a GitHub correr el flujo. Nunca hace fallar la operación que la llamó.
create or replace function public.avisar_procesador()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  tok text;
begin
  select decrypted_secret into tok
  from vault.decrypted_secrets
  where name = 'github_dispatch_token'
  limit 1;

  if tok is null then
    raise warning 'avisar_procesador: falta el secreto github_dispatch_token en Vault';
    return;
  end if;

  perform net.http_post(
    url := 'https://api.github.com/repos/emiromero0790/AVOTEX-APP/actions/workflows/procesar-recorridos.yml/dispatches',
    body := jsonb_build_object('ref', 'main'),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || tok,
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'Content-Type', 'application/json',
      'User-Agent', 'avotex-supabase'
    ),
    timeout_milliseconds := 10000
  );
exception when others then
  raise warning 'avisar_procesador: %', sqlerrm;
end;
$$;

-- Solo la base de datos puede llamarla (no la app ni cualquiera con la llave pública).
revoke all on function public.avisar_procesador() from public, anon, authenticated;

create or replace function public.recorridos_avisar_procesador()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado = 'pendiente' and (tg_op = 'INSERT' or old.estado is distinct from 'pendiente') then
    perform public.avisar_procesador();
  end if;
  return new;
end;
$$;

revoke all on function public.recorridos_avisar_procesador() from public, anon, authenticated;

drop trigger if exists recorridos_avisar_procesador on public.recorridos;
create trigger recorridos_avisar_procesador
after insert or update of estado on public.recorridos
for each row execute function public.recorridos_avisar_procesador();

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 3 (respaldo): cada 15 minutos, si quedó algún recorrido pendiente, vuelve a avisar.
-- Requiere la extensión pg_cron (Supabase → Database → Extensions → pg_cron).
-- ─────────────────────────────────────────────────────────────────────────
create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'avotex-procesador-respaldo';
select cron.schedule(
  'avotex-procesador-respaldo',
  '*/15 * * * *',
  $$ select public.avisar_procesador() where exists (select 1 from public.recorridos where estado = 'pendiente') $$
);

-- ─────────────────────────────────────────────────────────────────────────
-- Comprobación
-- ─────────────────────────────────────────────────────────────────────────
-- 1) Avisar a mano y ver la respuesta de GitHub (204 = aceptado):
--      select public.avisar_procesador();
--      select status_code, content, created from net._http_response order by created desc limit 5;
--    401 = token inválido o caducado · 403/404 = el token no tiene permiso de Actions en el repositorio.
-- 2) En GitHub → Actions → "Procesar recorridos" debe aparecer una ejecución "workflow_dispatch".
--
-- Para desactivar todo:
--   drop trigger if exists recorridos_avisar_procesador on public.recorridos;
--   select cron.unschedule('avotex-procesador-respaldo');
