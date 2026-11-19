-- Ejecutar una vez en Supabase SQL Editor (antes de desplegar el procesador que la usa).
--
-- Cobro de tokens de recorridos inteligentes y grabaciones: cada foto que el modelo analiza cuesta lo
-- mismo que un escaneo individual (1 unidad de users.tokens = 100 tokens en la app).
--
-- El procesador (processor/procesar_recorridos.py) llama a cobrar_recorrido() al terminar el análisis.
-- La función es idempotente por recorrido: guarda en tokens_cobrados lo ya cobrado y en un reintento
-- solo cobra la diferencia, así un recorrido que falla y se vuelve a procesar nunca se cobra dos veces.

alter table public.recorridos
  add column if not exists tokens_cobrados integer not null default 0 check (tokens_cobrados >= 0),
  add column if not exists fotos_sin_saldo integer not null default 0 check (fotos_sin_saldo >= 0);

comment on column public.recorridos.tokens_cobrados is 'Fotos analizadas ya cobradas (unidades de users.tokens; 1 = 100 tokens en la app).';
comment on column public.recorridos.fotos_sin_saldo is 'Fotos que no se analizaron porque el usuario no tenía tokens suficientes.';

create or replace function public.cobrar_recorrido(p_recorrido uuid, p_fotos integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_prev integer;
  v_delta integer;
begin
  -- Bloquea la fila: dos procesos no pueden cobrar el mismo recorrido a la vez.
  select user_email, tokens_cobrados into v_email, v_prev
  from public.recorridos where id = p_recorrido for update;
  if not found then
    raise exception 'recorrido % no existe', p_recorrido;
  end if;

  v_delta := greatest(0, coalesce(p_fotos, 0) - v_prev);
  if v_delta = 0 then
    return 0;
  end if;

  -- Nunca deja el saldo en negativo (el procesador ya limita las fotos al saldo disponible).
  update public.users set tokens = greatest(0, coalesce(tokens, 0) - v_delta) where user_email = v_email;
  update public.recorridos set tokens_cobrados = v_prev + v_delta where id = p_recorrido;
  return v_delta;
end;
$$;

-- Solo el procesador (service_role) puede cobrar; la app no.
revoke all on function public.cobrar_recorrido(uuid, integer) from public, anon, authenticated;
grant execute on function public.cobrar_recorrido(uuid, integer) to service_role;
