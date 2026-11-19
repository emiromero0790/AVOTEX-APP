-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 20261119 · Zonas editables de la huerta (Mapeo › Editar › Editar zonas)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Cómo ejecutarlo: Supabase → SQL Editor → New query → pegar TODO este archivo → Run.
-- Se puede ejecutar más de una vez. NO es destructiva: solo agrega una columna que acepta NULL;
-- ninguna huerta existente cambia.
--
-- Qué agrega:
--   huertas.zonas_cortes   Líneas que el agricultor dibujó para dividir su huerta en zonas (máximo 4).
--                          Formato: {"version": 1, "cortes": [{"a": {"lat", "lng"}, "b": {"lat", "lng"}}, ...]}
--                          NULL = zonas automáticas (como hasta ahora: la app las calcula del contorno).
--
-- Por qué líneas y no los polígonos de cada zona:
--   Las zonas se recalculan en la app a partir del contorno y de estas líneas, así siempre quedan
--   dentro del perímetro y suman el 100 % de la huerta, aunque después se redibuje el contorno.
--
-- Lo que NO cambia:
--   recorrido_fotos.zona y hallazgos.zona siguen aceptando solo 'A'–'D' (máximo 4 zonas).
--   Las grabaciones ya subidas conservan su copia de las zonas en recorridos.zonas.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

alter table public.huertas add column if not exists zonas_cortes jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'huertas_zonas_cortes_check' and conrelid = 'public.huertas'::regclass) then
    alter table public.huertas add constraint huertas_zonas_cortes_check check (
      zonas_cortes is null or (
        jsonb_typeof(zonas_cortes) = 'object'
        and jsonb_typeof(zonas_cortes -> 'cortes') = 'array'
        and jsonb_array_length(zonas_cortes -> 'cortes') <= 12
      )
    );
  end if;
end $$;

-- Para que la app (PostgREST) vea la columna nueva sin esperar.
notify pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN (opcional)
--   select column_name, data_type, is_nullable from information_schema.columns
--    where table_schema = 'public' and table_name = 'huertas' and column_name = 'zonas_cortes';
--   -- Huertas con zonas editadas:
--   select id, nombre, jsonb_array_length(zonas_cortes -> 'cortes') as lineas from public.huertas
--    where zonas_cortes is not null;
-- ════════════════════════════════════════════════════════════════════════════════════════════════
