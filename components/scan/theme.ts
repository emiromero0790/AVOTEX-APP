/**
 * Sistema visual de Escanear y Mis escaneos: fondo verde casi negro, vegetación real y acentos lima.
 * Los verdes de marca AVOTEX (#0f766e, #34d399) se conservan para estados y detalles.
 */
export const SCAN = {
  bg: '#06120B',
  bgDeep: '#030A06',
  ink: '#F7FEE7',
  inkSoft: 'rgba(247,254,231,0.82)',
  muted: 'rgba(236,252,203,0.62)',
  line: 'rgba(190,242,100,0.16)',
  glass: 'rgba(8,24,15,0.72)',
  glassStrong: 'rgba(8,24,15,0.9)',
  lime: '#A3E635',
  limeBright: '#BEF264',
  limeDeep: '#4D7C0F',
  brand: '#0f766e',
  amber: '#FBBF24',
  sky: '#38BDF8',
  red: '#F87171',
} as const;

/** Degradado del botón principal (lima luminoso → verde de huerta). */
export const LIME_GRADIENT = ['#D9F99D', '#A3E635', '#65A30D'] as const;
