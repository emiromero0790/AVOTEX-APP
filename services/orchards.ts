import { supabase } from '../supabaseConfig';

export type PolygonPoint = {
  latitude: number;
  longitude: number;
};

export type Orchard = {
  id: string;
  user_email: string;
  nombre: string;
  coordinates: PolygonPoint[];
  center_lat: number;
  center_lng: number;
  area_m2: number;
  created_at: string;
  updated_at: string;
};

const ORCHARD_COLUMNS =
  'id,user_email,nombre,coordinates,center_lat,center_lng,area_m2,created_at,updated_at';

export async function listOrchards(userEmail: string): Promise<Orchard[]> {
  const { data, error } = await supabase
    .from('huertas')
    .select(ORCHARD_COLUMNS)
    .eq('user_email', userEmail)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Orchard[];
}

export async function saveOrchard(input: {
  id?: string;
  userEmail: string;
  name: string;
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
    coordinates: input.coordinates,
    center_lat: input.coordinates[0]?.latitude ?? 0,
    center_lng: input.coordinates[0]?.longitude ?? 0,
  };

  const query = input.id
    ? supabase.from('huertas').update(payload).eq('id', input.id).eq('user_email', input.userEmail)
    : supabase.from('huertas').insert(payload);

  const { data, error } = await query.select(ORCHARD_COLUMNS).single();
  if (error) throw error;
  return data as Orchard;
}

export async function deleteOrchard(id: string, userEmail: string): Promise<void> {
  const { error } = await supabase
    .from('huertas')
    .delete()
    .eq('id', id)
    .eq('user_email', userEmail);
  if (error) throw error;
}