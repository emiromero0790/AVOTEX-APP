import React from 'react';
import {
  View,
  Text,
  TextStyle,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, Shield } from 'lucide-react-native';
import { useFonts, Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';

const Section = ({ number, title, children }: { number: string; title: string; children: React.ReactNode }) => (
  <View style={s.section}>
    <View style={s.sectionHeader}>
      <View style={s.sectionBadge}>
        <Text style={s.sectionNumber}>{number}</Text>
      </View>
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
    <View style={s.sectionBody}>{children}</View>
  </View>
);

type BulletProps = {
  text: string;
  bold?: boolean;
  style?: TextStyle;
};

const Bullet = ({ text, bold, style }: BulletProps) => (
  <View style={s.bulletRow}>
    <Text style={s.bullet}>•</Text>
    <Text style={[s.bulletText, bold && s.boldText, style]}>
      {text}
    </Text>
  </View>
);

export default function PrivacyScreen() {
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold });
  if (!fontsLoaded) return null;

  return (
    <View style={s.root}>
      <View style={StyleSheet.absoluteFillObject} />

      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft size={26} color="#007AFF" />
        </TouchableOpacity>
        <Text style={s.topTitle}>Aviso de Privacidad</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.heroCard}>
          <View style={s.shieldCircle}>
            <Shield size={32} color="#FFFFFF" />
          </View>
          <Text style={s.heroTitle}>Aviso de Privacidad de Avotex</Text>
          <Text style={s.heroSub}>Última actualización: 04/05/2026</Text>
          <Text style={s.heroDesc}>
            Avotex es una aplicación desarrollada por VEX, enfocada en brindar herramientas inteligentes para el análisis de cultivos mediante el uso de Inteligencia Artificial.{'\n\n'}
            La privacidad de nuestros usuarios es una prioridad. Este Aviso de Privacidad explica qué información se recopila, cómo se utiliza y cómo se protege.
          </Text>
        </View>

        {/* ── Link completo ── */}
        <TouchableOpacity
          style={s.linkCard}
          onPress={() => Linking.openURL('https://www.vex-mx.com/avisosprivacidadavotex.html')}
          activeOpacity={0.8}
        >
          <View style={s.linkCardGrad}>
            <Shield size={22} color="#8E8E93" />
            <View style={{ flex: 1 }}>
              <Text style={s.linkCardLabel}>Aviso de Privacidad completo</Text>
              <Text style={s.linkCardUrl}>https://www.vex-mx.com/avisosprivacidadavotex.html</Text>
            </View>
            <Text style={s.linkCardArrow}>↗</Text>
          </View>
        </TouchableOpacity>

        <Section number="1" title="Información que recopilamos">
          <Bullet text="Imágenes capturadas por el usuario mediante la función de escaneo" />
          <Bullet text="Ubicación del dispositivo (GPS)" />
          <Bullet text="Datos de uso de la aplicación (historial de escaneos y resultados)" />
          <Bullet text="Información técnica del dispositivo" />
        </Section>

        <Section number="2" title="Uso de la información">
          <Text style={s.bodyText}>La información se utiliza exclusivamente para:</Text>
          <Bullet text="Análisis de imágenes mediante Inteligencia Artificial" />
          <Bullet text="Generación de diagnósticos de probabilidad de enfermedades en cultivos" />
          <Bullet text="Obtención de datos climáticos (temperatura, humedad)" />
          <Bullet text="Mejora de la experiencia del usuario" />
          <Bullet text="Visualización de historial, estadísticas y recomendaciones" />
        </Section>

        <Section number="3" title="Uso de imágenes (IMPORTANTE)">
          <View style={s.highlightBox}>
            <Bullet text="Las imágenes NO se almacenan en servidores ni bases de datos" bold />
            <Bullet text="Se envían temporalmente a una API de Inteligencia Artificial para su análisis" />
             <Bullet
               text={`¡¡IMPORTANTE!! Uso de Inteligencia Artificial

             Avotex utiliza un modelo de Inteligencia Artificial desarrollado internamente por nuestro equipo para el análisis de imágenes de cultivos.

             Este modelo ha sido entrenado con conjuntos de datos previamente preparados con fines de aprendizaje y mejora del sistema.

             Los resultados generados por el modelo representan estimaciones de probabilidad y pueden no ser completamente precisos, por lo que deben considerarse como apoyo informativo y no como un diagnóstico definitivo.

             Avotex no utiliza las imágenes capturadas por los usuarios para entrenar el modelo sin su consentimiento.`}
               bold
               style={{ color: 'red' }}
             />
            <Bullet text="Una vez procesadas, la imagen se elimina y no se conserva" bold />
          </View>
          <Text style={s.bodyText}>
            Solo se almacena el resultado del análisis (porcentaje de probabilidad de enfermedad y diagnóstico).
          </Text>
        </Section>

        <Section number="4" title="Ubicación del usuario">
          <Text style={s.bodyText}>La ubicación se utiliza únicamente para:</Text>
          <Bullet text="Obtener condiciones climáticas locales" />
          <Bullet text="Mejorar la precisión de los análisis agrícolas" />
          <Text style={[s.bodyText, { marginTop: 10 }]}>
            El usuario puede activar o desactivar el acceso a su ubicación en cualquier momento desde Ajustes.
          </Text>
        </Section>

        <Section number="5" title="Servicios de terceros">
          <Text style={s.bodyText}>Avotex utiliza servicios externos para su funcionamiento:</Text>
          <Bullet text="Google Maps (geolocalización y mapas)" />
          <Bullet text="OpenWeatherMap (datos climáticos)" />
          <Bullet text="Servicios de Inteligencia Artificial para análisis de imágenes" />
          <Text style={[s.bodyText, { marginTop: 10 }]}>
            Estos servicios procesan datos únicamente para cumplir su función dentro de la aplicación.
          </Text>
        </Section>

        <Section number="6" title="Compartición de información">
          <Bullet text="No vendemos información personal" bold />
          <Bullet text="No compartimos datos con terceros con fines comerciales" bold />
          <Bullet text="Los datos solo se utilizan para el funcionamiento de la aplicación" />
        </Section>

        <Section number="7" title="Chatbot y recomendaciones">
          <Bullet text="El chatbot funciona con Inteligencia Artificial" />
          <Bullet text="Sus respuestas son orientativas" />
          <Bullet text="No sustituye asesoría profesional agrícola" />
          <Bullet text="Puede cometer errores" />
        </Section>

        <Section number="8" title="Seguridad">
          <Text style={s.bodyText}>
            Se aplican medidas razonables de seguridad, aunque ningún sistema es completamente seguro.
          </Text>
        </Section>

        <Section number="9" title="Derechos del usuario">
          <Text style={s.bodyText}>El usuario puede:</Text>
          <Bullet text="Desactivar ubicación o cámara en cualquier momento" />
          <Bullet text="Dejar de usar la aplicación" />
        </Section>

        <Section number="10" title="Contacto">
          <TouchableOpacity onPress={() => Linking.openURL('mailto:vexmxoficial@gmail.com')}>
            <Text style={s.link}>📧 vexmxoficial@gmail.com</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL('https://www.instagram.com/avotex.mx/')}>
            <Text style={s.link}>📸 @avotex.mx en Instagram</Text>
          </TouchableOpacity>
        </Section>

        <Section number="11" title="Cambios al aviso">
          <Text style={s.bodyText}>
            Este aviso puede actualizarse en cualquier momento. Se notificará a los usuarios sobre cambios relevantes.
          </Text>
        </Section>

        <TouchableOpacity
          style={s.linkCard}
          onPress={() => Linking.openURL('https://www.vex-mx.com/avisosprivacidadavotex.html')}
          activeOpacity={0.8}
        >
          <View style={s.linkCardGrad}>
            <Shield size={22} color="#8E8E93" />
            <View style={{ flex: 1 }}>
              <Text style={s.linkCardLabel}>Ver aviso completo en línea</Text>
              <Text style={s.linkCardUrl}>https://www.vex-mx.com/avisosprivacidadavotex.html</Text>
            </View>
            <Text style={s.linkCardArrow}>↗</Text>
          </View>
        </TouchableOpacity>

        <View style={s.footer}>
          <Text style={s.footerText}>Al usar Avotex, aceptas este Aviso de Privacidad.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F2F2F7',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 17,
    color: '#000000',
  },
  scroll: {
    paddingHorizontal: 18,
    paddingBottom: 130,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
    marginBottom: 18,
    alignItems: 'center',
  },
  shieldCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#8E8E93',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    color: '#111111',
    textAlign: 'center',
    marginBottom: 4,
  },
  heroSub: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 12,
  },
  heroDesc: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sectionNumber: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 13,
    color: '#636366',
  },
  sectionTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 15,
    color: '#111111',
    flex: 1,
  },
  sectionBody: {},
  highlightBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#8E8E93',
    marginBottom: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  bullet: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#8E8E93',
    marginRight: 8,
    marginTop: 1,
  },
  bulletText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: '#334155',
    flex: 1,
    lineHeight: 20,
  },
  boldText: {
    fontFamily: 'Poppins_600SemiBold',
    color: '#111111',
  },
  bodyText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
  },
  link: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 8,
    textDecorationLine: 'underline',
  },
  linkCard: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 18,
  },
  linkCardGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  linkCardLabel: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    color: '#111111',
    marginBottom: 2,
  },
  linkCardUrl: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: '#6D7D74',
  },
  linkCardArrow: {
    fontSize: 22,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 6,
  },
  footerText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: '#6D6D72',
    textAlign: 'center',
  },
});
