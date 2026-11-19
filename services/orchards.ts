import { supabase } from '../supabaseConfig';
import type { ZoneCutsValue } from './satZones';

export type PolygonPoint = {
  latitude: number;
  longitude: number;
};

export type Orchard = {
  id: string;
  user_email: string;
  nombre: string;
  detalles: string | null;
  coordinates: PolygonPoint[];
  center_lat: number;
  center_lng: number;
  area_m2: number;
  created_at: string;
  updated_at: string;
  /** Líneas con las que el agricultor dividió la huerta en zonas. null = zonas automáticas. */
  zonas_cortes?: ZoneCutsValue | null;
};

const BASE_COLUMNS =
  'id,user_email,nombre,detalles,coordinates,center_lat,center_lng,area_m2,created_at,updated_at';
const ORCHARD_COLUMNS = `${BASE_COLUMNS},zonas_cortes`;

/** La columna zonas_cortes aún no existe (falta la migración 20261119): se sigue sin zonas editables. */
function missingZonesColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42703' || error.code === 'PGRST204' || /zonas_cortes/.test(String(error.message));
}
let zonesColumnMissing = false;
const columns = () => (zonesColumnMissing ? BASE_COLUMNS : ORCHARD_COLUMNS);

export async function listOrchards(userEmail: string): Promise<Orchard[]> {
  const run = () => supabase
    .from('huertas')
    .select(columns())
    .eq('user_email', userEmail)
    .order('updated_at', { ascending: false });
  let { data, error } = await run();
  if (error && !zonesColumnMissing && missingZonesColumn(error)) {
    zonesColumnMissing = true;
    ({ data, error } = await run());
  }
  if (error) throw error;
  return (data ?? []) as unknown as Orchard[];
}

export async function saveOrchard(input: {
  id?: string;
  userEmail: string;
  name: string;
  details?: string;
  coordinates: PolygonPoint[];
}): Promise<Orchard> {
  const { error: userError } = await supabase
    .from('users')
    .upsert(
      { user_email: input.userEmail, tokens: 0 },
      { onConflict: 'user_email', ignoreDuplicates: true },
    );
  if (userError) throw userError;

  const payload = {
    user_email: input.userEmail,
    nombre: input.name.trim(),
    detalles: input.details?.trim() || null,
    coordinates: input.coordinates,
    center_lat: input.coordinates[0]?.latitude ?? 0,
    center_lng: input.coordinates[0]?.longitude ?? 0,
  };

  const run = () => {
    const query = input.id
      ? supabase.from('huertas').update(payload).eq('id', input.id).eq('user_email', input.userEmail)
      : supabase.from('huertas').insert(payload);
    return query.select(columns()).single();
  };
  let { data, error } = await run();
  if (error && !zonesColumnMissing && missingZonesColumn(error)) {
    zonesColumnMissing = true;
    ({ data, error } = await run());
  }
  if (error) throw error;
  return data as unknown as Orchard;
}

export class ZonesMigrationMissingError extends Error {
  constructor() {
    super('Falta ejecutar la migración 20261119_huertas_zonas_cortes.sql en Supabase.');
    this.name = 'ZonesMigrationMissingError';
  }
}

/**
 * Guarda las zonas editadas de una huerta. `value` null = volver a las zonas automáticas.
 * Lanza ZonesMigrationMissingError si la base aún no tiene la columna.
 */
export async function saveOrchardZones(id: string, userEmail: string, value: ZoneCutsValue | null): Promise<Orchard> {
  const { data, error } = await supabase
    .from('huertas')
    .update({ zonas_cortes: value })
    .eq('id', id)
    .eq('user_email', userEmail)
    .select(ORCHARD_COLUMNS)
    .single();
  if (missingZonesColumn(error)) throw new ZonesMigrationMissingError();
  if (error) throw error;
  zonesColumnMissing = false;
  return data as unknown as Orchard;
}

export async function deleteOrchard(id: string, userEmail: string): Promise<void> {
  const { error } = await supabase
    .from('huertas')
    .delete()
    .eq('id', id)
    .eq('user_email', userEmail);
  if (error) throw error;
}