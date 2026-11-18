/**
 * Encabezado fotográfico de Actividad: huerta al atardecer (asset local) con capa verde bosque y un degradado
 * inferior que funde la foto con el fondo de la sección (sin corte brusco). Logo AVOTEX, ajustes, título y
 * subtítulo son componentes reales; la imagen no lleva texto.
 *
 * El selector de pestañas se pasa como `children` y queda montado sobre la zona de fundido, como en el boceto.
 */
import React, { memo } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Leaf, Settings } from 'lucide-react-native';
import { PressableScale } from '../scan/motion';
import { P } from './charts/core';

const HEADER = require('../../assets/images/actividad/actividad-header.jpg');
const LOGO = require('../../assets/images/inicio/avotex-logo-blanco.png');

type Props = {
  topInset: number;
  title: string;
  subtitle: string;
  /** Color del fondo que sigue al encabezado (o 'transparent' sobre otra foto). */
  fadeTo: string;
  onSettings: () => void;
  settingsLabel: string;
  onBack?: () => void;
  backLabel?: string;
  children?: React.ReactNode;
};

/** rgba() del color de fundido con la opacidad pedida. */
function withAlpha(color: string, a: number) {
  if (color === 'transparent') return `rgba(0,0,0,0)`;
  const n = parseInt(color.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function ActividadHeader({ topInset, title, subtitle, fadeTo, onSettings, settingsLabel, onBack, backLabel, children }: Props) {
  const { width } = useWindowDimensions();
  const compact = width < 360;
  // Bloque principal ~196 dp + barra de estado; las pestañas se montan sobre los últimos ~34 dp.
  const photoH = topInset + (compact ? 186 : 200);
  return (
    <View>
      <View style={[st.photo, { height: photoH }]}>
        <Image source={HEADER} style={[StyleSheet.absoluteFill, { width, height: photoH }]} resizeMode="cover" fadeDuration={0} accessibilityIgnoresInvertColors />
        {/* lectura del texto: más denso arriba-izquierda, donde están el título y los controles */}
        <LinearGradient colors={['rgba(4,38,22,0.78)', 'rgba(6,60,32,0.45)', 'rgba(6,60,32,0.18)']} locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(0,0,0,0.38)', 'rgba(0,0,0,0)']} locations={[0, 0.35]} style={StyleSheet.absoluteFill} />
        {fadeTo !== 'transparent' && (
          <LinearGradient colors={[withAlpha(fadeTo, 0), withAlpha(fadeTo, 0.75), fadeTo]} locations={[0.7, 0.9, 1]} style={StyleSheet.absoluteFill} />
        )}
        <View style={[st.content, { paddingTop: topInset + 8 }]}>
          <View style={st.topRow}>
            {onBack ? (
              <PressableScale onPress={onBack} style={st.round} accessibilityRole="button" accessibilityLabel={backLabel} hitSlop={6}>
                <ChevronLeft size={22} color="#FFFFFF" />
              </PressableScale>
            ) : null}
            <Image source={LOGO} style={[st.logo, compact && { width: 118 }]} resizeMode="contain" accessibilityRole="image" accessibilityLabel="AVOTEX" />
            <View style={{ flex: 1 }} />
            <PressableScale onPress={onSettings} style={st.gear} accessibilityRole="button" accessibilityLabel={settingsLabel} hitSlop={6}>
              <Settings size={20} color={P.ink} />
            </PressableScale>
          </View>
          <View style={st.titleRow}>
            <Text style={[st.title, compact && { fontSize: 30, lineHeight: 37 }]} accessibilityRole="header" maxFontSizeMultiplier={1.15}>{title}</Text>
            <Leaf size={compact ? 22 : 26} color={P.lime} fill="rgba(185,246,47,0.35)" strokeWidth={2} style={{ marginLeft: 8, marginTop: -4 }} />
          </View>
          <Text style={st.subtitle} numberOfLines={2} maxFontSizeMultiplier={1.2}>{subtitle}</Text>
        </View>
      </View>
      {children ? <View style={st.tabsSlot}>{children}</View> : null}
    </View>
  );
}

export default memo(ActividadHeader);

const st = StyleSheet.create({
  photo: { width: '100%', overflow: 'hidden' },
  content: { paddingHorizontal: 20 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  round: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(4,38,22,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  logo: { width: 132, height: 44 },
  gear: {
    width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.94)',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  title: {
    fontFamily: 'Poppins_700Bold', fontSize: 33, lineHeight: 40, letterSpacing: -0.8, color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 },
  },
  subtitle: {
    fontFamily: 'Poppins_400Regular', fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.95)', marginTop: 0, maxWidth: 380,
    textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 },
  },
  tabsSlot: { marginTop: -42 },
});
