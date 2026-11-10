/**
 * Imagen ilustrativa de un análisis, la misma que usa Actividad en su historial.
 *
 * Las fotos de los análisis no se conservan (se borran tras el análisis), así que las listas muestran:
 * - Aguacate: el aguacate sano (con pesas) o el aguacate enfermo, según el diagnóstico.
 * - Otras frutas: su foto ilustrativa; si no hay una, el aguacate según el diagnóstico.
 */
import type { ImageSourcePropType } from 'react-native';

const FRUIT_REMOTE_IMAGES: Record<string, string> = {
  limon: 'https://cdn.aarp.net/content/dam/aarpe/es/home/cocina/dieta-y-nutricion/info-10-2013/fotos-limon-beneficios/_jcr_content/root/container_main/container_body_main/list_container_body2/container_body_cf/body_two_cf_listicle_ten/cfimage.coreimg.50.932.jpeg/content/dam/aarp/food/diet_nutrition/2017/12/1140-lime-juice-lemon-benefits-esp.jpg',
  mango: 'https://cdn.myikas.com/images/0fc5e2e6-3ea7-443f-a09e-daf74b83e708/8ff8ba6b-d866-4e48-88c7-44e07abc07e2/3840/mango.webp',
  guayaba: 'https://clickabasto.com/cdn/shop/products/IMG_1458_665x462.jpg?v=1655783207',
  granada: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQoNOSa7eeyMktiOgpxYd8BV95f3PTgPnzHcg&s',
  cafe: 'https://cdn.alsuper.com/products/420910_p.webp',
};
export const HEALTHY_FALLBACK = require('../assets/images/avotexSano.png');
export const REVIEW_FALLBACK = require('../assets/images/avotexEnfermo.png');

export const normalizeLabel = (value = '') =>
  value.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

/** ¿La etiqueta del modelo dice «saludable»? (las clases llegan en minúsculas y en español o inglés). */
export const isHealthyLabel = (label = '') => {
  const normalized = normalizeLabel(label);
  if (/\b(no|not|sin)\s+(saludable|healthy|sano|fresh|fresco)\b/.test(normalized)) return false;
  return ['saludable', 'healthy', 'sano', 'fresh', 'fresco'].some(word => normalized.includes(word));
};

export const fruitImage = (fruit: string | null | undefined = 'Aguacate', isHealthy = true): ImageSourcePropType => {
  const key = normalizeLabel(fruit ?? '');
  if (!key || key === 'aguacate' || key === 'avocado') return isHealthy ? HEALTHY_FALLBACK : REVIEW_FALLBACK;
  const remoteImage = FRUIT_REMOTE_IMAGES[key];
  return remoteImage ? { uri: remoteImage } : (isHealthy ? HEALTHY_FALLBACK : REVIEW_FALLBACK);
};
