/**
 * Botón flotante de cámara de Escanear: abre la foto individual (cámara + aviso de privacidad).
 *
 * Mismo lenguaje que el botón del asistente (components/chatbot/ChatbotFloatingButton): esfera de cristal
 * verde de 58 dp (70 en tableta), reflejo, borde lima fino, halo discreto y sombra. En lugar de la
 * semilla y el chat lleva una cámara con un brote dentro del lente.
 *
 * Movimiento: presión = escala 0.94 en 120 ms (ease-out) y halo más intenso; con «Reducir movimiento»
 * solo cambia la opacidad del halo. Mientras `busy`, un indicador gira sobre el lente.
 */
import React, { memo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Reanimated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

const CSS_EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);

const Sphere = memo(function Sphere({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" pointerEvents="none">
      <Defs>
        <RadialGradient id="cmfBase" cx="50%" cy="62%" rx="58%" ry="58%">
          <Stop offset="0" stopColor="#7FCB35" />
          <Stop offset="0.45" stopColor="#2F8A2A" />
          <Stop offset="0.8" stopColor="#145B24" />
          <Stop offset="1" stopColor="#073F20" />
        </RadialGradient>
        <RadialGradient id="cmfInner" cx="50%" cy="60%" rx="40%" ry="40%">
          <Stop offset="0" stopColor="#E6ED7A" stopOpacity="0.45" />
          <Stop offset="1" stopColor="#B9F62F" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="cmfGloss" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* esfera base y luz interna */}
      <Circle cx={50} cy={50} r={48} fill="url(#cmfBase)" />
      <Circle cx={50} cy={50} r={47} fill="url(#cmfInner)" />

      {/* cámara grabada en el cristal */}
      <G>
        <Path d="M40.5 33.5 L44 28.5 H56 L59.5 33.5" fill="none" stroke="#F4FFD9" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        <Rect x={27} y={33.5} width={46} height={33} rx={8} fill="#F9F6E9" fillOpacity={0.2} stroke="#F4FFD9" strokeWidth={3} />
        <Circle cx={50} cy={50} r={10.5} fill="#0B4A22" fillOpacity={0.35} stroke="#F4FFD9" strokeWidth={3} />
        {/* brote dentro del lente */}
        <Path d="M47.2 54.4 C46.8 49.6 49.8 46.4 54.6 46 C55 50.8 52 54 47.2 54.4 Z" fill="#B9F62F" />
        <Circle cx={65} cy={40.5} r={2} fill="#F4FFD9" />
      </G>

      {/* reflejos del cristal y bordes */}
      <Path d="M20 34 C26 18 42 10 58 11 C44 14 31 22 25 36 Z" fill="url(#cmfGloss)" />
      <Path d="M80 70 C76 78 70 84 62 88" stroke="#E6ED7A" strokeOpacity={0.3} strokeWidth={1.4} strokeLinecap="round" fill="none" />
      <Circle cx={50} cy={50} r={47.2} fill="none" stroke="#B9F62F" strokeOpacity={0.55} strokeWidth={1.2} />
      <Circle cx={50} cy={50} r={48.6} fill="none" stroke="#04260F" strokeOpacity={0.5} strokeWidth={0.8} />
    </Svg>
  );
});

const Halo = memo(function Halo({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} pointerEvents="none">
      <Defs>
        <RadialGradient id="cmfHalo" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0.62" stopColor="#B9F62F" stopOpacity="0.32" />
          <Stop offset="1" stopColor="#B9F62F" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#cmfHalo)" />
    </Svg>
  );
});

type Props = {
  onPress: () => void;
  size?: number;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
};

export function CameraFloatingButton({ onPress, size = 58, busy = false, style, accessibilityLabel }: Props) {
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();
  const halo = size * 1.32;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy }}
      hitSlop={6}
      pressRetentionOffset={16}
      style={[{ width: size, height: size }, style]}
    >
      <Reanimated.View
        style={{
          width: size,
          height: size,
          transform: [{ scale: pressed && !reduced ? 0.94 : 1 }],
          transitionProperty: 'transform',
          transitionDuration: 120,
          transitionTimingFunction: CSS_EASE_OUT,
        }}
      >
        <Reanimated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: (size - halo) / 2,
            top: (size - halo) / 2,
            opacity: pressed ? 1 : 0.55,
            transitionProperty: 'opacity',
            transitionDuration: 160,
            transitionTimingFunction: CSS_EASE_OUT,
          }}
        >
          <Halo size={halo} />
        </Reanimated.View>
        {/* Sombra/elevación: la esfera va dentro para quedar por encima en Android. */}
        <View pointerEvents="none" style={[st.shadow, { width: size, height: size, borderRadius: size / 2 }]}>
          <Sphere size={size} />
          {busy && (
            <View style={[StyleSheet.absoluteFill, st.center]}>
              <ActivityIndicator color="#F4FFD9" />
            </View>
          )}
        </View>
      </Reanimated.View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  shadow: {
    position: 'absolute', left: 0, top: 0, backgroundColor: '#0B4A22',
    shadowColor: '#06331A', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 7,
  },
  center: { alignItems: 'center', justifyContent: 'center' },
});
