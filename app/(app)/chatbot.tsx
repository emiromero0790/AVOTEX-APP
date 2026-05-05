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
  Image,
  Modal,
  Linking,
} from "react-native";
import { Stack, router } from "expo-router";
import { ChevronLeft, Send, Shield, Flag } from "lucide-react-native";
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

const systemInstruction = `🎯 ROL
Eres "Avotex", la mascota oficial de Avotex. Eres un asistente de IA amigable, servicial y experto en la aplicación Avotex. Tu propósito es ayudar a los usuarios a entender la app y sus funciones.

🧠 BASE DE CONOCIMIENTOS (Knowledge Base)
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

📜 REGLAS
Tu conocimiento es LIMITADO: Solo puedes responder usando la "BASE DE CONOCIMIENTOS".
Si el usuario pregunta algo fuera de tu base, responde EXACTAMENTE con: "ACTION:CONTACT"
Sé amigable y usa emojis 🌱😉📲🍃 cuando sea apropiado.
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
      text: "📧 Enviando tu consulta al equipo de VEX...",
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
          text: `✅ ¡Perfecto! Tu consulta ha sido enviada.\n\nTe responderán pronto a: ${userEmail} 📧\n\n¿Hay algo más en lo que pueda ayudarte?`,
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
          text: `❌ Hubo un problema al enviar el correo.\n\nContacta directamente a:\n📧 ${REPORT_EMAIL}`,
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
          text: "Entendido. ¿En qué más puedo ayudarte? 🌱",
          timestamp: new Date()
        }]);
      } else if (isValidEmail(currentInput)) {
        await processEmailSending(pendingUserMessage, currentInput.trim());
      } else {
        setMessages((prev) => [...prev, {
          role: "bot",
          text: "❌ Correo no válido. Intenta de nuevo o escribe 'cancelar'.",
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
          text: "Para esa consulta necesito conectarte con el equipo. 📧\n\nPor favor escribe tu correo electrónico aquí (o escribe 'cancelar').",
          timestamp: new Date()
        }]);
      } else {
        setMessages((prev) => [...prev, { role: "bot", text: botResponse, timestamp: new Date() }]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: "Error de conexión. Intenta de nuevo. 😓", timestamp: new Date() },
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
          headerStyle: { backgroundColor: '#fafff7' },
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
          <View style={styles.modalCard}>
            <View style={styles.modalIconRow}>
              <View style={styles.modalIconCircle}>
                <Shield size={28} color="#0f766e" />
              </View>
            </View>

            <Text style={styles.modalTitle}>🌱 ¡Hola! Soy Avotex</Text>

            <Text style={styles.modalBody}>
              Soy un asistente inteligente impulsado por Inteligencia Artificial diseñado para ayudarte a entender el estado de tus cultivos y sacarle el máximo provecho a la app 📲
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
                <Text style={styles.modalBulletText}>Puedo utilizar información como imágenes capturadas y tu ubicación para ofrecer resultados más precisos 🌍</Text>
              </View>
              <View style={styles.modalBulletRow}>
                <Text style={styles.modalBulletDot}>•</Text>
                <Text style={styles.modalBulletText}>Tu información puede ser procesada por servicios externos (como clima o mapas) únicamente para el funcionamiento de la app</Text>
              </View>
              <View style={styles.modalBulletRow}>
                <Text style={styles.modalBulletDot}>•</Text>
                <Text style={[styles.modalBulletText, styles.modalBold]}>No vendemos ni compartimos tu información personal con terceros con fines comerciales 🔒</Text>
              </View>
              <View style={styles.modalBulletRow}>
                <Text style={styles.modalBulletDot}>•</Text>
                <Text style={styles.modalBulletText}>Aunque estoy diseñado para ayudarte, <Text style={styles.modalBold}>puedo cometer errores</Text></Text>
              </View>
            </View>

            <Text style={styles.modalFootnote}>
              Al continuar, aceptas usar este asistente bajo tu propia responsabilidad 😉
            </Text>

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
          </View>
        </View>
      </Modal>

      <ScrollView
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        ref={scrollViewRef}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && (
          <View style={styles.welcomeContainer}>
            <LinearGradient
              colors={['#eef7e8', '#dff2e3']}
              style={styles.logoWrapper}
            >
              <Image
                source={require('../../assets/images/AvotexNuevoLogo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </LinearGradient>
            <Text style={styles.welcomeTitle}>Asistente Avotex</Text>
            <Text style={styles.welcomeSubtitle}>
              ¡Hola! Soy tu aliado en el cultivo. ¿En qué te ayudo hoy? 🌱
            </Text>
          </View>
        )}

        {messages.map((m, i) => (
          <View key={i} style={[styles.messageRow, m.role === 'user' && styles.messageRowUser]}>
            {m.role === 'bot' && (
              <Image
                source={require('../../assets/images/AvotexNuevoLogo.png')}
                style={styles.botAvatar}
              />
            )}
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
            <Image
              source={require('../../assets/images/AvotexNuevoLogo.png')}
              style={styles.botAvatar}
            />
            <View style={[styles.messageBubble, styles.botMsg]}>
              <ActivityIndicator color="#3aaa5c" />
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
            <LinearGradient
              colors={input.trim().length > 0 ? ['#4fc46a', '#2da84a'] : ['#d4ecc8', '#b8ddb0']}
              style={styles.sendBtnGradient}
            >
              <Send size={20} color="#ffffff" />
            </LinearGradient>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafff7" },
  chatArea: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 20 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 12,
  },
  modalIconRow: {
    alignItems: 'center',
    marginBottom: 14,
  },
  modalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 20,
    color: '#0f766e',
    textAlign: 'center',
    marginBottom: 10,
  },
  modalBody: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 14,
  },
  modalSubheading: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: '#134e4a',
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
    color: '#334155',
    flex: 1,
    lineHeight: 18,
  },
  modalBold: {
    fontFamily: 'Poppins_600SemiBold',
    color: '#134e4a',
  },
  modalFootnote: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: '#64748b',
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
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: '#64748b',
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
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  logoWrapper: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#2d6a1f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  logo: {
    width: 200,
    height: 80,
    resizeMode: 'contain',
  },
  welcomeTitle: {
    fontSize: 22,
    fontFamily: 'Poppins_600SemiBold',
    color: '#2d6a1f',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: '#6b8a5e',
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
    resizeMode: 'contain',
    backgroundColor: '#eef7e8',
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
    backgroundColor: "#3aaa5c",
    borderBottomRightRadius: 4,
  },
  botMsg: {
    backgroundColor: "#f0f7ec",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#d4ecc8',
  },
  userMsgText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
  },
  botMsgText: {
    color: "#1a2e0a",
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
    color: '#94a3b8',
    fontFamily: 'Poppins_400Regular',
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    margin: 14,
    backgroundColor: '#f0f7ec',
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: '#c8dfc0',
    shadowColor: '#2d6a1f',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  inputContainerDisabled: {
    backgroundColor: '#f5f5f5',
    borderColor: '#dde',
  },
  input: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    color: '#1a2e0a',
    maxHeight: 100,
  },
  inputDisabled: {
    color: '#aaa',
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
  },
  sendBtnPlain: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
