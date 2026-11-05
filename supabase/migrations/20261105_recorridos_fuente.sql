-- Fuente de las fotos de cada escaneo (recorrido): celular, dron o cámara de acción.
-- Migración NO destructiva: solo agrega una columna con valor por defecto; los registros
-- existentes quedan como 'celular' (así se crearon). Se puede ejecutar más de una vez.
-- La app funciona aunque esta migración no se haya ejecutado (guarda sin la columna).

alter table public.recorridos
  add column if not exists fuente text not null default 'celular';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'recorridos_fuente_check' and conrelid = 'public.recorridos'::regclass
  ) then
    alter table public.recorridos
      add constraint recorridos_fuente_check check (fuente in ('celular', 'dron', 'camara'));
  end if;
end $$;
