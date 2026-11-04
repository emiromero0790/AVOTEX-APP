/**
 * Movimiento compartido del apartado Escanear.
 *
 * Reglas (skill animate-expo):
 * - Solo se anima transform y opacity (salvo rellenos absolutos sin hijos, como una barra de progreso).
 * - Nunca ease-in en UI. Curvas fuertes de salida para todo lo que entra o responde a un toque.
 * - Cada animación respeta "Reducir movimiento": se quitan escalas, traslaciones y bucles, se conserva la opacidad.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import Reanimated, { Easing, cubicBezier, useReducedMotion } from 'react-native-reanimated';

// Propiedades que definen el lugar del botón dentro de su contenedor: van en el Pressable exterior
// (si se quedaran en la vista interior, `flex: 1` en una fila no repartiría el ancho).
const OUTER_KEYS = ['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'width', 'minWidth', 'maxWidth', 'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical', 'position', 'top', 'left', 'right', 'bottom', 'zIndex'] as const;

export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
/** Misma curva de salida, en el formato de las transiciones CSS de Reanimated. */
export const CSS_EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);

type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  /** Escala al presionar. 0.97 para tarjetas y botones; algo menor solo para el disparador de la cámara. */
  pressedScale?: number;
};

/**
 * Botón que se hunde al instante al tocarlo (feedback en press-in, acción en press-out).
 * Transición CSS de 120 ms: no hay valores compartidos ni renders por fotograma.
 */
export function PressableScale({ style, children, pressedScale = 0.97, disabled, onPressIn, onPressOut, ...rest }: PressableScaleProps) {
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();
  const scale = pressed && !disabled && !reduced ? pressedScale : 1;
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = { ...flat };
  for (const k of OUTER_KEYS) {
    if (k in flat) { outer[k] = flat[k]; delete inner[k]; }
  }
  // La vista interior llena al Pressable cuando este recibe el tamaño.
  if ('flex' in outer || 'width' in outer || 'flexGrow' in outer) inner.flexGrow = 1;
  return (
    <Pressable
      {...rest}
      style={outer as ViewStyle}
      disabled={disabled}
      hitSlop={rest.hitSlop ?? 8}
      pressRetentionOffset={rest.pressRetentionOffset ?? 16}
      onPressIn={e => { setPressed(true); onPressIn?.(e); }}
      onPressOut={e => { setPressed(false); onPressOut?.(e); }}
    >
      <Reanimated.View
        style={[
          inner as ViewStyle,
          {
            transform: [{ scale }],
            // Con "Reducir movimiento" el feedback es un leve cambio de opacidad en lugar de escala.
            opacity: pressed && reduced && !disabled ? 0.85 : 1,
            transitionProperty: ['transform', 'opacity'],
            transitionDuration: 120,
            transitionTimingFunction: CSS_EASE_OUT,
          },
        ]}
      >
        {children}
      </Reanimated.View>
    </Pressable>
  );
}

const pulseKeyframes = {
  from: { transform: [{ scale: 0.6 }], opacity: 0.8 },
  to: { transform: [{ scale: 1.9 }], opacity: 0 },
};

/**
 * Anillo que se expande y desvanece en bucle (animación CSS, corre en el hilo de UI).
 * Se usa como única animación continua de cada pantalla para indicar "captura activa".
 * Con "Reducir movimiento" no se dibuja; el punto central basta para comunicar el estado.
 */
export function PulseRing({ size, color, paused = false, style }: { size: number; color: string; paused?: boolean; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <Reanimated.View
      pointerEvents="none"
      style={[
        pulseStyles.ring,
        { width: size, height: size, borderRadius: size / 2, borderColor: color, marginLeft: -size / 2, marginTop: -size / 2 },
        style,
        {
          animationName: pulseKeyframes,
          animationDuration: 1800,
          animationIterationCount: 'infinite',
          animationTimingFunction: CSS_EASE_OUT,
          animationPlayState: paused ? 'paused' : 'running',
        },
      ]}
    />
  );
}

const pulseStyles = StyleSheet.create({
  ring: { position: 'absolute', left: '50%', top: '50%', borderWidth: 2 },
});
