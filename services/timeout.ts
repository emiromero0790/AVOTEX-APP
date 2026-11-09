/**
 * Límite de tiempo para llamadas nativas que en algunos teléfonos nunca responden
 * (permisos, GPS, red, espacio, batería). Si no hay respuesta en `ms`, o si falla, devuelve `fallback`:
 * la pantalla nunca se queda «cargando» para siempre.
 */
export function withTimeout<T>(task: Promise<T> | (() => Promise<T>), ms: number, fallback: T): Promise<T> {
  return new Promise<T>(resolve => {
    let done = false;
    const finish = (v: T) => { if (!done) { done = true; clearTimeout(timer); resolve(v); } };
    const timer = setTimeout(() => finish(fallback), ms);
    try {
      const p = typeof task === 'function' ? task() : task;
      Promise.resolve(p).then(finish, () => finish(fallback));
    } catch {
      finish(fallback);
    }
  });
}
