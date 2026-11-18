/**
 * Fotos tomadas de un video (iOS / Android). La versión web está en videoFrames.web.ts.
 * Cada cuadro se reduce a 1280 px por lado (suficiente para el modelo y mucho más ligero de subir).
 */
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as ImageManipulator from 'expo-image-manipulator';
import { frameTimes } from './grabacion';

export type VideoFrame = { uri: string; timeMs: number; width: number; height: number };

const MAX_SIDE = 1280;

/** durationMs: duración que reporta la galería (ms); con ella se reparten las fotos (frameTimes). */
export async function extractFrames(
  videoUri: string,
  durationMs: number,
  onProgress?: (done: number, total: number) => void,
  isCancelled?: () => boolean,
): Promise<VideoFrame[]> {
  const times = frameTimes(durationMs);
  const out: VideoFrame[] = [];
  for (let i = 0; i < times.length; i++) {
    if (isCancelled?.()) break;
    try {
      const shot = await VideoThumbnails.getThumbnailAsync(videoUri, { time: times[i], quality: 0.9 });
      const big = Math.max(shot.width, shot.height);
      const resize = big > MAX_SIDE ? [{ resize: shot.width >= shot.height ? { width: MAX_SIDE } : { height: MAX_SIDE } }] : [];
      const img = await ImageManipulator.manipulateAsync(shot.uri, resize, { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG });
      out.push({ uri: img.uri, timeMs: times[i], width: img.width, height: img.height });
    } catch {
      // Un cuadro que no se pudo leer (p. ej. pasado el final real del video) se omite.
    }
    onProgress?.(i + 1, times.length);
  }
  return out;
}
