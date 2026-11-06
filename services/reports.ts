import { supabase } from '../supabaseConfig';

export type SatelliteReport = {
  id: string;
  user_email: string;
  huerta_id: string | null;
  created_at: string;
  ndvi: number | null;
  ndre: number | null;
  msavi: number | null;
  reci: number | null;
  ndmi: number | null;
  precipitacion: number | null;
  humedad: number | null;
  cobertura_nubes: number | null;
  viento: number | null;
  temp_max: number | null;
  temp_min: number | null;
};

const REPORT_COLUMNS =
  'id,user_email,huerta_id,created_at,ndvi,ndre,msavi,reci,ndmi,precipitacion,humedad,cobertura_nubes,viento,temp_max,temp_min';

/** La columna reportes.huerta_id todavía no existe (falta la migración 20261106_reportes_huerta.sql). */
export class MissingHuertaColumnError extends Error {
  constructor() {
    super('Falta ejecutar la migración que relaciona los reportes con las huertas.');
    this.name = 'MissingHuertaColumnError';
  }
}

function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42703' || error.code === 'PGRST204' || /huerta_id/.test(String(error.message));
}

/**
 * Reportes de UNA huerta del usuario, del más reciente al más antiguo.
 * Filtra siempre por correo y por huerta para no mezclar reportes de distintas huertas.
 */
export async function listSatelliteReports(userEmail: string, huertaId: string): Promise<SatelliteReport[]> {
  const { data, error } = await supabase
    .from('reportes')
    .select(REPORT_COLUMNS)
    .eq('user_email', userEmail)
    .eq('huerta_id', huertaId)
    .order('created_at', { ascending: false });

  if (isMissingColumn(error)) throw new MissingHuertaColumnError();
  if (error) throw error;
  return (data ?? []) as SatelliteReport[];
}

/** Cuántos reportes del usuario siguen sin huerta asignada (no se muestran en ninguna huerta). */
export async function countUnassignedReports(userEmail: string): Promise<number | null> {
  const { count, error } = await supabase
    .from('reportes')
    .select('id', { count: 'exact', head: true })
    .eq('user_email', userEmail)
    .is('huerta_id', null);
  if (error) return null;
  return count ?? 0;
}
