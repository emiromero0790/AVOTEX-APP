-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 20261117 · Grabaciones (video → fotos) asignadas por ZONA de la huerta
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Cómo ejecutarlo: Supabase → SQL Editor → New query → pegar TODO este archivo → Run.
-- Se puede ejecutar más de una vez. NO es destructiva: solo agrega columnas que aceptan NULL o
-- tienen valor por defecto; los recorridos, fotos y hallazgos existentes no cambian.
--
-- Por qué columnas y no una tabla nueva:
--   Una grabación es un recorrido SIN GPS. Reutiliza todo lo que ya existe: Storage, la subida que
--   continúa si se corta, el procesador (GitHub Actions), los hallazgos, las miniaturas, las
--   notificaciones y la pantalla Mis escaneos. Lo único nuevo es saber de qué zona viene cada foto.
--
-- Qué agrega:
--   recorridos.tipo        'recorrido' (GPS, como siempre) | 'grabacion' (video subido, sin GPS).
--   recorridos.zonas       Copia de las zonas A–D de la huerta EN EL MOMENTO de subir la grabación
--                          ([{id, color, ring:[{lat,lng}], label:{lat,lng}, share}]). Así, si la huerta
--                          se vuelve a dibujar, la grabación sigue mostrando las zonas que el agricultor
--                          usó al clasificar sus fotos.
--   recorrido_fotos.zona   Zona que el agricultor eligió para cada foto (A–D) o NULL.
--   hallazgos.zona         Zona del hallazgo (la de su foto). El procesador nunca une fotos de
--                          zonas distintas en un mismo hallazgo.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

alter table public.recorridos      add column if not exists tipo  text not null default 'recorrido';
alter table public.recorridos      add column if not exists zonas jsonb;
alter table public.recorrido_fotos add column if not exists zona  text;
alter table public.hallazgos       add column if not exists zona  text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recorridos_tipo_check' and conrelid = 'public.recorridos'::regclass) then
    alter table public.recorridos add constraint recorridos_tipo_check check (tipo in ('recorrido', 'grabacion'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'recorridos_zonas_check' and conrelid = 'public.recorridos'::regclass) then
    alter table public.recorridos add constraint recorridos_zonas_check check (zonas is null or jsonb_typeof(zonas) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'recorrido_fotos_zona_check' and conrelid = 'public.recorrido_fotos'::regclass) then
    alter table public.recorrido_fotos add constraint recorrido_fotos_zona_check check (zona is null or zona in ('A', 'B', 'C', 'D'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'hallazgos_zona_check' and conrelid = 'public.hallazgos'::regclass) then
    alter table public.hallazgos add constraint hallazgos_zona_check check (zona is null or zona in ('A', 'B', 'C', 'D'));
  end if;
end $$;

-- Conteos por zona en Mis escaneos y en el panel de administración.
create index if not exists idx_hallazgos_recorrido_zona on public.hallazgos (recorrido_id, zona) where zona is not null;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN (opcional)
--   select column_name, data_type, is_nullable, column_default from information_schema.columns
--    where table_schema = 'public' and column_name in ('tipo', 'zonas', 'zona')
--      and table_name in ('recorridos', 'recorrido_fotos', 'hallazgos') order by table_name;
--   -- Hallazgos de grabaciones por zona:
--   select r.id, h.zona, count(*) from public.hallazgos h join public.recorridos r on r.id = h.recorrido_id
--    where r.tipo = 'grabacion' group by 1, 2 order by 1, 2;
-- ════════════════════════════════════════════════════════════════════════════════════════════════
