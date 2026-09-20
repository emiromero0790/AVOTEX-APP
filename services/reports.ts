import { supabase } from '../supabaseConfig';

export type SatelliteReport = {
  id: string;
  user_email: string;
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
  'id,user_email,created_at,ndvi,ndre,msavi,reci,ndmi,precipitacion,humedad,cobertura_nubes,viento,temp_max,temp_min';

export async function listSatelliteReports(userEmail: string): Promise<SatelliteReport[]> {
  const { data, error } = await supabase
    .from('reportes')
    .select(REPORT_COLUMNS)
    .eq('user_email', userEmail)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as SatelliteReport[];
}