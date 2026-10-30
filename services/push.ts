/**
 * Notificaciones push (servicio gratuito de Expo).
 * El procesador de recorridos envía "Tu recorrido está listo" a los tokens guardados en push_tokens.
 *
 * Requisitos de la compilación (no funciona en Expo Go):
 *  - iOS: EAS configura APNs al compilar con la cuenta de Apple.
 *  - Android: credenciales FCM (google-services.json + clave FCM v1 cargada en EAS).
 * Si faltan, la app sigue funcionando: solo no llegan notificaciones.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from '../supabaseConfig';

export const RECORRIDOS_CHANNEL = 'recorridos';

let handlerConfigured = false;

/** Muestra la notificación aunque la app esté abierta. */
export function configureNotifications(): void {
  if (handlerConfigured || Platform.OS === 'web') return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export type PushResult = 'ok' | 'denied' | 'unavailable';

/** Pide permiso (solo si hace falta) y guarda el token de este celular para el usuario. */
export async function registerForPush(userEmail: string): Promise<PushResult> {
  if (Platform.OS === 'web' || !Device.isDevice || !userEmail) return 'unavailable';
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(RECORRIDOS_CHANNEL, {
        name: 'Recorridos con IA',
        description: 'Avisos cuando termina el análisis de un recorrido',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return 'denied';

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) return 'unavailable';
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

    const { error } = await supabase
      .from('push_tokens')
      .upsert({ token, user_email: userEmail, plataforma: Platform.OS, updated_at: new Date().toISOString() }, { onConflict: 'token' });
    if (error) throw error;
    return 'ok';
  } catch (e) {
    console.warn('[push] no se pudo registrar el celular:', e);
    return 'unavailable';
  }
}

/** Id del recorrido si la notificación tocada es de un recorrido terminado. */
export function recorridoIdFrom(response: Notifications.NotificationResponse | null): string | null {
  const data = response?.notification.request.content.data as { tipo?: string; recorridoId?: string } | undefined;
  return data?.tipo === 'recorrido' && typeof data.recorridoId === 'string' ? data.recorridoId : null;
}
