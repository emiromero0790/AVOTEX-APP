import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  ActivityIndicator,
  Modal,
  Linking,
  useWindowDimensions,
} from "react-native";
import { Stack, router } from "expo-router";
import { ChevronLeft, Send, Shield, Flag, Sparkles, Bot, User } from "lucide-react-native";
import { useFonts, Poppins_400Regular, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { GoogleGenerativeAI } from '@google/generative-ai';
import emailjs from '@emailjs/browser';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassOrb from '../../components/chat/GlassOrb';

import { auth } from '../../firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { TranslationResource, useTranslations, useLanguage } from '../../context/LanguageContext';

/** Paleta del Asistente: marfil, verde bosque, salvia y lima (solo para Enviar y los destellos). */
const CHAT = {
  ivory: '#F7F7EF',
  forest: '#103824',
  muted: '#566B55',
  sage: '#E9EFD7',
  lime: '#B9F62F',
  warmWhite: '#FFFDF2',
};

const translations: TranslationResource = {
  'chat.guest': { es: 'Invitado', en: 'Guest' }, 'chat.reportSubject': { es: 'Reporte de respuesta — Asistente Avotex', en: 'Response report — Avotex Assistant' }, 'chat.reportBody': { es: 'Hola equipo VEX,\n\nQuiero reportar la siguiente respuesta del asistente:\n\n"{message}"\n\nMotivo del reporte: [describe aquí el problema]\n\nGracias.', en: 'Hello VEX team,\n\nI would like to report the following assistant response:\n\n"{message}"\n\nReport reason: [describe the issue here]\n\nThank you.' }, 'chat.sending': { es: 'Enviando tu consulta al equipo de VEX...', en: 'Sending your request to the VEX team...' }, 'chat.sent': { es: 'Perfecto. Tu consulta ha sido enviada.\n\nTe responderán pronto a: {email}\n\n¿Hay algo más en lo que pueda ayudarte?', en: 'Perfect. Your request has been sent.\n\nThey will reply soon at: {email}\n\nIs there anything else I can help you with?' }, 'chat.sendError': { es: 'Hubo un problema al enviar el correo.\n\nContacta directamente a:\n{email}', en: 'There was a problem sending the email.\n\nContact directly:\n{email}' }, 'chat.cancelled': { es: 'Entendido. ¿En qué más puedo ayudarte?', en: 'Understood. What else can I help you with?' }, 'chat.invalidEmail': { es: "Correo no válido. Intenta de nuevo o escribe 'cancelar'.", en: "Invalid email. Try again or type 'cancel'." }, 'chat.contact': { es: "Para esa consulta necesito conectarte con el equipo.\n\nPor favor escribe tu correo electrónico aquí (o escribe 'cancelar').", en: "For that request, I need to connect you with the team.\n\nPlease enter your email here (or type 'cancel')." }, 'chat.connection': { es: 'Error de conexión. Intenta de nuevo.', en: 'Connection error. Try again.' }, 'chat.title': { es: 'Asistente Avotex', en: 'Avotex Assistant' }, 'chat.hello': { es: '¡Hola! Soy Avotex', en: 'Hi! I am Avotex' }, 'chat.modalBody': { es: 'Soy un asistente inteligente impulsado por Inteligencia Artificial diseñado para ayudarte a entender el estado de tus cultivos y sacarle el máximo provecho a la app.', en: 'I am an AI-powered assistant designed to help you understand the state of your crops and get the most out of the app.' }, 'chat.before': { es: 'Antes de continuar, toma en cuenta lo siguiente:', en: 'Before continuing, please note the following:' }, 'chat.bullet1': { es: 'Mis respuestas se basan en el análisis de imágenes, datos de la app y mi base de conocimientos', en: 'My answers are based on image analysis, app data, and my knowledge base' }, 'chat.bullet2': { es: 'Los diagnósticos y recomendaciones son orientativos y no sustituyen la asesoría de un especialista agrícola', en: 'Diagnoses and recommendations are guidance only and do not replace advice from an agricultural specialist' }, 'chat.bullet3': { es: 'Puedo utilizar información como imágenes capturadas y tu ubicación para ofrecer resultados más precisos.', en: 'I may use information such as captured images and your location to provide more accurate results.' }, 'chat.bullet4': { es: 'Tu información puede ser procesada por servicios externos únicamente para el funcionamiento de la app', en: 'Your information may be processed by external services solely for the app to function' }, 'chat.bullet5': { es: 'No vendemos ni compartimos tu información personal con terceros con fines comerciales.', en: 'We do not sell or share your personal information with third parties for commercial purposes.' }, 'chat.bullet6': { es: 'Aunque estoy diseñado para ayudarte, puedo cometer errores', en: 'Although I am designed to help, I can make mistakes' }, 'chat.footnote': { es: 'Al continuar, aceptas usar este asistente bajo tu propia responsabilidad.', en: 'By continuing, you agree to use this assistant at your own risk.' }, 'chat.cancel': { es: 'Cancelar', en: 'Cancel' }, 'chat.continue': { es: 'Continuar', en: 'Continue' }, 'chat.back': { es: 'Volver', en: 'Back' }, 'chat.welcome': { es: 'Bienvenido', en: 'Welcome' }, 'chat.discover': { es: '¿Qué quieres\ndescubrir hoy?', en: 'What do you want to\ndiscover today?' }, 'chat.subtitle': { es: 'Pregunta sobre la app, tus cultivos o el siguiente paso.', en: 'Ask about the app, your crops, or the next step.' }, 'chat.s1': { es: '¿Cómo funciona Escanear?', en: 'How does Scan work?' }, 'chat.s2': { es: '¿Qué muestra Mapeo?', en: 'What does Mapping show?' }, 'chat.s3': { es: 'Ayúdame con una recomendación', en: 'Help me with a recommendation' }, 'chat.accept': { es: 'Acepta los términos para escribir...', en: 'Accept the terms to write...' }, 'chat.email': { es: 'Escribe tu correo...', en: 'Enter your email...' }, 'chat.ask': { es: 'Pregunta algo o describe tu idea', en: 'Ask something or describe your idea' }, 'chat.write': { es: 'Escribe algo...', en: 'Write something...' }, 'chat.hint': { es: 'Avotex · asistente inteligente', en: 'Avotex · intelligent assistant' }, 'chat.report': { es: 'Reportar respuesta', en: 'Report response' },
};

const EMAILJS_SERVICE_ID = process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID!;
const EMAILJS_TEMPLATE_ID = process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID!;
const EMAILJS_PUBLIC_KEY = process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY!;
const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY!;
// gemini-2.5-flash ya no está disponible para proyectos nuevos (y desde el 1 dic 2026 se redirige a este).
const MODEL = "gemini-3.5-flash-lite";
const REPORT_EMAIL = 'vexmxoficial@gmail.com';

const genAI = new GoogleGenerativeAI(API_KEY);

const systemInstruction = `ROL
Eres "Avotex", la mascota y asistente oficial de la app AVOTEX. Eres amable, claro y práctico. Ayudas a agricultores y técnicos a usar la app, a entender sus resultados y a decidir el siguiente paso. Hablas de forma sencilla, sin tecnicismos innecesarios, y das pasos concretos dentro de la app (por ejemplo: "Ve a Escanear y toca Iniciar recorrido").

BASE DE CONOCIMIENTOS
Esta es la información que conoces. Úsala para responder.

1. QUÉ ES AVOTEX
AVOTEX es una app móvil de VEX para el sector agrícola y agroindustrial. Usa Inteligencia Artificial para analizar fotos de frutos y detectar enfermedades de forma temprana, precisa y económica. Sirve tanto a pequeños productores como a grandes agroindustrias. Funciona en Android y iPhone, en español e inglés.
El proyecto fue desarrollado por Bruno Leonardo Parra Fernandez y Emiliano Romero García, con la asesoría de Aurelio Amaury Coria Ramírez, del Instituto Tecnológico de Morelia.
Tecnología: el diagnóstico lo hace una Red Neuronal Convolucional (CNN) propia, hecha con TensorFlow y desplegada en la nube. La cuenta se maneja con Firebase y los datos se guardan en Supabase. Las imágenes satelitales vienen de Sentinel-2 (Copernicus) y el mapa base de Esri.

2. CULTIVOS Y DIAGNÓSTICOS
Frutos que reconoce la app: aguacate, limón, mango, guayaba, granada y café.
Resultados posibles de cada fruto analizado:
- Saludable: sin señales de enfermedad. Es un buen indicador, pero no descarta problemas en otras partes del árbol. Conviene seguir con recorridos periódicos, poda y limpieza.
- Antracnosis: enfermedad causada por hongos del género Colletotrichum. Afecta frutos, hojas y brotes (aguacate, mango, guayaba, café) y avanza con humedad alta y lluvias. Señales: manchas oscuras y hundidas que crecen y se unen; en etapas avanzadas, pudrición del fruto. Manejo general: retirar y sacar de la huerta frutos y ramas afectados, podar para ventilar y dar luz, evitar heridas al fruto, desinfectar herramientas de poda entre árboles y vigilar la zona en los siguientes recorridos.
- Mancha negra: manchas o puntos negros en la cáscara; pueden agrietarse o volverse ásperas y bajan la calidad visual. Según el cultivo pueden deberse a distintos hongos (por ejemplo Phyllosticta en cítricos o Cercospora en aguacate) o a daños físicos, por eso conviene verificarlas. Manejo general: separar los frutos más dañados, mejorar la ventilación con poda, retirar hojas y frutos caídos y comparar con otros frutos del mismo árbol.
- Pudrición: zonas blandas, hundidas o de color café o negro, a veces con moho. Puede deberse a hongos o bacterias que entran por heridas, a sobremadurez o a golpes. Manejo general: retirar los frutos podridos para que no contagien, manipular con cuidado y revisar el punto de cosecha y el manejo poscosecha.
- Enfermo (sin tipo específico): el modelo vio señales de enfermedad pero no identificó cuál. Hay que revisar el fruto en campo y tomar fotos nuevas de cerca con buena luz.
- No es un fruto: en la foto no se reconoció un fruto (hojas, ramas o foto desenfocada). Hay que acercarse para que el fruto ocupe buena parte de la foto y evitar contraluces y fotos movidas.
Cada resultado trae un porcentaje de confianza. Si la confianza es baja, recomienda repetir la foto con luz uniforme.
Los resultados son orientativos: deben confirmarse en campo o con un especialista antes de aplicar un tratamiento.

3. CÓMO ESTÁ ORGANIZADA LA APP
Barra inferior con seis secciones, con estos nombres exactos: Inicio, Escanear, Mapeo, Actividad, Satélite y Ajustes. Ojo: la sección para tomar fotos se llama "Escanear" (no "Escaneos"). "Mis escaneos" no es una sección de la barra: se abre desde Escanear (botón "Ver mis escaneos") o desde Actividad (pestaña Escaneos). Arriba de varias pantallas aparece el indicador de tokens (saldo) y el acceso a Ajustes. El botón flotante con una semilla abre este asistente.

INICIO
- Saludo y la "Huerta seleccionada" con su superficie y el botón "Ver mapa". Si no hay huertas, invita a registrar la primera en Mapeo.
- "Estado del cultivo": Temperatura y Humedad (clima según la ubicación del teléfono), Viento y Salud. Salud es un porcentaje calculado con los escaneos del usuario, con niveles Crítica, Atención y Saludable.
- "Mis huertas" (lista para abrir cada una) y "Acciones rápidas" hacia Escanear, Mapeo, Actividad y Satélite.
- Recuadro "Explora más detalles de tu huerta virtual": abre la plataforma web de AVOTEX (https://vex-mx.com/avotex.html#acceso), con índices NDVI, NDRE, humedad, precipitación y temperatura.

ESCANEAR
Lema: "Una huerta. Cualquier cámara." Se elige la cámara y luego la acción:
- Celular: el modo principal.
- Dron y GoPro / cámara de acción: inician el mismo recorrido inteligente; solo cambia la animación que acompaña al agricultor. Para analizar un video ya grabado con dron, GoPro o celular se usa "Subir grabación".
Acciones:
a) Foto individual: se toma una foto de un fruto y se recibe el diagnóstico en segundos. Es lo que pueden usar los invitados.
b) Recorrido inteligente (botón "Iniciar recorrido"): el usuario camina su huerta y el celular toma las fotos solo, sin internet.
   - Antes de empezar se elige la huerta (se puede detectar por GPS) y la app revisa permisos de cámara y ubicación.
   - Toma una imagen cada 2 a 3 metros con su ubicación GPS. Si el usuario se queda quieto un rato, toma una foto donde está. También hay botón "Tomar foto" manual, y botones "Pausar" y "Terminar".
   - Consejo: llevar el celular en el pecho o en la mano, caminar despacio y apuntar a los frutos a 30–50 cm.
   - La distancia se mide con el GPS del teléfono (no depende de la huerta elegida). Al terminar se eligen las fotos a subir. Máximo 1,200 fotos por recorrido.
   - Se sube con WiFi; se puede permitir subir con datos móviles (un recorrido puede pesar 100 a 300 MB). Si no hay señal, queda guardado en el celular y se sube después.
   - El análisis se hace en el servidor y llega una notificación cuando está listo. Estados: En cola, Analizando, Listo, Con error.
   - Privacidad: después del análisis se borran las imágenes de la nube y del celular; solo se guarda una miniatura de cada hallazgo y su ubicación.
c) Subir grabación: se usa un video que ya se tenga (de celular, dron o GoPro), de hasta 20 minutos.
   - Paso 1 "Subir grabación": se elige la huerta (obligatoria) y el video; la app extrae de 4 a 30 fotos repartidas en el video.
   - Paso 2 "Ubica tus fotos": como el video no trae GPS, el usuario arrastra cada foto a la zona de la huerta de donde viene (zonas A, B, C y D, en un mapa con fondo satelital) o la descarta, y luego la sube.
   - En los resultados, cada hallazgo aparece dentro de su zona.
- "Ver mis escaneos" abre el historial completo.

MIS ESCANEOS
- Mapa con todos los escaneos, recorridos (con su ruta) y grabaciones (con sus zonas de colores).
- Panel con métricas (escaneos, hallazgos, metros recorridos), filtro por huerta y orden por fecha (más recientes o más antiguos).
- Pestañas: Historial, Hallazgos, Fotos y En proceso (escaneos subiéndose o analizándose, con su avance).
- Al tocar un hallazgo se abre su detalle con el diagnóstico, qué es, señales, recomendaciones y cuándo conviene verificarlo. En las grabaciones se muestra "Hallazgos por zona".

MAPEO
- Tarjeta "Tu ubicación" con la ubicación actual.
- "Tus huertas": lista de huertas guardadas con su superficie en hectáreas, y botón "Nueva huerta".
- "Delimita tu huerta": con "Dibujar" se marcan los puntos del contorno sobre el mapa satelital (mínimo 3 puntos). Luego se guarda con un nombre; la app pide permiso para guardar el nombre, contorno, ubicación y superficie de la huerta.
- Se puede editar el contorno, borrar lo dibujado, agregar comentarios a la huerta y eliminar una huerta.

ACTIVIDAD
Pestañas:
- Resumen: salud general, estado de los frutos, volumen por fruto, confianza de la IA y "Acciones recomendadas".
- Escaneos: abre Mis escaneos.
- Historial: los análisis anteriores.
- Plan de trabajo: tareas de la semana para dar seguimiento a cada lote.
Se puede filtrar por huerta.

SATÉLITE ("Lectura del campo")
- Se elige la huerta y se ve sobre imagen satelital.
- Capas: Satélite (con el mapa de vigor NDVI de Sentinel-2 dentro del contorno), Zonas y Relieve. Con la opción Híbrido se agregan calles y nombres.
- NDVI = vigor de la vegetación: colores rojos indican vigor bajo y verdes vigor alto; se muestra el promedio y la fecha de la imagen. Si no hubo una imagen sin nubes en los últimos 75 días, no se puede mostrar.
- Las zonas A–D son una división visual de referencia, no mediciones propias.
- Reportes de análisis satelital de la huerta: estado del cultivo y variables ambientales (precipitación, humedad, nubosidad, viento, temperatura máxima y mínima), con historial de reportes.
- Los colores son rangos generales de interpretación; varían según el cultivo, la etapa y la temporada.

AJUSTES
- Mi perfil: datos de la cuenta, tokens disponibles, cerrar sesión, cambiar contraseña y eliminar la cuenta.
- Aviso de privacidad.
- Compartir ubicación (activada por defecto): se usa para el clima y el mapa de Inicio.
- Idioma de la app: español o inglés.

4. CUENTA, INVITADOS, TOKENS Y PLANES
- Modo invitado: permite probar la app con 25 escaneos de foto individual. Recorrido inteligente, Subir grabación, Mapeo, Actividad y Satélite requieren crear una cuenta.
- Tokens: cada foto analizada consume 100 tokens, sea una foto individual o una foto de un recorrido o grabación. No se cobran las fotos descartadas ni las que el modelo no pudo analizar. Si no hay saldo suficiente, solo se analizan las fotos que alcanza a pagar. Con saldo 0 no se puede iniciar un recorrido ni subir una grabación. Para recargar hay que contactar a VEX.
- Planes (tokens mensuales):
  - Free, $0: 2,500 tokens. Ideal para pequeños productores. 1 huerto registrado, reportes básicos de clima diario, historial básico de análisis y notificaciones.
  - Básico, $1,190: 45,000 tokens. El más popular, ideal para monitoreo intensivo. Análisis con IA (85–90 % de precisión) basado en CNN, historial detallado por árbol y lote, reportes climáticos extendidos, alertas tempranas basadas en clima, acceso a la app móvil y soporte por WhatsApp.
  - Pro Satelital, $4,490: 250,000 tokens. Ideal para uso satelital y multi-lote. Monitoreo satelital EOSDA, análisis avanzado de riesgos climáticos, IA profesional, diagnósticos ilimitados, algoritmo CNN propio en TensorFlow, plataforma web y app móvil, y soporte premium.
  - Los planes se ven en la pantalla "Planes y precios": se abre tocando el indicador de tokens (arriba en Inicio o Escanear) y luego "Ver planes". Ahí se elige el plan y el botón "Contratar plan" lleva a https://vex-mx.com/avotex.html#pricing, donde se contrata.

5. ESTE ASISTENTE
Este chat responde dudas sobre la app y los cultivos. Cada respuesta tiene la opción "Reportar respuesta". Las respuestas son orientativas y pueden tener errores.

6. CONTACTO
- Sitio de AVOTEX: https://vex-mx.com/avotex.html
- Página oficial de VEX: https://www.vexmx.shop/
- Instagram: @avotex.mx — https://www.instagram.com/avotex.mx/

REGLAS
1. Responde solo con la BASE DE CONOCIMIENTOS. No inventes funciones, pantallas, precios, cifras ni fechas. Si algo de la app no está aquí, no lo supongas.
2. Si la pregunta queda fuera de tu base (incluye temas que no son de la app ni de los cultivos), necesita datos de la cuenta del usuario (su saldo, sus escaneos, pagos o facturación), reporta una falla de la app, o pide recargar tokens, cancelar un plan, resolver un cobro o hablar con una persona, responde EXACTAMENTE con: ACTION:CONTACT
   Excepción: si quiere contratar, mejorar o cambiar de plan (por ejemplo "quiero el plan Pro" o "cambiar mi plan a Básico"), NO uses ACTION:CONTACT: explica cómo llegar a "Planes y precios" (indicador de tokens → "Ver planes") y el enlace https://vex-mx.com/avotex.html#pricing.
   Esa respuesta debe ser solo ese texto, sin nada antes ni después.
3. Sobre enfermedades, da solo la información general de la sección 2 (qué es, señales y manejo general). No recomiendes productos, ingredientes activos ni dosis. Si te los piden, NO uses ACTION:CONTACT: responde con el manejo general de la sección 2 y explica que el producto y la dosis los debe indicar un agrónomo o un laboratorio. Recuerda que los resultados de la IA son orientativos.
4. Cuando expliques cómo hacer algo, indica la sección y los botones con sus nombres exactos, en pasos cortos.
5. Sé breve: respuestas de 2 a 6 frases o una lista corta de pasos. Usa listas solo cuando ayuden. No saludes en cada respuesta: ve directo a la respuesta.
6. Si el usuario es invitado o pregunta por una función que requiere cuenta, dilo y sugiere crear una cuenta o ver los planes.
`;

const model = genAI.getGenerativeModel({ model: MODEL });

interface Message {
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

export default function ChatbotScreen() {
  const t = useTranslations(translations);
  const { locale, language } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  // iOS: la isla dinámica / muesca tapa el encabezado si se usa un margen fijo; y sin el inset inferior
  // el campo de texto queda pegado a la barra de inicio.
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const inputBottom = keyboardOpen ? 10 : Math.max(insets.bottom, 12);
  const { width: winW, height: winH } = useWindowDimensions();
  // Alto real de la barra superior: el círculo de arriba nace justo debajo de ella.
  const [headerH, setHeaderH] = useState(insets.top + 52);
  // Una tarjeta completa y ~¾ de la siguiente, como en el boceto (el contenido mide el ancho menos 36 dp de margen).
  const suggestionW = Math.round(Math.max(168, Math.min(260, (Math.min(winW, 1100) - 48) * 0.55)));
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold });

  const [waitingForEmail, setWaitingForEmail] = useState(false);
  const [pendingUserMessage, setPendingUserMessage] = useState("");

  const [modalVisible, setModalVisible] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [userEmail, setUserEmail] = useState(t('chat.guest'));

  useEffect(() => {
    setUserEmail(auth.currentUser?.email || t('chat.guest'));
    return onAuthStateChanged(auth, (currentUser) => {
      setUserEmail(currentUser?.email || t('chat.guest'));
    });
  }, []);

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const handleReportMessage = (messageText: string) => {
    const subject = encodeURIComponent(t('chat.reportSubject'));
    const body = encodeURIComponent(
      t('chat.reportBody', { message: messageText })
    );
    Linking.openURL(`mailto:${REPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() => {});
  };

  const processEmailSending = async (userMessage: string, userEmail: string) => {
    setMessages((prev) => [...prev, {
      role: "bot",
       text: t('chat.sending'),
      timestamp: new Date()
    }]);

    try {
      emailjs.init(EMAILJS_PUBLIC_KEY);
      const templateParams = {
        from_name: 'Usuario de Avotex App',
        user_email: userEmail,
        user_message: userMessage,
        to_email: REPORT_EMAIL,
        reply_to: userEmail,
         date: new Date().toLocaleString(locale, {
          year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }),
      };
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          role: "bot",
           text: t('chat.sent', { email: userEmail }),
          timestamp: new Date()
        };
        return newMessages;
      });
      setWaitingForEmail(false);
      setPendingUserMessage("");
    } catch (error) {
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          role: "bot",
           text: t('chat.sendError', { email: REPORT_EMAIL }),
          timestamp: new Date()
        };
        return newMessages;
      });
      setWaitingForEmail(false);
      setPendingUserMessage("");
    }
  };

  async function sendMessage() {
    if (!accepted) return;
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", text: input, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput("");

    if (waitingForEmail) {
      setLoading(true);
       if (currentInput.toLowerCase() === (language === 'en' ? 'cancel' : 'cancelar')) {
        setWaitingForEmail(false);
        setPendingUserMessage("");
        setMessages((prev) => [...prev, {
          role: "bot",
           text: t('chat.cancelled'),
          timestamp: new Date()
        }]);
      } else if (isValidEmail(currentInput)) {
        await processEmailSending(pendingUserMessage, currentInput.trim());
      } else {
        setMessages((prev) => [...prev, {
          role: "bot",
           text: t('chat.invalidEmail'),
          timestamp: new Date()
        }]);
      }
      setLoading(false);
      return;
    }

    setLoading(true);

    const historyForAPI = messages
       .filter(msg => !msg.text.includes(t('chat.contact')) && !msg.text.includes(t('chat.sending')))
      .map(msg => ({
        role: msg.role === 'bot' ? 'model' : 'user',
        parts: [{ text: msg.text }]
      }));

    try {
      const chat = model.startChat({
        systemInstruction: {
          parts: [{
            text: `${systemInstruction}\n\nIDIOMA DE RESPUESTA\nResponde siempre en ${language === 'en' ? 'inglés' : 'español'}, excepto el marcador exacto ACTION:CONTACT.`,
          }],
          role: "system",
        },
        history: historyForAPI,
      });
      const result = await chat.sendMessage(currentInput);
      const botResponse = result.response.text().trim();

      if (botResponse === "ACTION:CONTACT") {
        setWaitingForEmail(true);
        setPendingUserMessage(currentInput);
        setMessages((prev) => [...prev, {
          role: "bot",
           text: t('chat.contact'),
          timestamp: new Date()
        }]);
      } else {
        setMessages((prev) => [...prev, { role: "bot", text: botResponse, timestamp: new Date() }]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
         { role: "bot", text: t('chat.connection'), timestamp: new Date() },
      ]);
    }
    setLoading(false);
  }

  if (!fontsLoaded) return null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <Stack.Screen
        options={{
          headerShown: false,
           title: t('chat.title'),
          headerTitleStyle: { fontFamily: 'Poppins_600SemiBold' },
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: CHAT.forest,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 10, padding: 5 }}>
              <ChevronLeft size={28} color="#2d6a1f" />
            </TouchableOpacity>
          ),
          headerRight: () => null,
        }}
      />

      {/* ── Disclaimer modal – always shown ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <LinearGradient colors={['#FFFFFF', CHAT.ivory]} style={styles.modalCard}>
            <View style={styles.modalIconRow}>
              <View style={styles.modalIconCircle}>
                <Shield size={24} color={CHAT.forest} />
              </View>
            </View>

             <Text style={styles.modalTitle}>{t('chat.hello')}</Text>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
              persistentScrollbar={true}
            >
              <Text style={styles.modalBody}>
                 {t('chat.modalBody')}
              </Text>

               <Text style={styles.modalSubheading}>{t('chat.before')}</Text>

              <View style={styles.modalBullets}>
                <View style={styles.modalBulletRow}>
                  <Text style={styles.modalBulletDot}>•</Text>
                   <Text style={styles.modalBulletText}>{t('chat.bullet1')}</Text>
                </View>
                <View style={styles.modalBulletRow}>
                  <Text style={styles.modalBulletDot}>•</Text>
                   <Text style={styles.modalBulletText}>{t('chat.bullet2')}</Text>
                </View>
                <View style={styles.modalBulletRow}>
                  <Text style={styles.modalBulletDot}>•</Text>
                   <Text style={styles.modalBulletText}>{t('chat.bullet3')}</Text>
                </View>
                <View style={styles.modalBulletRow}>
                  <Text style={styles.modalBulletDot}>•</Text>
                   <Text style={styles.modalBulletText}>{t('chat.bullet4')}</Text>
                </View>
                <View style={styles.modalBulletRow}>
                  <Text style={styles.modalBulletDot}>•</Text>
                   <Text style={[styles.modalBulletText, styles.modalBold]}>{t('chat.bullet5')}</Text>
                </View>
                <View style={styles.modalBulletRow}>
                  <Text style={styles.modalBulletDot}>•</Text>
                   <Text style={styles.modalBulletText}>{t('chat.bullet6')}</Text>
                </View>
              </View>

              <Text style={styles.modalFootnote}>
                 {t('chat.footnote')}
              </Text>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setModalVisible(false); router.back(); }}
              >
                 <Text style={styles.cancelBtnText}>{t('chat.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={() => { setAccepted(true); setModalVisible(false); }}
              >
                <LinearGradient colors={['#2E6B3E', CHAT.forest]} style={styles.acceptBtnGrad}>
                   <Text style={styles.acceptBtnText}>{t('chat.continue')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>

      {/* Fondo de TODA la pantalla (también detrás del campo de texto): antes terminaba arriba del campo y
          debajo quedaba el blanco del contenedor, cortando el círculo decorativo. */}
      <LinearGradient colors={[CHAT.ivory, '#F3F5E8', CHAT.ivory]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {/* Dos círculos de vidrio recortados por los bordes, con destellos lima (decorativos). */}
      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
        <GlassOrb id="orbTop" cx={winW * 0.19} cy={headerH - winW * 0.105} r={winW * 0.39} lightAngle={70}
          glints={[{ angle: 113, span: 34 }, { angle: 18, span: 22, power: 0.7 }]} />
        <GlassOrb id="orbBottom" cx={winW * 0.81} cy={winH + winW * 0.072} r={winW * 0.545} lightAngle={-110}
          glints={[{ angle: -100, span: 30 }, { angle: -142, span: 20, power: 0.65 }]} />
      </View>
      <View style={styles.background}>
      {!modalVisible && (
        <View style={[styles.persistentHeader, { paddingTop: insets.top + 8 }]} onLayout={e => setHeaderH(e.nativeEvent.layout.height)}>
          <TouchableOpacity onPress={() => router.back()} accessibilityLabel={t('chat.back')} style={styles.backButton}>
            <ChevronLeft size={22} color={CHAT.forest} />
          </TouchableOpacity>
          <Text style={styles.persistentHeaderTitle}>{t('chat.title')}</Text>
        </View>
      )}
      <ScrollView
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        ref={scrollViewRef}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
      >
        {messages.length === 0 && !modalVisible && (
          <View style={styles.welcomeContainer}>
            <View style={styles.profileHeader}>
              <View style={styles.userCircle}><User size={17} color={CHAT.forest} /></View>
              <View>
                 <Text style={styles.welcomeLabel}>{t('chat.welcome')}</Text>
                <Text style={styles.emailLabel} numberOfLines={1}>{userEmail}</Text>
              </View>
            </View>
             <Text style={styles.welcomeTitle}>{t('chat.discover')}</Text>
            <Text style={styles.welcomeSubtitle}>
               {t('chat.subtitle')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll} contentContainerStyle={styles.suggestions}>
               {[t('chat.s1'), t('chat.s2'), t('chat.s3')].map((suggestion) => (
                <TouchableOpacity key={suggestion} style={[styles.suggestionCard, { width: suggestionW }]} onPress={() => setInput(suggestion)} activeOpacity={0.8}>
                  {/* Cristal: reflejo cerca de la arista superior. */}
                  <LinearGradient pointerEvents="none" colors={['rgba(255,253,242,0.85)', 'rgba(255,253,242,0)']} locations={[0, 0.45]} style={styles.glassSheen} />
                  <Sparkles size={17} color={CHAT.forest} strokeWidth={2.2} />
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {messages.map((m, i) => (
          <View key={i} style={[styles.messageRow, m.role === 'user' && styles.messageRowUser]}>
            {m.role === 'bot' && <View style={styles.botAvatar}><Bot size={17} color={CHAT.forest} /></View>}
            <View style={styles.messageBubbleWrapper}>
              <View style={[styles.messageBubble, m.role === "user" ? styles.userMsg : styles.botMsg]}>
                <Text style={m.role === 'user' ? styles.userMsgText : styles.botMsgText}>{m.text}</Text>
              </View>
              {m.role === 'bot' && (
                <TouchableOpacity
                  style={styles.reportBtn}
                  onPress={() => handleReportMessage(m.text)}
                  activeOpacity={0.7}
                >
                  <Flag size={11} color={CHAT.muted} />
                   <Text style={styles.reportBtnText}>{t('chat.report')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        {loading && (
          <View style={styles.messageRow}>
            <View style={styles.botAvatar}><Bot size={17} color={CHAT.forest} /></View>
            <View style={[styles.messageBubble, styles.botMsg]}>
              <ActivityIndicator color={CHAT.muted} />
            </View>
          </View>
        )}
      </ScrollView>
      </View>

      {messages.length === 0 && !modalVisible && (
        <View style={[styles.inputContainer, styles.initialInput, { marginBottom: inputBottom }, !accepted && styles.inputContainerDisabled]}>
          <LinearGradient pointerEvents="none" colors={['rgba(255,253,242,0.9)', 'rgba(255,253,242,0)']} locations={[0, 0.5]} style={styles.glassSheen} />
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={!accepted ? t('chat.accept') : waitingForEmail ? t('chat.email') : t('chat.ask')}
            placeholderTextColor={CHAT.muted}
            style={[styles.input, styles.initialInputText, !accepted && styles.inputDisabled]}
            onSubmitEditing={sendMessage}
            multiline={!waitingForEmail}
            keyboardType={waitingForEmail ? "email-address" : "default"}
            autoCapitalize={waitingForEmail ? "none" : "sentences"}
            editable={accepted}
          />
          <View style={styles.initialControls}>
            <Text style={styles.inputHint}>{t('chat.hint')}</Text>
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={accepted ? sendMessage : () => setModalVisible(true)}
              disabled={loading}
            >
              {!accepted
                ? <View style={styles.sendBtnPlain}><Shield size={20} color={CHAT.forest} /></View>
                : <View style={styles.sendBtnGradient}><Send size={19} color={CHAT.forest} /></View>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {messages.length > 0 && <View style={[styles.inputContainer, { marginBottom: inputBottom }, !accepted && styles.inputContainerDisabled]}>
        <TextInput
          value={input}
          onChangeText={setInput}
           placeholder={!accepted ? t('chat.accept') : waitingForEmail ? t('chat.email') : t('chat.write')}
          placeholderTextColor={CHAT.muted}
          style={[styles.input, !accepted && styles.inputDisabled]}
          onSubmitEditing={sendMessage}
          multiline={!waitingForEmail}
          keyboardType={waitingForEmail ? "email-address" : "default"}
          autoCapitalize={waitingForEmail ? "none" : "sentences"}
          editable={accepted}
        />

        <TouchableOpacity
          style={styles.sendBtn}
          onPress={accepted ? sendMessage : () => setModalVisible(true)}
          disabled={loading}
        >
          {!accepted ? (
            <View style={styles.sendBtnPlain}>
              <Shield size={22} color={CHAT.forest} />
            </View>
          ) : (
            <View style={styles.sendBtnGradient}>
              <Send size={20} color={CHAT.forest} />
            </View>
          )}
        </TouchableOpacity>
      </View>}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CHAT.ivory },
  background: { flex: 1 },
  chatArea: { flex: 1, backgroundColor: 'transparent' },
  chatContent: { padding: 18, paddingBottom: 20, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  persistentHeader: {
    paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row',
    alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(16,56,36,0.06)',
    backgroundColor: CHAT.ivory, zIndex: 10,
  },
  persistentHeaderTitle: { color: CHAT.forest, fontFamily: 'Poppins_600SemiBold', fontSize: 17 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(1, 8, 6, 0.96)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
    elevation: 100,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: CHAT.sage,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 16,
    width: '100%',
    maxWidth: 420,
    maxHeight: '72%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 101,
    zIndex: 10000,
  },
  modalScroll: {
    maxHeight: 280,
  },
  modalScrollContent: {
    paddingBottom: 4,
  },
  modalIconRow: {
    alignItems: 'center',
    marginBottom: 14,
  },
  modalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: CHAT.sage,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 20,
    color: CHAT.forest,
    textAlign: 'center',
    marginBottom: 10,
  },
  modalBody: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: CHAT.muted,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 14,
  },
  modalSubheading: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: CHAT.forest,
    marginBottom: 10,
  },
  modalBullets: {
    marginBottom: 14,
    gap: 7,
  },
  modalBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  modalBulletDot: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: CHAT.forest,
    marginRight: 7,
    marginTop: 1,
  },
  modalBulletText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: CHAT.muted,
    flex: 1,
    lineHeight: 18,
  },
  modalBold: {
    fontFamily: 'Poppins_600SemiBold',
    color: CHAT.forest,
  },
  modalFootnote: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: CHAT.muted,
    textAlign: 'center',
    marginBottom: 18,
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: CHAT.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: CHAT.muted,
  },
  acceptBtn: {
    flex: 1,
    borderRadius: 50,
    overflow: 'hidden',
  },
  acceptBtnGrad: {
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: '#ffffff',
  },

  welcomeContainer: {
    alignItems: 'flex-start',
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 6,
  },
  profileHeader: {
    flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 92,
  },
  backButton: {
    width: 32, height: 32, borderRadius: 16, justifyContent: 'center',
    alignItems: 'center', marginRight: 8, backgroundColor: 'transparent',
  },
  userCircle: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,253,242,0.85)',
    justifyContent: 'center', alignItems: 'center', marginRight: 9,
    borderWidth: 1, borderColor: CHAT.warmWhite,
    shadowColor: '#7E9566', shadowOpacity: 0.16, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  welcomeLabel: {
    color: CHAT.forest, fontFamily: 'Poppins_600SemiBold', fontSize: 12,
  },
  emailLabel: {
    color: CHAT.muted, fontFamily: 'Poppins_400Regular', fontSize: 10,
    maxWidth: 230,
  },
  suggestions: {
    paddingRight: 8, gap: 10,
  },
  suggestionsScroll: {
    width: '100%', marginTop: 24, marginBottom: 10,
  },
  suggestionCard: {
    width: 176, height: 112, justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 15, paddingHorizontal: 14, borderRadius: 16,
    // Cristal: marfil translúcido con tinte salvia, borde fino blanco cálido y sombra difusa abajo.
    backgroundColor: 'rgba(233,239,215,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,253,242,0.95)',
    shadowColor: '#7E9566', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 2,
    overflow: 'hidden',
  },
  glassSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '100%' },
  suggestionText: {
    color: CHAT.forest,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13, lineHeight: 18,
  },
  welcomeTitle: {
    fontSize: 35,
    fontFamily: 'Poppins_600SemiBold',
    color: CHAT.forest,
    marginBottom: 8, letterSpacing: -1.4, lineHeight: 40,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: CHAT.muted,
    textAlign: 'left',
    fontFamily: 'Poppins_400Regular',
    lineHeight: 22,
  },
  initialInput: {
    minHeight: 92, marginHorizontal: 12, marginTop: 8,
    borderRadius: 22, paddingHorizontal: 17, paddingTop: 12, paddingBottom: 10,
    alignItems: 'stretch', flexDirection: 'column',
    // Vidrio esmerilado claro, con más contraste que las sugerencias.
    backgroundColor: 'rgba(250,250,242,0.78)',
    borderColor: 'rgba(255,253,242,1)', borderWidth: 1.5,
    shadowColor: '#7E9566', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4,
    overflow: 'hidden',
  },
  initialInputText: {
    minHeight: 44, maxHeight: 100, textAlignVertical: 'top', paddingHorizontal: 0,
  },
  initialControls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  inputHint: {
    color: CHAT.muted, fontFamily: 'Poppins_400Regular', fontSize: 10,
  },

  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  botAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
    marginBottom: 2,
    backgroundColor: CHAT.sage,
    borderWidth: 1,
    borderColor: CHAT.warmWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubbleWrapper: {
    maxWidth: '78%',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  userMsg: {
    backgroundColor: CHAT.forest,
    borderWidth: 1,
    borderColor: CHAT.forest,
    borderBottomRightRadius: 4,
  },
  botMsg: {
    backgroundColor: 'rgba(255,253,242,0.92)',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: CHAT.sage,
  },
  userMsgText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
  },
  botMsgText: {
    color: CHAT.forest,
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingLeft: 4,
  },
  reportBtnText: {
    fontSize: 11,
    color: CHAT.muted,
    fontFamily: 'Poppins_400Regular',
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    margin: 14,
    backgroundColor: 'rgba(250,250,242,0.86)',
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: CHAT.warmWhite,
    shadowColor: '#7E9566',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 3,
  },
  inputContainerDisabled: {
    backgroundColor: 'rgba(233,239,215,0.6)',
    borderColor: 'rgba(255,253,242,0.9)',
  },
  input: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    color: CHAT.forest,
    maxHeight: 100,
  },
  inputDisabled: {
    color: CHAT.muted,
  },
  sendBtn: {
    marginLeft: 6,
  },
  sendBtnGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: CHAT.lime,
    shadowColor: '#7FB01A', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  sendBtnPlain: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
