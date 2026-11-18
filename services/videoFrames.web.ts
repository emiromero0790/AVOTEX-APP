/**
 * Fotos tomadas de un video en el navegador (versión web de la app y pruebas): <video> + <canvas>.
 */
import { frameTimes } from './grabacion';

export type VideoFrame = { uri: string; timeMs: number; width: number; height: number };

const MAX_SIDE = 1280;

function seek(video: HTMLVideoElement, seconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => { video.removeEventListener('seeked', done); video.removeEventListener('error', fail); resolve(); };
    const fail = () => { video.removeEventListener('seeked', done); video.removeEventListener('error', fail); reject(new Error('seek')); };
    video.addEventListener('seeked', done);
    video.addEventListener('error', fail);
    video.currentTime = seconds;
  });
}

/** En el navegador la duración se lee del propio video (la galería web no siempre la da, o la da en segundos). */
export async function extractFrames(
  videoUri: string,
  _durationMs: number,
  onProgress?: (done: number, total: number) => void,
  isCancelled?: () => boolean,
): Promise<VideoFrame[]> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  video.src = videoUri;
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error('No se pudo leer el video'));
  });
  const times = frameTimes(Number.isFinite(video.duration) ? video.duration * 1000 : 0);
  const canvas = document.createElement('canvas');
  const k = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.round(video.videoWidth * k);
  canvas.height = Math.round(video.videoHeight * k);
  const ctx = canvas.getContext('2d');
  const out: VideoFrame[] = [];
  for (let i = 0; i < times.length; i++) {
    if (isCancelled?.()) break;
    const t = Math.min(times[i] / 1000, Math.max(0, video.duration - 0.05));
    try {
      await seek(video, t);
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      out.push({ uri: canvas.toDataURL('image/jpeg', 0.82), timeMs: times[i], width: canvas.width, height: canvas.height });
    } catch { /* cuadro omitido */ }
    onProgress?.(i + 1, times.length);
  }
  video.removeAttribute('src');
  video.load();
  return out;
}
