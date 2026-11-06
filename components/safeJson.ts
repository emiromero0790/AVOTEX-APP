/** JSON seguro para inyectar en HTML/JS (escapa <, >, & y los separadores U+2028/U+2029). */
export function safeJsonValue(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
