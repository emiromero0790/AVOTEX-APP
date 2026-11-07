-- PROPUESTA (no ejecutar sin revisar): relacionar cada hallazgo con TODAS sus fotos.
--
-- Hoy un hallazgo agrupa varias fotos seguidas y cercanas (hallazgos.fotos_en_grupo), pero solo se guarda
-- una miniatura (hallazgos.miniatura_path) y las fotos originales se borran después del análisis. Por eso
-- la galería del Detalle del hallazgo muestra una sola imagen: no existe una relación fiable foto ↔ hallazgo.
--
-- Para mostrar todas las fotos que respaldan un hallazgo haría falta:
--   1) Esta tabla.
--   2) Cambiar processor/procesar_recorridos.py para que, al crear cada hallazgo, guarde una miniatura por
--      foto del grupo (p. ej. hallazgos/<recorrido>/<hallazgo>/<n>.jpg) e inserte una fila aquí.
-- La app ya está preparada para mostrar varias imágenes (contador y visor); solo faltaría leer esta tabla.
-- Costo en Storage: ~30 KB por miniatura adicional.

create table if not exists public.hallazgo_fotos (
  id uuid primary key default gen_random_uuid(),
  hallazgo_id uuid not null references public.hallazgos(id) on delete cascade,
  recorrido_foto_id uuid references public.recorrido_fotos(id) on delete set null,
  miniatura_path text not null,
  tomada_at timestamp with time zone not null,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  orden integer not null default 0,
  created_at timestamp with time zone not null default now(),
  unique (hallazgo_id, orden)
);

create index if not exists hallazgo_fotos_hallazgo_idx on public.hallazgo_fotos (hallazgo_id, orden);

grant select on public.hallazgo_fotos to anon, authenticated;
-- Las miniaturas viven bajo hallazgos/, que ya tiene la política de lectura "recorridos: ver miniaturas".
