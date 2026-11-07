/**
 * Catálogo controlado de diagnósticos de AVOTEX.
 *
 * Solo cubre las clases de estado que la app conoce (ver DOMAIN_LABELS en context/LanguageContext.tsx):
 * saludable, enfermo, antracnosis, mancha negra, pudrición y "no es fruto". Cualquier otro valor que
 * llegue de la base NO genera texto: se muestra su nombre tal cual y el estado "sin información".
 *
 * Contenido: información general de referencia sobre síntomas y prácticas de manejo cultural.
 * No incluye productos, ingredientes activos ni dosis: esas decisiones requieren a un agrónomo o
 * un laboratorio. Revisar y ampliar con el equipo agronómico de AVOTEX antes de publicar cambios.
 */
export type Lang = 'es' | 'en';
type L = { es: string; en: string };

export type DiagnosticoKey = 'saludable' | 'enfermo' | 'antracnosis' | 'mancha_negra' | 'pudricion' | 'nofruta';

export type Diagnostico = {
  key: DiagnosticoKey;
  /** Tipo de condición en una línea (bajo el nombre). */
  kind: L;
  summary: L;
  symptoms: L[];
  recommendations: L[];
  /** Cuándo conviene confirmar en campo o laboratorio. */
  verify: L;
};

const ALIASES: Record<string, DiagnosticoKey> = {
  saludable: 'saludable', healthy: 'saludable', sano: 'saludable', fresh: 'saludable', fresco: 'saludable',
  enfermo: 'enfermo', diseased: 'enfermo',
  antracnosis: 'antracnosis', anthracnose: 'antracnosis',
  'mancha negra': 'mancha_negra', manchanegra: 'mancha_negra', 'black spot': 'mancha_negra', blackspot: 'mancha_negra',
  pudricion: 'pudricion', 'pudrición': 'pudricion', rot: 'pudricion', rotten: 'pudricion', podrido: 'pudricion',
  nofruta: 'nofruta', 'no fruta': 'nofruta', 'not a fruit': 'nofruta',
};

export function diagnosticoKey(estado: string | null | undefined, fruto?: string | null): DiagnosticoKey | null {
  const f = (fruto ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (ALIASES[f] === 'nofruta') return 'nofruta';
  const e = (estado ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
  return ALIASES[e] ?? ALIASES[e.replace(/ /g, '')] ?? null;
}

const VERIFY_DISEASE: L = {
  es: 'Si el daño avanza o aparece en varios árboles, confirma el diagnóstico con un agrónomo o con un análisis de laboratorio antes de aplicar cualquier tratamiento.',
  en: 'If damage spreads or appears on several trees, confirm the diagnosis with an agronomist or a lab test before applying any treatment.',
};

export const DIAGNOSTICOS: Record<DiagnosticoKey, Diagnostico> = {
  antracnosis: {
    key: 'antracnosis',
    kind: { es: 'Enfermedad causada por hongos', en: 'Fungal disease' },
    summary: {
      es: 'La antracnosis es una enfermedad causada por hongos del género Colletotrichum. Afecta frutos, hojas y brotes de cultivos como aguacate, mango, guayaba y café, y suele avanzar con humedad alta y lluvias.',
      en: 'Anthracnose is a disease caused by Colletotrichum fungi. It affects fruit, leaves and shoots of crops such as avocado, mango, guava and coffee, and usually spreads with high humidity and rain.',
    },
    symptoms: [
      { es: 'Manchas oscuras y hundidas en el fruto', en: 'Dark, sunken spots on the fruit' },
      { es: 'Lesiones que crecen y pueden unirse', en: 'Lesions that grow and can merge' },
      { es: 'Pudrición del fruto en etapas avanzadas', en: 'Fruit rot in advanced stages' },
      { es: 'Manchas necróticas en hojas y brotes', en: 'Necrotic spots on leaves and shoots' },
    ],
    recommendations: [
      { es: 'Retira y elimina fuera de la huerta los frutos y ramas afectados', en: 'Remove affected fruit and branches and dispose of them outside the orchard' },
      { es: 'Poda para mejorar la ventilación y la entrada de luz', en: 'Prune to improve airflow and light' },
      { es: 'Evita heridas en el fruto durante labores y cosecha', en: 'Avoid wounding fruit during field work and harvest' },
      { es: 'Desinfecta herramientas de poda entre árboles', en: 'Disinfect pruning tools between trees' },
      { es: 'Vigila la zona en los próximos recorridos', en: 'Monitor the area in your next walks' },
    ],
    verify: VERIFY_DISEASE,
  },
  mancha_negra: {
    key: 'mancha_negra',
    kind: { es: 'Manchas en la cáscara del fruto', en: 'Spots on the fruit skin' },
    summary: {
      es: 'Manchas negras en la cáscara. Según el cultivo pueden deberse a distintos hongos (por ejemplo, Phyllosticta en cítricos o Cercospora en aguacate) o a daños físicos, por eso conviene verificarlas.',
      en: 'Black spots on the skin. Depending on the crop they can come from different fungi (for example Phyllosticta in citrus or Cercospora in avocado) or from physical damage, so they should be checked.',
    },
    symptoms: [
      { es: 'Puntos o manchas negras en la cáscara', en: 'Black dots or spots on the skin' },
      { es: 'Manchas que pueden agrietarse o volverse ásperas', en: 'Spots that may crack or turn rough' },
      { es: 'Menor calidad visual del fruto', en: 'Lower visual quality of the fruit' },
    ],
    recommendations: [
      { es: 'Separa y retira los frutos más dañados', en: 'Separate and remove the most damaged fruit' },
      { es: 'Mejora la ventilación del árbol con poda', en: 'Improve airflow in the tree with pruning' },
      { es: 'Retira restos de hojas y frutos caídos', en: 'Clear fallen leaves and fruit' },
      { es: 'Compara con otros frutos del mismo árbol', en: 'Compare with other fruit on the same tree' },
    ],
    verify: VERIFY_DISEASE,
  },
  pudricion: {
    key: 'pudricion',
    kind: { es: 'Deterioro del fruto', en: 'Fruit decay' },
    summary: {
      es: 'El fruto muestra zonas blandas u oscuras de pudrición. Puede deberse a hongos o bacterias que entran por heridas, a sobremadurez o a golpes.',
      en: 'The fruit shows soft or dark rotting areas. It can be caused by fungi or bacteria entering through wounds, by over-ripening or by bruising.',
    },
    symptoms: [
      { es: 'Zonas blandas o hundidas', en: 'Soft or sunken areas' },
      { es: 'Cambio de color a café o negro', en: 'Color turning brown or black' },
      { es: 'Posible moho visible en la superficie', en: 'Possible visible mold on the surface' },
    ],
    recommendations: [
      { es: 'Retira los frutos podridos para evitar que contagien a otros', en: 'Remove rotten fruit so it does not spread to others' },
      { es: 'Manipula los frutos con cuidado para evitar golpes y heridas', en: 'Handle fruit carefully to avoid bruises and wounds' },
      { es: 'Revisa el punto de cosecha y el manejo después de cosechar', en: 'Check harvest timing and post-harvest handling' },
    ],
    verify: VERIFY_DISEASE,
  },
  enfermo: {
    key: 'enfermo',
    kind: { es: 'Posible enfermedad sin tipo específico', en: 'Possible disease, type not identified' },
    summary: {
      es: 'El modelo encontró señales de enfermedad, pero no identificó cuál. Revisa las imágenes y el fruto en campo para saber de qué se trata.',
      en: 'The model found signs of disease but did not identify which one. Check the images and the fruit in the field to find out.',
    },
    symptoms: [
      { es: 'Manchas, cambios de color o lesiones en el fruto', en: 'Spots, color changes or lesions on the fruit' },
    ],
    recommendations: [
      { es: 'Inspecciona el árbol y los frutos cercanos', en: 'Inspect the tree and nearby fruit' },
      { es: 'Toma nuevas fotos de cerca con buena luz', en: 'Take new close-up photos in good light' },
      { es: 'Separa los frutos afectados mientras se confirma', en: 'Set aside affected fruit while it is confirmed' },
    ],
    verify: VERIFY_DISEASE,
  },
  saludable: {
    key: 'saludable',
    kind: { es: 'Sin señales de enfermedad', en: 'No signs of disease' },
    summary: {
      es: 'El modelo no encontró señales de enfermedad en este fruto. Es un buen indicador, pero no descarta problemas en otras partes del árbol.',
      en: 'The model found no signs of disease on this fruit. It is a good sign, but it does not rule out problems elsewhere on the tree.',
    },
    symptoms: [],
    recommendations: [
      { es: 'Continúa con los recorridos periódicos para detectar cambios a tiempo', en: 'Keep doing regular walks to catch changes early' },
      { es: 'Mantén la poda y la limpieza de la huerta', en: 'Keep up pruning and orchard cleanliness' },
      { es: 'Evita heridas en el fruto durante labores y cosecha', en: 'Avoid wounding fruit during field work and harvest' },
    ],
    verify: {
      es: 'Si notas manchas o cambios en el fruto, vuelve a escanearlo.',
      en: 'If you notice spots or changes on the fruit, scan it again.',
    },
  },
  nofruta: {
    key: 'nofruta',
    kind: { es: 'No se reconoció un fruto', en: 'No fruit recognized' },
    summary: {
      es: 'En esta imagen el modelo no reconoció un fruto, así que no evaluó su estado. Puede tratarse de hojas, ramas o una foto desenfocada.',
      en: 'The model did not recognize a fruit in this image, so it did not assess its condition. It may show leaves, branches or be out of focus.',
    },
    symptoms: [],
    recommendations: [
      { es: 'Acércate al fruto y procura que ocupe buena parte de la foto', en: 'Get closer so the fruit fills most of the photo' },
      { es: 'Evita contraluces y fotos movidas', en: 'Avoid backlight and blurry photos' },
    ],
    verify: { es: 'Puedes volver a escanear este punto en tu próximo recorrido.', en: 'You can scan this spot again on your next walk.' },
  },
};

export function getDiagnostico(estado: string | null | undefined, fruto?: string | null): Diagnostico | null {
  const k = diagnosticoKey(estado, fruto);
  return k ? DIAGNOSTICOS[k] : null;
}
