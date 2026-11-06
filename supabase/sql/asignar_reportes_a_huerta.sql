-- Consultas para asociar los reportes que ya existen a una huerta.
-- Ejecutar en Supabase SQL Editor DESPUÉS de la migración 20261106_reportes_huerta.sql.
-- Ninguna de estas consultas se ejecuta sola: cópialas y cambia los parámetros.


-- ─────────────────────────────────────────────────────────────────────────
-- 1) Ver las huertas de un usuario (para copiar el UUID de destino)
-- ─────────────────────────────────────────────────────────────────────────
select id, nombre, round((area_m2 / 10000)::numeric, 2) as hectareas, created_at
from public.huertas
where user_email = 'correo@ejemplo.com'          -- ← correo del usuario
order by created_at;


-- ─────────────────────────────────────────────────────────────────────────
-- 2) Revisar qué reportes siguen sin huerta asignada
-- ─────────────────────────────────────────────────────────────────────────
-- De un usuario:
select id, created_at, ndvi, ndre, msavi, reci, ndmi
from public.reportes
where user_email = 'correo@ejemplo.com'          -- ← correo del usuario
  and huerta_id is null
order by created_at desc;

-- Resumen de todos los usuarios:
select user_email, count(*) as sin_huerta, min(created_at) as primero, max(created_at) as ultimo
from public.reportes
where huerta_id is null
group by user_email
order by sin_huerta desc;


-- ─────────────────────────────────────────────────────────────────────────
-- 3) Asignar a una huerta los reportes SIN huerta de un usuario
-- ─────────────────────────────────────────────────────────────────────────
-- * Valida primero que la huerta pertenezca al mismo usuario; si no, se detiene sin cambiar nada.
-- * Solo toca reportes de ese usuario con huerta_id IS NULL (no reasigna los que ya tienen huerta).
-- * Opcional: limita por fechas descomentando las dos líneas de created_at.
do $$
declare
  p_email  text := 'correo@ejemplo.com';                      -- ← correo del usuario
  p_huerta uuid := '00000000-0000-0000-0000-000000000000';    -- ← UUID de la huerta de destino
  v_nombre text;
  v_total  integer;
begin
  select nombre into v_nombre
  from public.huertas
  where id = p_huerta and user_email = p_email;

  if v_nombre is null then
    raise exception 'La huerta % no existe o no pertenece a %. No se modificó ningún reporte.', p_huerta, p_email;
  end if;

  update public.reportes
  set huerta_id = p_huerta
  where user_email = p_email
    and huerta_id is null
    -- and created_at >= '2026-01-01'
    -- and created_at <  '2026-12-31'
  ;
  get diagnostics v_total = row_count;

  raise notice 'Se asignaron % reportes de % a la huerta "%" (%).', v_total, p_email, v_nombre, p_huerta;
end $$;


-- ─────────────────────────────────────────────────────────────────────────
-- 4) Deshacer (solo si te equivocaste de huerta)
-- ─────────────────────────────────────────────────────────────────────────
-- update public.reportes
-- set huerta_id = null
-- where user_email = 'correo@ejemplo.com'
--   and huerta_id = '00000000-0000-0000-0000-000000000000';
