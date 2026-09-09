import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Modal,
  Linking,
} from "react-native";
import { Stack, router } from "expo-router";
import { ChevronLeft, Send, Shield, Flag, Sparkles, Bot } from "lucide-react-native";
import { useFonts, Poppins_400Regular, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { GoogleGenerativeAI } from '@google/generative-ai';
import emailjs from '@emailjs/browser';
import { LinearGradient } from 'expo-linear-gradient';

const EMAILJS_SERVICE_ID = process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID!;
const EMAILJS_TEMPLATE_ID = process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID!;
const EMAILJS_PUBLIC_KEY = process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY!;
const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY!;
const MODEL = "gemini-2.5-flash";
const REPORT_EMAIL = 'vexmxoficial@gmail.com';

const genAI = new GoogleGenerativeAI(API_KEY);

const systemInstruction = `ROL
Eres "Avotex", la mascota oficial de Avotex. Eres un asistente de IA amigable, servicial y experto en la aplicación Avotex. Tu propósito es ayudar a los usuarios a entender la app y sus funciones.

BASE DE CONOCIMIENTOS (Knowledge Base)
Aquí está la única información que conoces:

Sección 1: Sobre Nosotros (VEX y Avotex) VEX es una empresa innovadora enfocada en el desarrollo de soluciones tecnológicas prácticas. Su producto principal es Avotex, una aplicación móvil diseñada específicamente para el sector agroindustrial. Avotex funciona como un asistente inteligente que utiliza Inteligencia Artificial para analizar imágenes de frutos y cultivos, permitiendo detectar enfermedades de forma temprana, precisa y económica. La aplicación está diseñada para ser una herramienta accesible tanto para pequeños productores como para grandes agroindustrias. Este proyecto fue desarrollado por Bruno Leonardo Parra Fernandez y Emiliano Romero García, con la asesoría de Aurelio Amaury Coria Ramírez del Instituto Tecnológico de Morelia.

Sección 2: Funcionamiento de la Aplicación La app se organiza en cinco secciones clave: Inicio, Escanear, Mapeo, Resultados y Medidas.

Inicio (Dashboard): La pantalla de Inicio es el centro de mando principal. Al ingresar, recibe al usuario con un saludo personalizado. Presenta datos en tiempo real cruciales para el agricultor, como el clima local (temperatura y humedad) y un mapa con la ubicación GPS del dispositivo. También muestra un porcentaje general de la salud del cultivo, calculado a partir de los escaneos del usuario.

Escanear (Detección con IA): La función Escanear es el núcleo de Avotex. Utiliza la cámara del dispositivo para tomar fotos de frutos y cultivos. Cada foto es enviada a un servicio de Inteligencia Artificial que la analiza y devuelve un diagnóstico en segundos junto con un porcentaje de confianza.

Mapeo (Visualización del Cultivo): La sección de Mapeo ofrece vistas geográficas para delimitar lotes y visualizar el estado de salud por zonas.

Resultados (Historial y Gráficas): Muestra el historial de escaneos con estadísticas y gráficas interactivas.

Medidas (Recomendaciones y Agenda): Genera recomendaciones personalizadas basadas en los escaneos y permite gestionar tareas personales.

Sección 3: Tecnología El motor de diagnóstico es una Red Neuronal Convolucional (CNN) desplegada en la nube. Se usa Firebase para autenticación y Supabase como base de datos principal.

Sección 4: Contacto
Página Oficial: https://www.vexmx.shop/
Instagram: @avotex.mx — https://www.instagram.com/avotex.mx/

REGLAS
Tu conocimiento es LIMITADO: Solo puedes responder usando la "BASE DE CONOCIMIENTOS".
Si el usuario pregunta algo fuera de tu base, responde EXACTAMENTE con: "ACTION:CONTACT"
Sé amigable, claro y práctico.
No inventes respuestas.
`;

const model = genAI.getGenerativeModel({ model: MODEL });

interface Message {
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

export default function ChatbotScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold });

  const [waitingForEmail, setWaitingForEmail] = useState(false);
  const [pendingUserMessage, setPendingUserMessage] = useState("");

  const [modalVisible, setModalVisible] = useState(true);
  const [accepted, setAccepted] = useState(false);

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const handleReportMessage = (messageText: string) => {
    const subject = encodeURIComponent('Reporte de respuesta — Asistente Avotex');
    const body = encodeURIComponent(
      `Hola equipo VEX,\n\nQuiero reportar la siguiente respuesta del asistente:\n\n"${messageText}"\n\nMotivo del reporte: [describe aquí el problema]\n\nGracias.`
    );
    Linking.openURL(`mailto:${REPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() => {});
  };

  const processEmailSending = async (userMessage: string, userEmail: string) => {
    setMessages((prev) => [...prev, {
      role: "bot",
      text: "Enviando tu consulta al equipo de VEX...",
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
        date: new Date().toLocaleString('es-MX', {
          year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }),
      };
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          role: "bot",
          text: `Perfecto. Tu consulta ha sido enviada.\n\nTe responderán pronto a: ${userEmail}\n\n¿Hay algo más en lo que pueda ayudarte?`,
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
          text: `Hubo un problema al enviar el correo.\n\nContacta directamente a:\n${REPORT_EMAIL}`,
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
      if (currentInput.toLowerCase() === 'cancelar') {
        setWaitingForEmail(false);
        setPendingUserMessage("");
        setMessages((prev) => [...prev, {
          role: "bot",
          text: "Entendido. ¿En qué más puedo ayudarte?",
          timestamp: new Date()
        }]);
      } else if (isValidEmail(currentInput)) {
        await processEmailSending(pendingUserMessage, currentInput.trim());
      } else {
        setMessages((prev) => [...prev, {
          role: "bot",
          text: "Correo no válido. Intenta de nuevo o escribe 'cancelar'.",
          timestamp: new Date()
        }]);
      }
      setLoading(false);
      return;
    }

    setLoading(true);

    const historyForAPI = messages
      .filter(msg => !msg.text.includes("Para enviarte una respuesta") && !msg.text.includes("Enviando tu consulta"))
      .map(msg => ({
        role: msg.role === 'bot' ? 'model' : 'user',
        parts: [{ text: msg.text }]
      }));

    try {
      const chat = model.startChat({
        systemInstruction: { parts: [{ text: systemInstruction }], role: "system" },
        history: historyForAPI,
      });
      const result = await chat.sendMessage(currentInput);
      const botResponse = result.response.text().trim();

      if (botResponse === "ACTION:CONTACT") {
        setWaitingForEmail(true);
        setPendingUserMessage(currentInput);
        setMessages((prev) => [...prev, {
          role: "bot",
          text: "Para esa consulta necesito conectarte con el equipo.\n\nPor favor escribe tu correo electrónico aquí (o escribe 'cancelar').",
          timestamp: new Date()
        }]);
      } else {
        setMessages((prev) => [...prev, { role: "bot", text: botResponse, timestamp: new Date() }]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: "Error de conexión. Intenta de nuevo.", timestamp: new Date() },
      ]);
    }
    setLoading(false);
  }

  if (!fontsLoaded) return null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={100}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Asistente Avotex",
          headerTitleStyle: { fontFamily: 'Poppins_600SemiBold' },
          headerStyle: { backgroundColor: '#071713' },
          headerTintColor: '#d7fff3',
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
          <LinearGradient colors={['#071712', '#0A241D']} style={styles.modalCard}>
            <View style={styles.modalIconRow}>
              <View style={styles.modalIconCircle}>
                <Shield size={24} color="#79d7c1" />
              </View>
            </View>

            <Text style={styles.modalTitle}>¡Hola! Soy Avotex</Text>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
              persistentScrollbar={true}
            >
              <Text style={styles.modalBody}>
                Soy un asistente inteligente impulsado por Inteligencia Artificial diseñado para ayudarte a entender el estado de tus cultivos y sacarle el máximo provecho a la app.
              </Text>

              <Text style={styles.modalSubheading}>Antes de continuar, toma en cuenta lo siguiente:</Text>

              <View style={styles.modalBullets}>
                <View style={styles.modalBulletRow}>
                  <Text style={styles.modalBulletDot}>•</Text>
                  <Text style={styles.modalBulletText}>Mis respuestas se basan en el análisis de imágenes, datos de la app y mi base de conocimientos</Text>
                </View>
                <View style={styles.modalBulletRow}>
                  <Text style={styles.modalBulletDot}>•</Text>
                  <Text style={styles.modalBulletText}>Los diagnósticos y recomendaciones son <Text style={styles.modalBold}>orientativos</Text> y no sustituyen la asesoría de un especialista agrícola</Text>
                </View>
                <View style={styles.modalBulletRow}>
                  <Text style={styles.modalBulletDot}>•</Text>
                  <Text style={styles.modalBulletText}>Puedo utilizar información como imágenes capturadas y tu ubicación para ofrecer resultados más precisos.</Text>
                </View>
                <View style={styles.modalBulletRow}>
                  <Text style={styles.modalBulletDot}>•</Text>
                  <Text style={styles.modalBulletText}>Tu información puede ser procesada por servicios externos únicamente para el funcionamiento de la app</Text>
                </View>
                <View style={styles.modalBulletRow}>
                  <Text style={styles.modalBulletDot}>•</Text>
                  <Text style={[styles.modalBulletText, styles.modalBold]}>No vendemos ni compartimos tu información personal con terceros con fines comerciales.</Text>
                </View>
                <View style={styles.modalBulletRow}>
                  <Text style={styles.modalBulletDot}>•</Text>
                  <Text style={styles.modalBulletText}>Aunque estoy diseñado para ayudarte, <Text style={styles.modalBold}>puedo cometer errores</Text></Text>
                </View>
              </View>

              <Text style={styles.modalFootnote}>
                Al continuar, aceptas usar este asistente bajo tu propia responsabilidad.
              </Text>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setModalVisible(false); router.back(); }}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={() => { setAccepted(true); setModalVisible(false); }}
              >
                <LinearGradient colors={['#34d399', '#0f766e']} style={styles.acceptBtnGrad}>
                  <Text style={styles.acceptBtnText}>Continuar</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>

      <ScrollView
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        ref={scrollViewRef}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && !modalVisible && (
          <View style={styles.welcomeContainer}>
            <View style={styles.aiOrb}>
              <View style={styles.aiOrbGlow} />
              <LinearGradient colors={['#b8ffe9', '#24c99a', '#075747']} style={styles.aiOrbCore} />
              <View style={styles.aiOrbShine} />
            </View>
            <View style={styles.welcomeEyebrow}><Sparkles size={14} color="#79d7c1" /><Text style={styles.eyebrowText}>INTELIGENCIA PARA TU CAMPO</Text></View>
            <Text style={styles.welcomeTitle}>¿Qué cultivamos hoy?</Text>
            <Text style={styles.welcomeSubtitle}>
              Pregunta sobre la app, tus cultivos o el siguiente paso.
            </Text>
            <View style={styles.suggestions}>
              {['¿Cómo funciona Escanear?', '¿Qué muestra Mapeo?', 'Ayúdame con una recomendación'].map((suggestion) => (
                <TouchableOpacity key={suggestion} style={styles.suggestionCard} onPress={() => setInput(suggestion)} activeOpacity={0.8}>
                  <Sparkles size={14} color="#79d7c1" />
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {messages.map((m, i) => (
          <View key={i} style={[styles.messageRow, m.role === 'user' && styles.messageRowUser]}>
            {m.role === 'bot' && <View style={styles.botAvatar}><Bot size={17} color="#79d7c1" /></View>}
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
                  <Flag size={11} color="#94a3b8" />
                  <Text style={styles.reportBtnText}>Reportar respuesta</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        {loading && (
          <View style={styles.messageRow}>
            <View style={styles.botAvatar}><Bot size={17} color="#79d7c1" /></View>
            <View style={[styles.messageBubble, styles.botMsg]}>
              <ActivityIndicator color="#79d7c1" />
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.inputContainer, !accepted && styles.inputContainerDisabled]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={!accepted ? "Acepta los términos para escribir..." : waitingForEmail ? "Escribe tu correo..." : "Escribe algo..."}
          placeholderTextColor="#aaa"
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
              <Shield size={22} color="#0f766e" />
            </View>
          ) : (
            <View style={styles.sendBtnGradient}>
              <Send size={20} color="#ffffff" />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#030b09" },
  chatArea: { flex: 1, backgroundColor: '#030b09' },
  chatContent: { padding: 18, paddingBottom: 20, maxWidth: 760, width: '100%', alignSelf: 'center' },

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
    backgroundColor: '#071712',
    borderWidth: 1,
    borderColor: '#287563',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 16,
    width: '100%',
    maxWidth: 420,
    maxHeight: '72%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
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
    backgroundColor: '#103b32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 20,
    color: '#d7fff3',
    textAlign: 'center',
    marginBottom: 10,
  },
  modalBody: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: '#b6d4cc',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 14,
  },
  modalSubheading: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: '#d7fff3',
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
    color: '#0f766e',
    marginRight: 7,
    marginTop: 1,
  },
  modalBulletText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: '#b6d4cc',
    flex: 1,
    lineHeight: 18,
  },
  modalBold: {
    fontFamily: 'Poppins_600SemiBold',
    color: '#79d7c1',
  },
  modalFootnote: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: '#8aada4',
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
    borderColor: '#285449',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: '#9abbb2',
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
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  aiOrb: {
    width: 178,
    height: 178,
    borderRadius: 89,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    backgroundColor: '#0b3c31',
    shadowColor: '#22c99b',
    shadowOpacity: 0.42,
    shadowRadius: 38,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  aiOrbGlow: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: '#0d6d55',
    opacity: 0.22,
  },
  aiOrbCore: {
    width: 130,
    height: 130,
    borderRadius: 65,
    transform: [{ rotate: '-18deg' }],
  },
  aiOrbShine: {
    position: 'absolute',
    width: 46,
    height: 26,
    borderRadius: 26,
    backgroundColor: '#d7fff3',
    opacity: 0.5,
    top: 44,
    left: 54,
    transform: [{ rotate: '-30deg' }],
  },
  welcomeEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },
  eyebrowText: {
    color: '#79d7c1',
    fontSize: 10,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 1.2,
  },
  suggestions: {
    width: '100%',
    marginTop: 25,
    gap: 9,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 15,
    backgroundColor: 'rgba(13, 41, 35, 0.82)',
    borderWidth: 1,
    borderColor: '#1d594c',
  },
  suggestionText: {
    color: '#c1e7dd',
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    flex: 1,
  },
  logoWrapper: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    backgroundColor: 'transparent',
    shadowColor: '#2dd4a4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  logo: {
    width: 200,
    height: 80,
  },
  welcomeTitle: {
    fontSize: 34,
    fontFamily: 'Poppins_600SemiBold',
    color: '#e1fff5',
    marginBottom: 8,
    letterSpacing: -1.2,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: '#8fb7ad',
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
    lineHeight: 22,
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
    backgroundColor: '#103b32',
    borderWidth: 1,
    borderColor: '#2b8f78',
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
    backgroundColor: "#143b32",
    borderWidth: 1,
    borderColor: '#287a67',
    borderBottomRightRadius: 4,
  },
  botMsg: {
    backgroundColor: "#0d2923",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#1d594c',
  },
  userMsgText: {
    color: "#bfffee",
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
  },
  botMsgText: {
    color: "#d0e8e1",
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
    color: '#71938b',
    fontFamily: 'Poppins_400Regular',
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    margin: 14,
    backgroundColor: '#081914',
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: '#236052',
    shadowColor: '#1bb98e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  inputContainerDisabled: {
    backgroundColor: '#0b211c',
    borderColor: '#173e35',
  },
  input: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    color: '#d7fff3',
    maxHeight: 100,
  },
  inputDisabled: {
    color: '#58756d',
  },
  sendBtn: {
    marginLeft: 6,
  },
  sendBtnGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#27c79b',
  },
  sendBtnPlain: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
