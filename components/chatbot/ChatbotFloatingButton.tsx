/**
 * Botón flotante del asistente — concepto "semilla inteligente".
 *
 * Una esfera de cristal verde del MISMO diámetro que el botón anterior (58 dp / 70 dp en tableta),
 * con una semilla germinando sobre un poco de sustrato, el icono de chat grabado en el cristal
 * y dos hojas pequeñas que asoman apenas por encima del borde.
 *
 * Capas: halo → sombra/elevación → esfera base → luz interna (respira) → sustrato → semilla
 * → tallo → icono de chat → reflejos del cristal → hojas (se mecen).
 *
 * Movimiento (skill animate-expo):
 * - Presión: escala 0.94 en 120 ms (ease-out) + halo un poco más intenso; las hojas se inclinan levemente.
 * - Reposo: la luz interna respira (opacidad, 3.6 s) y las hojas se mecen ±3° (4.4 s). Solo opacidad y
 *   transform, animaciones CSS de Reanimated que corren en el hilo de UI; sin renders por fotograma.
 * - "Reducir movimiento": sin bucles, sin escalas ni giros; queda el cambio de opacidad al presionar.
 */
import React, { memo, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Reanimated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { Leaf, LeafDefs } from '../tabbar/Leaves';

const CSS_EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);
const CSS_EASE_IN_OUT = cubicBezier(0.45, 0, 0.55, 1);

const breathe = {
  from: { opacity: 0.55 },
  to: { opacity: 1 },
};
const sway = {
  from: { transform: [{ rotate: '-3deg' }] },
  to: { transform: [{ rotate: '3deg' }] },
};

// Motas del sustrato (deterministas).
const SOIL_SPECKS = [
  [38, 79, 0.9], [44, 82, 0.7], [57, 80, 0.8], [63, 78, 0.6], [51, 84, 0.7], [34, 77, 0.5], [67, 81, 0.6],
] as const;

/** Esfera, semilla, tallo, icono y reflejos (todo dentro del círculo). */
const Sphere = memo(function Sphere({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" pointerEvents="none">
      <Defs>
        <RadialGradient id="cfbBase" cx="50%" cy="62%" rx="58%" ry="58%">
          <Stop offset="0" stopColor="#7FCB35" />
          <Stop offset="0.45" stopColor="#2F8A2A" />
          <Stop offset="0.8" stopColor="#145B24" />
          <Stop offset="1" stopColor="#073F20" />
        </RadialGradient>
        <LinearGradient id="cfbSoil" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#7A5530" />
          <Stop offset="1" stopColor="#3A2412" />
        </LinearGradient>
        <RadialGradient id="cfbSeed" cx="38%" cy="32%" rx="70%" ry="70%">
          <Stop offset="0" stopColor="#C98B52" />
          <Stop offset="0.5" stopColor="#8A5228" />
          <Stop offset="1" stopColor="#4A2810" />
        </RadialGradient>
        <LinearGradient id="cfbStem" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor="#9BD13A" />
          <Stop offset="1" stopColor="#5FA82A" />
        </LinearGradient>
        <LinearGradient id="cfbGloss" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
        <ClipPath id="cfbClip">
          <Circle cx={50} cy={50} r={48} />
        </ClipPath>
      </Defs>

      {/* esfera base */}
      <Circle cx={50} cy={50} r={48} fill="url(#cfbBase)" />

      <G clipPath="url(#cfbClip)">
        {/* sustrato */}
        <Ellipse cx={50} cy={86} rx={30} ry={11} fill="url(#cfbSoil)" />
        <Ellipse cx={50} cy={77} rx={24} ry={3.2} fill="#6FA332" opacity={0.45} />
        {SOIL_SPECKS.map(([x, y, r], i) => (
          <Circle key={i} cx={x} cy={y} r={r} fill={i % 2 ? '#A07448' : '#2A180A'} opacity={0.8} />
        ))}

        {/* tallo: nace de la semilla y sube hasta las hojas */}
        <Path d="M50.5 70 C49 56 52 40 50 14" stroke="url(#cfbStem)" strokeWidth={2.6} strokeLinecap="round" fill="none" />

        {/* semilla germinando */}
        <G transform="rotate(-12 50 74)">
          <Ellipse cx={50} cy={74} rx={10.5} ry={7.5} fill="url(#cfbSeed)" />
          <Path d="M41 73.5 C46 71.5 54 71.5 59.5 74" stroke="#3A1E0A" strokeOpacity={0.6} strokeWidth={0.9} fill="none" />
          <Ellipse cx={46} cy={70.6} rx={3.6} ry={1.6} fill="#FFFFFF" opacity={0.3} />
        </G>
      </G>

      {/* icono de chat grabado en el cristal */}
      <Path
        d="M50 31 C39.5 31 32 37.6 32 45.6 C32 50 34.3 53.9 38 56.5 L36.4 63 L43.6 59.3 C45.6 59.9 47.8 60.2 50 60.2 C60.5 60.2 68 53.6 68 45.6 C68 37.6 60.5 31 50 31 Z"
        fill="#F9F6E9"
        fillOpacity={0.2}
        stroke="#F4FFD9"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <Circle cx={42.5} cy={45.6} r={2.2} fill="#F4FFD9" />
      <Circle cx={50} cy={45.6} r={2.2} fill="#F4FFD9" />
      <Circle cx={57.5} cy={45.6} r={2.2} fill="#F4FFD9" />

      {/* reflejos del cristal */}
      <Path d="M20 34 C26 18 42 10 58 11 C44 14 31 22 25 36 Z" fill="url(#cfbGloss)" />
      <Path d="M80 70 C76 78 70 84 62 88" stroke="#E6ED7A" strokeOpacity={0.3} strokeWidth={1.4} strokeLinecap="round" fill="none" />
      {/* borde fino luminoso */}
      <Circle cx={50} cy={50} r={47.2} fill="none" stroke="#B9F62F" strokeOpacity={0.55} strokeWidth={1.2} />
      <Circle cx={50} cy={50} r={48.6} fill="none" stroke="#04260F" strokeOpacity={0.5} strokeWidth={0.8} />
    </Svg>
  );
});

/** Luz interna (capa que respira): un resplandor lima suave en el centro-bajo de la esfera. */
const InnerLight = memo(function InnerLight({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" pointerEvents="none">
      <Defs>
        <RadialGradient id="cfbInner" cx="50%" cy="64%" rx="42%" ry="42%">
          <Stop offset="0" stopColor="#E6ED7A" stopOpacity="0.55" />
          <Stop offset="0.6" stopColor="#B9F62F" stopOpacity="0.16" />
          <Stop offset="1" stopColor="#B9F62F" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={50} cy={50} r={47} fill="url(#cfbInner)" />
    </Svg>
  );
});

/** Halo exterior muy discreto. */
const Halo = memo(function Halo({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} pointerEvents="none">
      <Defs>
        <RadialGradient id="cfbHalo" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0.62" stopColor="#B9F62F" stopOpacity="0.32" />
          <Stop offset="1" stopColor="#B9F62F" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#cfbHalo)" />
    </Svg>
  );
});

/** Dos hojas que brotan del tallo; origen (30, 28) del viewBox = punta del tallo. */
const Sprout = memo(function Sprout({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 60 28" pointerEvents="none">
      <LeafDefs ids="cfbLeaf" />
      <Leaf ids="cfbLeaf" x={30} y={27} angle={-150} length={24} width={1.2} />
      <Leaf ids="cfbLeaf" x={30} y={27} angle={-32} length={28} width={1.15} />
    </Svg>
  );
});

type Props = {
  onPress: () => void;
  /** Diámetro del círculo; debe coincidir con el del botón anterior (58 / 70). */
  size?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function ChatbotFloatingButton({ onPress, size = 58, style, accessibilityLabel = 'Abrir asistente' }: Props) {
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();

  // Las hojas: 60 % del diámetro de ancho; su base (punta del tallo) está al 14 % desde arriba,
  // así que asoman ~14 % del diámetro por encima del círculo.
  const sproutW = size * 0.6;
  const sproutH = size * 0.28;
  const stemTop = size * 0.14;
  const halo = size * 1.32;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
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
        {/* halo verde claro (más intenso al presionar) */}
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

        {/* sombra / elevación: disco del mismo tamaño. En Android `elevation` eleva la vista sobre sus
            hermanas, por eso la esfera, la luz y las hojas van dentro de ella. */}
        <View pointerEvents="none" style={[styles.shadow, { width: size, height: size, borderRadius: size / 2 }]}>
          <Sphere size={size} />

          <Reanimated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              reduced
                ? { opacity: 0.8 }
                : {
                    animationName: breathe,
                    animationDuration: 3600,
                    animationIterationCount: 'infinite',
                    animationDirection: 'alternate',
                    animationTimingFunction: CSS_EASE_IN_OUT,
                  },
            ]}
          >
            <InnerLight size={size} />
          </Reanimated.View>

          {/* hojas: se mecen en reposo e inclinan un poco más al presionar */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: (size - sproutW) / 2,
              top: stemTop - sproutH,
              width: sproutW,
              height: sproutH,
            }}
          >
            <Reanimated.View
              style={[
                { width: sproutW, height: sproutH, transformOrigin: '50% 96%' },
                reduced
                  ? null
                  : {
                      animationName: sway,
                      animationDuration: 4400,
                      animationIterationCount: 'infinite',
                      animationDirection: 'alternate',
                      animationTimingFunction: CSS_EASE_IN_OUT,
                    },
              ]}
            >
              <Reanimated.View
                style={{
                  width: sproutW,
                  height: sproutH,
                  transformOrigin: '50% 96%',
                  transform: [{ rotate: pressed && !reduced ? '-6deg' : '0deg' }, { scale: pressed && !reduced ? 1.06 : 1 }],
                  transitionProperty: 'transform',
                  transitionDuration: 160,
                  transitionTimingFunction: CSS_EASE_OUT,
                }}
              >
                <Sprout width={sproutW} height={sproutH} />
              </Reanimated.View>
            </Reanimated.View>
          </View>
        </View>
      </Reanimated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    position: 'absolute',
    left: 0,
    top: 0,
    backgroundColor: '#0B4A22',
    shadowColor: '#06331A',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 7,
  },
});
