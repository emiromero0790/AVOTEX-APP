-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Escaneos individuales HISTÓRICOS → huertas, asignación ALEATORIA (solo datos antiguos o de prueba)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- ⚠ No es evidencia de ubicación: reparte al azar los escaneos SIN huerta entre las huertas del MISMO
--   usuario para poder probar los filtros por huerta. No se usa para capturas nuevas (esas se asignan
--   en la app antes de tomar la foto). La app nunca ejecuta esto por su cuenta.
--
-- Requisito: haber ejecutado supabase/migrations/20261108_scans_huerta.sql (columna scans.huerta_id).
--
-- Cómo usarlo (Supabase → SQL Editor), en este orden:
--   1. Consulta A (vista previa).
--   2. Bloque B tal cual: hace el UPDATE dentro de una transacción, muestra el resultado y termina con
--      ROLLBACK, así que NO guarda nada. Revisa las tablas que imprime.
--   3. Si te convence, vuelve a ejecutar el bloque B cambiando la última línea ROLLBACK por COMMIT.
--      (Ojo: el SQL Editor ejecuta todo lo que pegues; para confirmar, pega el bloque B completo con COMMIT.)
--   4. Consultas C y D para verificar.
--
-- Reglas que cumple:
--   · Solo toca filas con huerta_id IS NULL (no sobrescribe asociaciones existentes).
--   · Cada escaneo va a una huerta del mismo user_email; nunca a la de otra cuenta.
--   · Usuarios sin huertas (o escaneos sin user_email): quedan sin asignar.
--   · No cambia label, score, fruto, created_at ni ninguna otra columna.
--   · Sorteo independiente por escaneo (ver nota técnica en B).
--   · FECHA DE CORTE: con la versión nueva de la app, «No asignar a ninguna huerta» también guarda NULL.
--     Para no sortear esos escaneos, B solo toca los creados ANTES de `antes_de` (pon la fecha en que
--     publicaste la versión con selección de huerta; por defecto, el inicio de 2026-11-09).
-- ════════════════════════════════════════════════════════════════════════════════════════════════


-- ── A. Vista previa: escaneos sin huerta y huertas disponibles por usuario ─────────────────────────
select s.user_email                                   as usuario,
       count(*)                                       as escaneos_sin_huerta,
       count(*) filter (where s.created_at < timestamptz '2026-11-09 00:00:00-06') as anteriores_al_corte,
       (select count(*) from public.huertas h
         where h.user_email = s.user_email)           as huertas_disponibles,
       case when exists (select 1 from public.huertas h where h.user_email = s.user_email)
            then 'se repartirán' else 'se quedan sin huerta (el usuario no tiene huertas)' end as resultado
  from public.scans s
 where s.huerta_id is null
 group by s.user_email
 order by escaneos_sin_huerta desc;


-- ── B. Asignación aleatoria (prueba con ROLLBACK; para guardar, cambia ROLLBACK por COMMIT) ───────
-- Nota técnica: el número aleatorio se calcula en una CTE MATERIALIZED, una vez por cada fila de
-- scans (random() es volátil y está en la lista de columnas de esa CTE). Así no depende de que el
-- planificador reevalúe una subconsulta correlacionada con ORDER BY random(), que puede devolver la
-- misma huerta para todas las filas. scans no tiene llave primaria, así que se une por ctid (estable
-- dentro de la misma sentencia).
begin;

with params as (
  select timestamptz '2026-11-09 00:00:00-06' as antes_de   -- ← fecha de publicación de la versión nueva
),
opciones as materialized (
  select user_email, array_agg(id order by id) as ids
    from public.huertas
   group by user_email
),
sorteo as materialized (
  select s.ctid as fila,
         o.ids[1 + floor(random() * cardinality(o.ids))::int] as huerta_id
    from public.scans s
    join opciones o on o.user_email = s.user_email
   cross join params
   where s.huerta_id is null
     and s.created_at < params.antes_de
)
update public.scans s
   set huerta_id = sorteo.huerta_id
  from sorteo
 where s.ctid = sorteo.fila
   and s.huerta_id is null;

-- Resultado dentro de la transacción (antes de confirmar):
select h.user_email as usuario, h.nombre as huerta, count(s.*) as escaneos
  from public.huertas h
  left join public.scans s on s.huerta_id = h.id
 group by h.user_email, h.id, h.nombre
 order by h.user_email, escaneos desc;

rollback;   -- ← cámbialo por COMMIT para guardar


-- ── C. Verificación: escaneos por huerta ───────────────────────────────────────────────────────────
select h.id         as huerta_id,
       h.nombre     as huerta,
       h.user_email as usuario,
       count(s.*)   as escaneos_asociados
  from public.huertas h
  left join public.scans s on s.huerta_id = h.id
 group by h.id, h.nombre, h.user_email
 order by h.user_email, h.nombre;

-- C2. Control de seguridad: debe devolver 0 filas (ningún escaneo en una huerta de otra cuenta).
select s.user_email, s.huerta_id, h.user_email as dueno_huerta
  from public.scans s
  join public.huertas h on h.id = s.huerta_id
 where h.user_email is distinct from s.user_email;


-- ── D. Pendientes: escaneos que siguen sin huerta ──────────────────────────────────────────────────
select coalesce(s.user_email, '(sin correo)') as usuario, count(*) as escaneos_sin_huerta
  from public.scans s
 where s.huerta_id is null
 group by s.user_email
 order by 2 desc;
