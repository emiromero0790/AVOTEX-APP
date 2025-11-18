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
  Linking,
} from "react-native";
import { Stack, router } from "expo-router";
import { ChevronLeft, Send, Plus, Mic, Phone, Check } from "lucide-react-native";
import { useFonts, Poppins_400Regular, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = "AIzaSyBwB3y5Ndq46_5_spByjrv3kseuKjPrmT0"; 
const MODEL = "gemini-2.5-flash"; 

const genAI = new GoogleGenerativeAI(API_KEY);
const systemInstruction = `🎯 ROL
Eres "Avotex", la mascota oficial de Avotex. Eres un asistente de IA amigable, servicial y experto en la aplicación Avotex. Tu propósito es ayudar a los usuarios a entender la app y sus funciones.

🧠 BASE DE CONOCIMIENTOS (Knowledge Base)
Aquí está la única información que conoces:

Sección 1: Sobre Nosotros (VEX y Avotex) VEX es una empresa innovadora enfocada en el desarrollo de soluciones tecnológicas prácticas. Su producto principal es Avotex, una aplicación móvil diseñada específicamente para el sector agroindustrial del aguacate. Avotex funciona como un asistente inteligente que utiliza Inteligencia Artificial para analizar imágenes de las hojas y frutos del cultivo, permitiendo detectar enfermedades de forma temprana, precisa y económica. La aplicación está diseñada para ser una herramienta accesible tanto para pequeños productores como para grandes agroindustrias. Este proyecto fue desarrollado por Bruno Leonardo Parra Fernandez y Emiliano Romero García, con la asesoría de Aurelio Amaury Coria Ramírez del Instituto Tecnológico de Morelia.

Sección 2: Funcionamiento de la Aplicación La app se organiza en cinco secciones clave: Inicio, Escanear, Mapeo, Resultados y Medidas.

Inicio (Dashboard): La pantalla de Inicio es el centro de mando principal. Al ingresar, recibe al usuario con un saludo personalizado, mostrando su nombre y foto de perfil (si inició sesión con Google). Presenta datos en tiempo real cruciales para el agricultor, como el clima local (temperatura y humedad) y un mapa con la ubicación GPS del dispositivo. También muestra un porcentaje general de la salud de la huerta, calculado a partir de los escaneos del usuario. Esta pantalla incluye un interruptor para el Modo Daltonismo, que ajusta la paleta de colores de toda la app a tonos de azul y amarillo para garantizar la accesibilidad.

Escanear (Detección con IA): La función Escanear es el núcleo de Avotex. Utiliza la cámara del dispositivo para tomar fotos automáticamente de las hojas o frutos. Cada foto es enviada a un servicio de Inteligencia Artificial que la analiza y devuelve un diagnóstico en segundos (ej. "Antracnosis", "Saludable") junto con un porcentaje de confianza. Cada uno de estos resultados se guarda automáticamente en el historial del usuario.

Mapeo (Visualización de la Huerta): La sección de Mapeo ofrece dos vistas complementarias. Primero, un mapa geográfico satelital que muestra la ubicación GPS real del usuario; aquí se puede usar un control deslizante para ajustar el tamaño de un polígono verde y delimitar visualmente un área o lote específico. Segundo, presenta un mapa de calor (una cuadrícula de datos) que indica el estado de salud por zonas (Saludable, Listo para cosecha, Alerta), facilitando la identificación de áreas problemáticas.

Resultados (Historial y Gráficas): Resultados es la bitácora personal del productor. Muestra un Resumen General con estadísticas clave: el total de escaneos realizados, el porcentaje de ellos que están saludables y cuál es la enfermedad más común detectada. El usuario puede alternar entre varias vistas interactivas: una lista detallada de cada escaneo (mostrando una imagen del aguacate sano o enfermo) y gráficas (de pastel, barras y líneas) que presentan las estadísticas y tendencias de salud a lo largo del tiempo.

Medidas (Recomendaciones y Agenda): Esta pantalla es proactiva y se divide en dos partes. Primero, "Recomendaciones por Avotex", donde la IA analiza el historial de escaneos y genera consejos personalizados. Por ejemplo, si detecta una alta incidencia de una enfermedad, sugerirá acciones correctivas. Segundo, "Mis Tareas Personales", que funciona como una agenda digital donde el usuario puede registrar, gestionar y marcar como completadas sus propias actividades, como riegos, fertilizaciones o podas.

Sección 3: Tecnología Utilizada

Modelo de Inteligencia Artificial: El motor de diagnóstico de Avotex es una Red Neuronal Convolucional (CNN), un modelo avanzado de aprendizaje profundo (Deep Learning). Fue construido en Python utilizando TensorFlow y Keras. Para su entrenamiento, se utilizó un conjunto de datos de 3,984 imágenes de aguacates, clasificadas en "Antracnosis" (1,022), "Costra" (1,197) y "Saludable" (1,764). Este modelo está desplegado como un microservicio en la nube para procesar las imágenes enviadas desde la app.

Infraestructura de Backend (Firebase y Supabase): Avotex utiliza una arquitectura de backend híbrida para combinar lo mejor de dos plataformas. Firebase Authentication se encarga de todo el proceso de inicio de sesión y gestión de usuarios (con correo/contraseña o Google) de forma segura. Supabase se utiliza como la base de datos principal (basada en PostgreSQL), donde se almacenan todos los registros de la app en tablas como scans y tasks, vinculando cada dato al usuario correspondiente.

APIs Externas: Para enriquecer la información, la app se conecta a OpenWeatherMap para obtener datos climáticos en tiempo real. Adicionalmente, el proyecto cuenta con un convenio estratégico con EOSDA (Earth Observing System Data Analytics) para la futura integración de datos satelitales avanzados, lo que permitirá ofrecer un análisis de la huerta aún más completo.

Sección 4: Contacto y Más Información

Página Oficial de la Empresa: Para conocer más sobre VEX y nuestras otras soluciones tecnológicas, puedes visitar nuestra página oficial: https://www.vexmx.shop/

Instagram de Avotex: ¡Síguenos en Instagram para ver novedades, consejos y más sobre Avotex! Búscanos como @avotex.mx o entra a https://www.instagram.com/avotex.mx/

📜 REGLAS
Tu conocimiento es LIMITADO: Solo puedes responder usando la información de la "BASE DE CONOCIMIENTOS" anterior (Secciones 1, 2, 3 y 4).

Si no sabes, dilo: Si el usuario pregunta por precios, otras enfermedades, o cualquier cosa que no esté en la base, debes responder amablemente: "Lo siento, esa información está fuera de mi conocimiento. Solo puedo ayudarte con las funciones de Avotex."

Sé amigable: Usa emojis 🥑🌱😉😅😎📲 siempre que sea apropiado.

No inventes: Nunca inventes respuestas.`; 

const model = genAI.getGenerativeModel({ 
  model: MODEL,
});

interface Message {
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

// Componente de palomitas usando lucide-react-native
const CheckMarks = () => (
  <View style={styles.checkMarksContainer}>
    <Check size={14} color="#53BDEB" strokeWidth={2.5} style={{ position: 'absolute', left: 0 }} />
    <Check size={14} color="#53BDEB" strokeWidth={2.5} style={{ position: 'absolute', left: 4 }} />
  </View>
);

export default function ChatbotScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold });

  const openEmail = (userMessage: Message) => {
    const subject = 'Consulta desde la App Avotex';
    const body = `¡Hola, equipo de VEX! 🥑\n\nTengo la siguiente consulta:\n\n"${userMessage.text}"\n\nQuedo al pendiente,\nSaludos.`;
    const mailtoUrl = `mailto:vexmxoficial@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    Linking.openURL(mailtoUrl).catch(err => {
      console.error('Error al abrir mailto:', err);
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: "No pude abrir tu app de correo, pero puedes escribirnos a: vexmxoficial@gmail.com", timestamp: new Date() },
      ]);
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", text: input, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    const historyForAPI = messages.map(msg => ({
      role: msg.role === 'bot' ? 'model' : 'user',
      parts: [{ text: msg.text }]
    }));

    try {
      const chat = model.startChat({
        systemInstruction: { parts: [{ text: systemInstruction }], role: "system" },
        history: historyForAPI,
      });

      const result = await chat.sendMessage(userMessage.text);
      const botResponse = result.response.text();
      let botMessage: Message;

      if (botResponse.trim() === "ACTION:CONTACT") {
        botMessage = { 
          role: "bot", 
          text: "¡Claro! Esa es una consulta que el equipo de VEX puede resolver mejor. Te ayudo a enviarles un correo. 🥑",
          timestamp: new Date()
        };
        openEmail(userMessage);
      } else {
        botMessage = { role: "bot", text: botResponse, timestamp: new Date() };
      }
      
      setMessages((prev) => [...prev, botMessage]);

    } catch (err) {
      console.log(err);
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: "Error al conectarse a Gemini.", timestamp: new Date() },
      ]);
    }
    setLoading(false);
  }

  if (!fontsLoaded) return null;

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === "ios" ? "padding" : undefined} 
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      
       <Image 
        source={require("../../assets/images/chatbg.jpg")} 
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "",
          headerStyle: {
            backgroundColor: '#075E54',
          },
          headerLeft: () => (
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <ChevronLeft size={24} color="#fff" />
              </TouchableOpacity>
              <Image 
                source={require('../../assets/images/AvotexLogo.png')} 
                style={styles.headerAvatar} 
              />
              <Text style={styles.headerTitle}>Avotex</Text>
            </View>
          ),
          headerRight: () => (
            <TouchableOpacity style={styles.phoneButton}>
              <Phone size={22} color="#fff" />
            </TouchableOpacity>
          ),
        }} 
      />

      {/* Fondo estilo WhatsApp */}
      <View style={styles.whatsappBackground} />

      <ScrollView 
        style={styles.chatArea} 
        contentContainerStyle={styles.chatContent}
        ref={scrollViewRef}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && (
          <View style={styles.welcomeContainer}>
            <View style={styles.welcomeBubble}>
              <Text style={styles.welcomeText}>
                ¡Hola! Soy Avotex 🥑{'\n'}Tu aliado en la huerta.{'\n\n'}¿En qué te ayudo hoy?
              </Text>
            </View>
          </View>
        )}

        {messages.map((m, i) => (
          <View key={i} style={[styles.messageContainer, m.role === 'user' ? styles.userContainer : styles.botContainer]}>
            <View style={[styles.messageBubble, m.role === "user" ? styles.userMsg : styles.botMsg]}>
              <Text style={styles.messageText}>{m.text}</Text>
              <View style={styles.messageFooter}>
                <Text style={styles.timestamp}>{formatTime(m.timestamp)}</Text>
                {m.role === 'user' && <CheckMarks />}
              </View>
            </View>
          </View>
        ))}

        {loading && (
          <View style={[styles.messageContainer, styles.botContainer]}>
            <View style={[styles.messageBubble, styles.botMsg]}>
              <ActivityIndicator color="#666" size="small" />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input estilo WhatsApp */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TouchableOpacity style={styles.emojiButton}>
            <Text style={styles.emojiIcon}></Text>
          </TouchableOpacity>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Mensaje"
            placeholderTextColor="#8B9199"
            style={styles.input}
            onSubmitEditing={sendMessage}
            multiline
          />
          <TouchableOpacity style={styles.attachButton}>
            <Plus size={22} color="#8B9199" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity 
          style={styles.sendButton} 
          onPress={sendMessage} 
          disabled={loading || !input.trim()}
        >
          {input.trim().length > 0 ? (
            <Send size={20} color="#fff" />
          ) : (
            <Mic size={22} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },

  backgroundImage: {
    position: 'absolute',
    resizeMode: "cover",
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: '100%',
    height: '100%',
    opacity: 0.25, 
    zIndex: -1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -10,
  },
  backButton: {
    padding: 8,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: '#fff',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
  },
  phoneButton: {
    padding: 8,
    marginRight: 10,
  },
  chatArea: { 
    flex: 1,
  },
  chatContent: { 
    padding: 8,
    paddingBottom: 10,
  },
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  welcomeBubble: {
    backgroundColor: '#FFF9C4',
    padding: 12,
    borderRadius: 8,
    maxWidth: '80%',
  },
  welcomeText: {
    color: '#000',
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
  },
  messageContainer: {
    marginVertical: 2,
    paddingHorizontal: 8,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  botContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    padding: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    maxWidth: '80%',
    minWidth: 80,
  },
  userMsg: {
    backgroundColor: '#DCF8C6',
    borderTopRightRadius: 2,
  },
  botMsg: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 2,
  },
  messageText: {
    color: '#000',
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    marginBottom: 4,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  timestamp: {
    color: '#667781',
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
  },
  checkMarksContainer: {
    width: 18,
    height: 14,
    position: 'relative',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#F0F0F0',
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 12,
    minHeight: 42,
  },
  emojiButton: {
    padding: 4,
  },
  emojiIcon: {
    fontSize: 22,
  },
  input: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    color: '#000',
    maxHeight: 100,
  },
  attachButton: {
    padding: 4,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
  },
});