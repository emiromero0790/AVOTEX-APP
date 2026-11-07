-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Recorridos HISTÓRICOS sin huerta → huertas del mismo usuario (OPCIONAL, solo datos antiguos/prueba)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Recorridos nuevos: la app fija la huerta antes de empezar y el procesador la copia a los hallazgos.
-- Esto es solo para los antiguos con recorridos.huerta_id IS NULL. No se ejecuta automáticamente.
--
-- Contexto: el procesador anterior asignaba la huerta de CADA hallazgo por el GPS de su foto, así que
-- un recorrido sin huerta puede tener hallazgos que sí tienen una. Antes de sortear nada:
--   R1 muestra cuántos hay; R2 detecta esas inconsistencias.
--   R3 las resuelve sin azar cuando todos los hallazgos coinciden en una sola huerta (esa es la del
--      recorrido). Los casos con hallazgos en VARIAS huertas no se tocan: quedan para revisión manual.
--   R4 sortea al azar SOLO los recorridos sin huerta cuyos hallazgos tampoco tienen huerta, y copia
--      la huerta a sus hallazgos.
--   R3 y R4 terminan con ROLLBACK (no guardan). Para guardar, cambia ROLLBACK por COMMIT.
-- Con 20261108 ejecutada, los triggers también mantienen hallazgos = recorrido; aquí se hace
-- explícito para que el script funcione igual sin ellos.
-- FECHA DE CORTE (R4): con la app nueva, un recorrido con «No asignar a ninguna huerta» también queda
-- en NULL. R4 solo sortea recorridos iniciados ANTES de `antes_de` (fecha de publicación de la versión).
-- Selecciona cada bloque y usa «Run selected» en el SQL Editor.
-- ════════════════════════════════════════════════════════════════════════════════════════════════


-- ── R1. Vista previa por usuario ───────────────────────────────────────────────────────────────────
select r.user_email                                                  as usuario,
       count(*)                                                      as recorridos_sin_huerta,
       count(*) filter (where exists (select 1 from public.hallazgos x
                                       where x.recorrido_id = r.id and x.huerta_id is not null))
                                                                     as con_hallazgos_ya_asignados,
       (select count(*) from public.huertas h where h.user_email = r.user_email) as huertas_disponibles
  from public.recorridos r
 where r.huerta_id is null
 group by r.user_email
 order by 2 desc;


-- ── R2. Inconsistencias a revisar ──────────────────────────────────────────────────────────────────
-- R2a. Recorridos SIN huerta con hallazgos que sí tienen huerta (cuántas huertas distintas).
select r.id as recorrido_id, r.user_email, r.iniciado_at,
       count(distinct x.huerta_id) as huertas_en_hallazgos,
       array_agg(distinct x.huerta_id) as huertas
  from public.recorridos r
  join public.hallazgos x on x.recorrido_id = r.id and x.huerta_id is not null
 where r.huerta_id is null
 group by r.id, r.user_email, r.iniciado_at
 order by huertas_en_hallazgos desc, r.iniciado_at desc;

-- R2b. Recorridos CON huerta cuyos hallazgos tienen otra (o ninguna).
select r.id as recorrido_id, r.huerta_id as huerta_recorrido, x.huerta_id as huerta_hallazgo, count(*) as hallazgos
  from public.recorridos r
  join public.hallazgos x on x.recorrido_id = r.id
 where r.huerta_id is not null
   and x.huerta_id is distinct from r.huerta_id
 group by r.id, r.huerta_id, x.huerta_id;

-- R2c. Huertas de otra cuenta (debe devolver 0 filas).
select 'recorrido' as tipo, r.id, r.user_email, h.user_email as dueno_huerta
  from public.recorridos r join public.huertas h on h.id = r.huerta_id
 where h.user_email is distinct from r.user_email
union all
select 'hallazgo', x.id, x.user_email, h.user_email
  from public.hallazgos x join public.huertas h on h.id = x.huerta_id
 where h.user_email is distinct from x.user_email;


-- ── R3. Resolver sin azar: hallazgos que coinciden en UNA sola huerta (ROLLBACK por defecto) ───────
begin;

with unica as materialized (
  select r.id, min(x.huerta_id::text)::uuid as huerta_id
    from public.recorridos r
    join public.hallazgos x on x.recorrido_id = r.id and x.huerta_id is not null
    join public.huertas h on h.id = x.huerta_id and h.user_email = r.user_email
   where r.huerta_id is null
   group by r.id
  having count(distinct x.huerta_id) = 1
)
update public.recorridos r
   set huerta_id = unica.huerta_id
  from unica
 where r.id = unica.id
   and r.huerta_id is null;

-- Sus hallazgos sin huerta toman la del recorrido (los que ya la tenían, es la misma).
update public.hallazgos x
   set huerta_id = r.huerta_id
  from public.recorridos r
 where x.recorrido_id = r.id
   and r.huerta_id is not null
   and x.huerta_id is null;

rollback;   -- ← COMMIT para guardar


-- R3b (opcional). Alinear hallazgos de recorridos que YA tienen huerta y difieren (R2b): la regla es
-- que el hallazgo hereda la huerta de su recorrido. Revisa R2b antes.
-- begin;
-- update public.hallazgos x set huerta_id = r.huerta_id
--   from public.recorridos r
--  where x.recorrido_id = r.id and r.huerta_id is not null and x.huerta_id is distinct from r.huerta_id;
-- rollback;  -- o commit;


-- ── R4. Sorteo aleatorio por recorrido (solo sin huerta y sin hallazgos asignados) ─────────────────
-- Mismo método que los escaneos: random() por fila en una CTE MATERIALIZED.
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
  select r.id,
         o.ids[1 + floor(random() * cardinality(o.ids))::int] as huerta_id
    from public.recorridos r
    join opciones o on o.user_email = r.user_email
   cross join params
   where r.huerta_id is null
     and coalesce(r.iniciado_at, r.created_at) < params.antes_de
     and not exists (select 1 from public.hallazgos x where x.recorrido_id = r.id and x.huerta_id is not null)
)
update public.recorridos r
   set huerta_id = sorteo.huerta_id
  from sorteo
 where r.id = sorteo.id
   and r.huerta_id is null;

update public.hallazgos x
   set huerta_id = r.huerta_id
  from public.recorridos r
 where x.recorrido_id = r.id
   and r.huerta_id is not null
   and x.huerta_id is null;

-- Resultado dentro de la transacción:
select h.user_email as usuario, h.nombre as huerta,
       count(distinct r.id) as recorridos,
       count(x.*)           as hallazgos
  from public.huertas h
  left join public.recorridos r on r.huerta_id = h.id
  left join public.hallazgos  x on x.recorrido_id = r.id
 group by h.user_email, h.id, h.nombre
 order by h.user_email, recorridos desc;

rollback;   -- ← COMMIT para guardar


-- ── R5. Verificación final ─────────────────────────────────────────────────────────────────────────
-- Recorridos que siguen sin huerta, y hallazgos que no coinciden con su recorrido (debe ser 0).
select count(*) filter (where r.huerta_id is null) as recorridos_sin_huerta,
       (select count(*) from public.hallazgos x join public.recorridos rr on rr.id = x.recorrido_id
         where x.huerta_id is distinct from rr.huerta_id) as hallazgos_inconsistentes
  from public.recorridos r;
