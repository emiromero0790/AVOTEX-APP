/**
 * Sistema visual de Escanear, Mis escaneos e Importar: fondo blanco como el resto de la app,
 * tarjetas blancas con sombra suave, texto oscuro y acentos lima (el mismo lima de Inicio).
 * Las fotografías y el mapa van dentro de tarjetas redondeadas; el texto sobre fotos es blanco.
 */
export const SCAN = {
  bg: '#FFFFFF',
  surface: '#F8FAFC',
  card: '#FFFFFF',
  ink: '#0A0A0A',
  inkSoft: '#334155',
  muted: '#64748B',
  line: '#E5E7EB',
  onPhoto: '#FFFFFF',
  onPhotoSoft: 'rgba(255,255,255,0.86)',
  glass: 'rgba(255,255,255,0.94)',
  lime: '#84CC16',
  limeBright: '#A8E83E',
  limeSoft: '#ECFCCB',
  limeInk: '#365314',
  brand: '#0f766e',
  amber: '#D97706',
  sky: '#0284C7',
  red: '#DC2626',
} as const;

/** Degradado del botón principal (lima de AVOTEX). */
export const LIME_GRADIENT = ['#D9F99D', '#A8E83E', '#84CC16'] as const;

/** Sombra suave de tarjeta, igual que las tarjetas de Inicio. */
export const CARD_SHADOW = {
  shadowColor: '#315765',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.12,
  shadowRadius: 16,
  elevation: 4,
} as const;

/** Colores de estado legibles sobre fondo blanco (chips e historial). En el mapa se usan los brillantes. */
export const STATUS_INK = {
  listo: '#4D7C0F',
  proceso: '#B45309',
  cola: '#A16207',
  local: '#0369A1',
  error: '#B91C1C',
} as const;
