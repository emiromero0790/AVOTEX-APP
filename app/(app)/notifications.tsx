import { Redirect } from 'expo-router';

/**
 * Ruta anterior de "Reportes satelitales". Datos Satelitales ahora es la pestaña Satélite;
 * esta ruta se conserva para enlaces o notificaciones que todavía apunten aquí.
 */
export default function NotificationsRedirect() {
  return <Redirect href="/(app)/satelite" />;
}
