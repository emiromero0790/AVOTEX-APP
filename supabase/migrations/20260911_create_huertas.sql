-- Ejecutar una vez en Supabase SQL Editor.
-- Conserva las coordenadas originales en JSONB y genera una geometría PostGIS
-- para cálculos de superficie y futuras consultas espaciales.

create extension if not exists postgis with schema extensions;

create table if not exists public.huertas (
  id uuid primary key default gen_random_uuid(),
  user_email text not null references public.users(user_email) on update cascade on delete cascade,
  nombre text not null check (char_length(trim(nombre)) between 1 and 80),
  coordinates jsonb not null check (jsonb_typeof(coordinates) = 'array' and jsonb_array_length(coordinates) >= 3),
  center_lat double precision not null,
  center_lng double precision not null,
  area_m2 double precision not null default 0,
  poligono extensions.geography(Polygon, 4326),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists huertas_user_email_idx on public.huertas (user_email);
create index if not exists huertas_poligono_gix on public.huertas using gist (poligono);

create or replace function public.prepare_huerta_geometry()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  open_ring jsonb;
  closed_ring jsonb;
  geometry_value geometry(Polygon, 4326);
begin
  select jsonb_agg(
    jsonb_build_array(
      (point.value ->> 'longitude')::double precision,
      (point.value ->> 'latitude')::double precision
    )
    order by point.ordinality
  )
  into open_ring
  from jsonb_array_elements(new.coordinates) with ordinality as point(value, ordinality);

  if open_ring is null or jsonb_array_length(open_ring) < 3 then
    raise exception 'A boundary requires at least three points';
  end if;

  closed_ring := open_ring || jsonb_build_array(open_ring -> 0);
  geometry_value := st_setsrid(
    st_geomfromgeojson(
      jsonb_build_object(
        'type', 'Polygon',
        'coordinates', jsonb_build_array(closed_ring)
      )::text
    ),
    4326
  );

  if not st_isvalid(geometry_value) then
    raise exception 'Invalid or self-intersecting boundary';
  end if;

  new.poligono := geometry_value::geography;
  new.center_lat := st_y(st_centroid(geometry_value));
  new.center_lng := st_x(st_centroid(geometry_value));
  new.area_m2 := st_area(geometry_value::geography);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists huertas_prepare_geometry on public.huertas;
create trigger huertas_prepare_geometry
before insert or update of coordinates
on public.huertas
for each row execute function public.prepare_huerta_geometry();

grant select, insert, update, delete on public.huertas to anon, authenticated;

comment on table public.huertas is
  'Huertas delimitadas en Avotex. user_email corresponde al correo autenticado en Firebase.';

-- IMPORTANTE:
-- La app actual autentica con Firebase y Supabase no recibe todavía ese JWT.
-- Por ello no se habilita RLS en esta migración: una política basada solo en el
-- correo enviado por el cliente no aporta seguridad. Antes de publicar datos
-- sensibles, configure Firebase como proveedor JWT de Supabase o escriba estas
-- operaciones mediante un endpoint que verifique el Firebase ID token.