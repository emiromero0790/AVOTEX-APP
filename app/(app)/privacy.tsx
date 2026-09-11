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
import { TranslationResource, useTranslations } from '../../context/LanguageContext';

const translations: TranslationResource = {
  'privacy.title': { es: 'Aviso de Privacidad', en: 'Privacy Notice' }, 'privacy.heroTitle': { es: 'Aviso de Privacidad de Avotex', en: 'Avotex Privacy Notice' }, 'privacy.updated': { es: 'Última actualización: 04/05/2026', en: 'Last updated: 05/04/2026' }, 'privacy.hero': { es: 'Avotex es una aplicación desarrollada por VEX, enfocada en brindar herramientas inteligentes para el análisis de cultivos mediante el uso de Inteligencia Artificial.\\n\\nLa privacidad de nuestros usuarios es una prioridad. Este Aviso de Privacidad explica qué información se recopila, cómo se utiliza y cómo se protege.', en: 'Avotex is an application developed by VEX that provides intelligent tools for crop analysis using Artificial Intelligence.\\n\\nOur users’ privacy is a priority. This Privacy Notice explains what information is collected, how it is used, and how it is protected.' }, 'privacy.full': { es: 'Aviso de Privacidad completo', en: 'Full Privacy Notice' }, 'privacy.online': { es: 'Ver aviso completo en línea', en: 'View full notice online' }, 'privacy.footer': { es: 'Al usar Avotex, aceptas este Aviso de Privacidad.', en: 'By using Avotex, you accept this Privacy Notice.' },
  'privacy.s1': { es: 'Información que recopilamos', en: 'Information we collect' }, 'privacy.s2': { es: 'Uso de la información', en: 'Use of information' }, 'privacy.s3': { es: 'Uso de imágenes (IMPORTANTE)', en: 'Use of images (IMPORTANT)' }, 'privacy.s4': { es: 'Ubicación del usuario', en: 'User location' }, 'privacy.s5': { es: 'Servicios de terceros', en: 'Third-party services' }, 'privacy.s6': { es: 'Compartición de información', en: 'Information sharing' }, 'privacy.s7': { es: 'Chatbot y recomendaciones', en: 'Chatbot and recommendations' }, 'privacy.s8': { es: 'Seguridad', en: 'Security' }, 'privacy.s9': { es: 'Derechos del usuario', en: 'User rights' }, 'privacy.s10': { es: 'Contacto', en: 'Contact' }, 'privacy.s11': { es: 'Cambios al aviso', en: 'Changes to this notice' },
  'privacy.b1': { es: 'Imágenes capturadas por el usuario mediante la función de escaneo', en: 'Images captured by the user through the scan feature' }, 'privacy.b2': { es: 'Ubicación del dispositivo (GPS)', en: 'Device location (GPS)' }, 'privacy.b3': { es: 'Datos de uso de la aplicación (historial de escaneos y resultados)', en: 'App usage data (scan history and results)' }, 'privacy.b4': { es: 'Información técnica del dispositivo', en: 'Technical device information' }, 'privacy.useIntro': { es: 'La información se utiliza exclusivamente para:', en: 'Information is used exclusively for:' }, 'privacy.u1': { es: 'Análisis de imágenes mediante Inteligencia Artificial', en: 'Image analysis using Artificial Intelligence' }, 'privacy.u2': { es: 'Generación de diagnósticos de probabilidad de enfermedades en cultivos', en: 'Generating probability diagnoses of crop diseases' }, 'privacy.u3': { es: 'Obtención de datos climáticos (temperatura, humedad)', en: 'Obtaining weather data (temperature, humidity)' }, 'privacy.u4': { es: 'Mejora de la experiencia del usuario', en: 'Improving the user experience' }, 'privacy.u5': { es: 'Visualización de historial, estadísticas y recomendaciones', en: 'Displaying history, statistics, and recommendations' },
  'privacy.i1': { es: 'Las imágenes NO se almacenan en servidores ni bases de datos', en: 'Images are NOT stored on servers or databases' }, 'privacy.i2': { es: 'Se envían temporalmente a una API de Inteligencia Artificial para su análisis', en: 'They are temporarily sent to an Artificial Intelligence API for analysis' }, 'privacy.i3': { es: '¡¡IMPORTANTE!! Uso de Inteligencia Artificial\\n\\nAvotex utiliza un modelo de Inteligencia Artificial desarrollado internamente por nuestro equipo para el análisis de imágenes de cultivos.\\n\\nEste modelo ha sido entrenado con conjuntos de datos previamente preparados con fines de aprendizaje y mejora del sistema.\\n\\nLos resultados generados por el modelo representan estimaciones de probabilidad y pueden no ser completamente precisos, por lo que deben considerarse como apoyo informativo y no como un diagnóstico definitivo.\\n\\nAvotex no utiliza las imágenes capturadas por los usuarios para entrenar el modelo sin su consentimiento.', en: 'IMPORTANT!! Use of Artificial Intelligence\\n\\nAvotex uses an Artificial Intelligence model developed internally by our team to analyze crop images.\\n\\nThis model was trained with datasets prepared for learning and system improvement.\\n\\nModel results are probability estimates and may not be completely accurate, so they should be considered informational support, not a definitive diagnosis.\\n\\nAvotex does not use user-captured images to train the model without consent.' }, 'privacy.i4': { es: 'Una vez procesadas, la imagen se elimina y no se conserva', en: 'Once processed, the image is deleted and not retained' }, 'privacy.result': { es: 'Solo se almacena el resultado del análisis (porcentaje de probabilidad de enfermedad y diagnóstico).', en: 'Only the analysis result is stored (disease probability percentage and diagnosis).' }, 'privacy.locationIntro': { es: 'La ubicación se utiliza únicamente para:', en: 'Location is used only to:' }, 'privacy.l1': { es: 'Obtener condiciones climáticas locales', en: 'Obtain local weather conditions' }, 'privacy.l2': { es: 'Mejorar la precisión de los análisis agrícolas', en: 'Improve the accuracy of agricultural analyses' }, 'privacy.locationEnd': { es: 'El usuario puede activar o desactivar el acceso a su ubicación en cualquier momento desde Ajustes.', en: 'Users can enable or disable location access at any time from Settings.' }, 'privacy.thirdIntro': { es: 'Avotex utiliza servicios externos para su funcionamiento:', en: 'Avotex uses external services to operate:' }, 'privacy.t1': { es: 'Google Maps (geolocalización y mapas)', en: 'Google Maps (geolocation and maps)' }, 'privacy.t2': { es: 'OpenWeatherMap (datos climáticos)', en: 'OpenWeatherMap (weather data)' }, 'privacy.t3': { es: 'Servicios de Inteligencia Artificial para análisis de imágenes', en: 'Artificial Intelligence services for image analysis' }, 'privacy.thirdEnd': { es: 'Estos servicios procesan datos únicamente para cumplir su función dentro de la aplicación.', en: 'These services process data only to perform their function within the app.' },
  'privacy.share1': { es: 'No vendemos información personal', en: 'We do not sell personal information' }, 'privacy.share2': { es: 'No compartimos datos con terceros con fines comerciales', en: 'We do not share data with third parties for commercial purposes' }, 'privacy.share3': { es: 'Los datos solo se utilizan para el funcionamiento de la aplicación', en: 'Data is used only for the app to function' }, 'privacy.chat1': { es: 'El chatbot funciona con Inteligencia Artificial', en: 'The chatbot uses Artificial Intelligence' }, 'privacy.chat2': { es: 'Sus respuestas son orientativas', en: 'Its responses are guidance only' }, 'privacy.chat3': { es: 'No sustituye asesoría profesional agrícola', en: 'It does not replace professional agricultural advice' }, 'privacy.chat4': { es: 'Puede cometer errores', en: 'It can make mistakes' }, 'privacy.security': { es: 'Se aplican medidas razonables de seguridad, aunque ningún sistema es completamente seguro.', en: 'Reasonable security measures are applied, although no system is completely secure.' }, 'privacy.rightsIntro': { es: 'El usuario puede:', en: 'Users can:' }, 'privacy.r1': { es: 'Desactivar ubicación o cámara en cualquier momento', en: 'Disable location or camera at any time' }, 'privacy.r2': { es: 'Dejar de usar la aplicación', en: 'Stop using the app' }, 'privacy.contactInstagram': { es: '📸 @avotex.mx en Instagram', en: '📸 @avotex.mx on Instagram' }, 'privacy.changes': { es: 'Este aviso puede actualizarse en cualquier momento. Se notificará a los usuarios sobre cambios relevantes.', en: 'This notice may be updated at any time. Users will be notified of relevant changes.' },
};

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
  const t = useTranslations(translations);
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold });
  if (!fontsLoaded) return null;

  return (
    <View style={s.root}>
      <View style={StyleSheet.absoluteFillObject} />

      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft size={26} color="#007AFF" />
        </TouchableOpacity>
        <Text style={s.topTitle}>{t('privacy.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.heroCard}>
          <View style={s.shieldCircle}>
            <Shield size={32} color="#FFFFFF" />
          </View>
          <Text style={s.heroTitle}>{t('privacy.heroTitle')}</Text>
          <Text style={s.heroSub}>{t('privacy.updated')}</Text>
          <Text style={s.heroDesc}>{t('privacy.hero')}</Text>
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
              <Text style={s.linkCardLabel}>{t('privacy.full')}</Text>
              <Text style={s.linkCardUrl}>https://www.vex-mx.com/avisosprivacidadavotex.html</Text>
            </View>
            <Text style={s.linkCardArrow}>↗</Text>
          </View>
        </TouchableOpacity>

        <Section number="1" title={t('privacy.s1')}>
          <Bullet text={t('privacy.b1')} /><Bullet text={t('privacy.b2')} /><Bullet text={t('privacy.b3')} /><Bullet text={t('privacy.b4')} />
        </Section>

        <Section number="2" title={t('privacy.s2')}>
          <Text style={s.bodyText}>{t('privacy.useIntro')}</Text>
          <Bullet text={t('privacy.u1')} /><Bullet text={t('privacy.u2')} /><Bullet text={t('privacy.u3')} /><Bullet text={t('privacy.u4')} /><Bullet text={t('privacy.u5')} />
        </Section>

        <Section number="3" title={t('privacy.s3')}>
          <View style={s.highlightBox}>
            <Bullet text={t('privacy.i1')} bold /><Bullet text={t('privacy.i2')} />
             <Bullet
                text={t('privacy.i3')}
               bold
               style={{ color: 'red' }}
             />
             <Bullet text={t('privacy.i4')} bold />
          </View>
          <Text style={s.bodyText}>
             {t('privacy.result')}
          </Text>
        </Section>

        <Section number="4" title={t('privacy.s4')}>
          <Text style={s.bodyText}>{t('privacy.locationIntro')}</Text><Bullet text={t('privacy.l1')} /><Bullet text={t('privacy.l2')} />
          <Text style={[s.bodyText, { marginTop: 10 }]}>
             {t('privacy.locationEnd')}
          </Text>
        </Section>

        <Section number="5" title={t('privacy.s5')}>
          <Text style={s.bodyText}>{t('privacy.thirdIntro')}</Text><Bullet text={t('privacy.t1')} /><Bullet text={t('privacy.t2')} /><Bullet text={t('privacy.t3')} />
          <Text style={[s.bodyText, { marginTop: 10 }]}>
             {t('privacy.thirdEnd')}
          </Text>
        </Section>

        <Section number="6" title={t('privacy.s6')}>
          <Bullet text={t('privacy.share1')} bold /><Bullet text={t('privacy.share2')} bold /><Bullet text={t('privacy.share3')} />
        </Section>

        <Section number="7" title={t('privacy.s7')}>
          <Bullet text={t('privacy.chat1')} /><Bullet text={t('privacy.chat2')} /><Bullet text={t('privacy.chat3')} /><Bullet text={t('privacy.chat4')} />
        </Section>

        <Section number="8" title={t('privacy.s8')}>
          <Text style={s.bodyText}>{t('privacy.security')}</Text>
        </Section>

        <Section number="9" title={t('privacy.s9')}>
          <Text style={s.bodyText}>{t('privacy.rightsIntro')}</Text><Bullet text={t('privacy.r1')} /><Bullet text={t('privacy.r2')} />
        </Section>

        <Section number="10" title={t('privacy.s10')}>
          <TouchableOpacity onPress={() => Linking.openURL('mailto:vexmxoficial@gmail.com')}>
            <Text style={s.link}>📧 vexmxoficial@gmail.com</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL('https://www.instagram.com/avotex.mx/')}>
            <Text style={s.link}>{t('privacy.contactInstagram')}</Text>
          </TouchableOpacity>
        </Section>

        <Section number="11" title={t('privacy.s11')}>
          <Text style={s.bodyText}>{t('privacy.changes')}</Text>
        </Section>

        <TouchableOpacity
          style={s.linkCard}
          onPress={() => Linking.openURL('https://www.vex-mx.com/avisosprivacidadavotex.html')}
          activeOpacity={0.8}
        >
          <View style={s.linkCardGrad}>
            <Shield size={22} color="#8E8E93" />
            <View style={{ flex: 1 }}>
              <Text style={s.linkCardLabel}>{t('privacy.online')}</Text>
              <Text style={s.linkCardUrl}>https://www.vex-mx.com/avisosprivacidadavotex.html</Text>
            </View>
            <Text style={s.linkCardArrow}>↗</Text>
          </View>
        </TouchableOpacity>

        <View style={s.footer}>
           <Text style={s.footerText}>{t('privacy.footer')}</Text>
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
