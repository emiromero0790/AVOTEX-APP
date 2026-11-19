/**
 * Props para las ScrollView de pantalla completa: sin rebote al llegar arriba.
 *
 * En iOS, al deslizar hacia abajo estando ya arriba (o al regresar con impulso), el contenido
 * se separa del borde y deja ver el fondo de la pantalla: un hueco blanco sobre el encabezado.
 * Android no rebota, pero `overScrollMode="never"` quita también el brillo de borde.
 *
 * No usar en listas con RefreshControl (deslizar para actualizar necesita el rebote en iOS).
 */
export const noOverscroll = {
  bounces: false,
  overScrollMode: 'never',
  contentInsetAdjustmentBehavior: 'never',
  automaticallyAdjustContentInsets: false,
} as const;
