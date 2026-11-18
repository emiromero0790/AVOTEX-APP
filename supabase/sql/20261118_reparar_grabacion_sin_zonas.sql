-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 20261118 · Reparar grabaciones que se guardaron como «recorrido» y sin zonas
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Causa (corregida en services/recorridos.ts): si la base no tiene la columna opcional «fuente»
-- (migración 20261105), la app reintentaba el guardado SIN tipo ni zonas. Las fotos sí conservaron su
-- zona (recorrido_fotos.zona), pero el recorrido quedó tipo 'recorrido', sin copia de zonas, y el
-- procesador no pasó la zona a los hallazgos.
--
-- Qué hace (solo toca recorridos SIN ruta GPS cuyas fotos TODAS tienen zona = grabaciones):
--   1. tipo = 'grabacion'.
--   2. Copia de zonas de «La nueva brecha 3» (calculada con el mismo algoritmo que la app, idéntica a las
--      que viste al asignar las fotos) para la grabación 0e122fdb…
--   3. hallazgos.zona = zona de su foto (misma hora tomada_at; el procesador guarda la hora de la foto).
-- Se puede ejecutar más de una vez. Supabase → SQL Editor → pegar todo → Run.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
begin;

-- 1. Grabaciones mal etiquetadas
update public.recorridos r
   set tipo = 'grabacion'
 where r.tipo = 'recorrido'
   and jsonb_array_length(r.ruta) = 0
   and exists (select 1 from public.recorrido_fotos f where f.recorrido_id = r.id)
   and not exists (select 1 from public.recorrido_fotos f where f.recorrido_id = r.id and f.zona is null);

-- 2. Zonas de la grabación 0e122fdb (La nueva brecha 3)
update public.recorridos
   set zonas = '[{"id":"A","color":"cyan","ring":[{"lat":19.465058,"lng":-101.721445},{"lat":19.465073,"lng":-101.721438},{"lat":19.465208,"lng":-101.721391},{"lat":19.466106,"lng":-101.721105},{"lat":19.466241,"lng":-101.721105},{"lat":19.466286,"lng":-101.721152},{"lat":19.466286,"lng":-101.721178},{"lat":19.465771,"lng":-101.721554}],"label":{"lat":19.465728,"lng":-101.721391},"share":24},{"id":"B","color":"yellow","ring":[{"lat":19.465258,"lng":-101.721929},{"lat":19.466286,"lng":-101.721178},{"lat":19.466286,"lng":-101.721295},{"lat":19.466017,"lng":-101.721581},{"lat":19.465544,"lng":-101.722057}],"label":{"lat":19.465538,"lng":-101.721898},"share":22.1},{"id":"C","color":"pink","ring":[{"lat":19.465028,"lng":-101.722486},{"lat":19.464984,"lng":-101.722391},{"lat":19.464928,"lng":-101.72217},{"lat":19.465258,"lng":-101.721929},{"lat":19.465544,"lng":-101.722057},{"lat":19.465118,"lng":-101.722486}],"label":{"lat":19.465124,"lng":-101.722233},"share":18.1},{"id":"D","color":"green","ring":[{"lat":19.464928,"lng":-101.72217},{"lat":19.464804,"lng":-101.721676},{"lat":19.464804,"lng":-101.721581},{"lat":19.464849,"lng":-101.721534},{"lat":19.465058,"lng":-101.721445},{"lat":19.465771,"lng":-101.721554}],"label":{"lat":19.465112,"lng":-101.721708},"share":35.9}]'::jsonb
 where id = '0e122fdb-b3a8-402e-9854-1464216e07be' and zonas is null;

-- 3. Zona de cada hallazgo = la de su foto
update public.hallazgos h
   set zona = f.zona
  from public.recorrido_fotos f, public.recorridos r
 where r.id = h.recorrido_id
   and r.tipo = 'grabacion'
   and f.recorrido_id = h.recorrido_id
   and f.tomada_at = h.tomada_at
   and h.zona is null
   and f.zona is not null;

commit;

-- Verificación:
--   select tipo, jsonb_array_length(zonas) zonas from public.recorridos where id = '0e122fdb-b3a8-402e-9854-1464216e07be';
--   select zona, estado, count(*) from public.hallazgos where recorrido_id = '0e122fdb-b3a8-402e-9854-1464216e07be' group by 1, 2 order by 1;
