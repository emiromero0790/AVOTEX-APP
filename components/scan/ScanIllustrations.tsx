/**
 * Ilustraciones vectoriales del apartado Escanear (sin imágenes externas, se ven nítidas en cualquier pantalla).
 */
import React from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

type Props = { size?: number };

/** Persona con el teléfono sujeto al pecho con un arnés; la cámara mira hacia adelante. */
export function ChestMountIllustration({ size = 96 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id="shirt" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#d1fae5" />
          <Stop offset="1" stopColor="#a7f3d0" />
        </LinearGradient>
        <LinearGradient id="phone" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#1f2937" />
          <Stop offset="1" stopColor="#0b1220" />
        </LinearGradient>
      </Defs>
      <Circle cx="60" cy="60" r="58" fill="#ecfdf5" />
      {/* torso y cuello */}
      <Path d="M22 118 C 22 84, 34 70, 60 70 C 86 70, 98 84, 98 118 Z" fill="url(#shirt)" />
      <Path d="M50 58 L70 58 L72 72 C 66 76, 54 76, 48 72 Z" fill="#f2c7a5" />
      <Circle cx="60" cy="42" r="17" fill="#f2c7a5" />
      <Path d="M41 38 C 42 22, 78 22, 79 38 C 72 32, 50 32, 41 38 Z" fill="#334155" />
      {/* arnés: tirantes y correa de pecho */}
      <Path d="M38 76 L58 100" stroke="#0f172a" strokeWidth={7} strokeLinecap="round" />
      <Path d="M82 76 L62 100" stroke="#0f172a" strokeWidth={7} strokeLinecap="round" />
      <Path d="M28 104 L92 104" stroke="#0f172a" strokeWidth={7} strokeLinecap="round" />
      {/* teléfono */}
      <Rect x="48" y="80" width="24" height="38" rx="5" fill="url(#phone)" stroke="#475569" strokeWidth={1.5} />
      <Circle cx="55" cy="87" r="3.2" fill="#0ea5e9" stroke="#e2e8f0" strokeWidth={1.2} />
      <Circle cx="64" cy="87" r="2.2" fill="#334155" />
      {/* captura automática */}
      <G stroke="#0f766e" strokeWidth={2.6} strokeLinecap="round" fill="none">
        <Path d="M78 86 C 84 89, 84 97, 78 100" opacity={0.9} />
        <Path d="M85 81 C 95 87, 95 99, 85 105" opacity={0.6} />
        <Path d="M92 76 C 106 85, 106 101, 92 110" opacity={0.35} />
      </G>
    </Svg>
  );
}

/** Ruta punteada por la huerta con los puntos donde se toma cada foto. */
export function WalkPathIllustration({ size = 96 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx="60" cy="60" r="58" fill="#ecfdf5" />
      {[[26, 34], [92, 30], [30, 86], [94, 84]].map(([x, y], i) => (
        <G key={i}>
          <Rect x={x - 2} y={y + 8} width={4} height={12} rx={2} fill="#7c5a3a" />
          <Circle cx={x} cy={y} r={13} fill="#22c55e" />
          <Circle cx={x - 4} cy={y - 3} r={7} fill="#4ade80" />
          <Path d={`M${x + 3} ${y + 2} c 3 -1 4 2 3 5 c -2 3 -6 2 -6 -1 c 0 -2 1 -3 3 -4 z`} fill="#166534" />
        </G>
      ))}
      <Path d="M60 112 C 52 92, 70 80, 60 62 S 56 30, 60 14" stroke="#0f766e" strokeWidth={3.2} strokeLinecap="round" strokeDasharray="1 8" fill="none" />
      {[[60, 104], [58, 80], [61, 58], [58, 36]].map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={4.6} fill="#ffffff" stroke="#0f766e" strokeWidth={2.4} />
      ))}
      <Circle cx="60" cy="14" r="6.5" fill="#0f766e" />
      <Path d="M57 14 L59.5 16.5 L63.5 11.5" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/** Fotos seleccionadas que pasan por la IA y salen con un diagnóstico. */
export function AiAnalyzeIllustration({ size = 96 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx="60" cy="60" r="58" fill="#ecfdf5" />
      <Rect x="18" y="30" width="34" height="26" rx="6" fill="#bbf7d0" transform="rotate(-8 35 43)" />
      <Rect x="22" y="36" width="34" height="26" rx="6" fill="#86efac" stroke="#ffffff" strokeWidth={2} />
      <Path d="M30 56 l7 -9 l6 6 l4 -4 l7 7 z" fill="#166534" opacity={0.7} />
      <Path d="M58 49 L70 49" stroke="#0f766e" strokeWidth={3} strokeLinecap="round" strokeDasharray="2 5" />
      <Circle cx="86" cy="49" r="17" fill="#0f766e" />
      <Path d="M86 38 l2.6 7.4 l7.4 2.6 l-7.4 2.6 l-2.6 7.4 l-2.6 -7.4 l-7.4 -2.6 l7.4 -2.6 z" fill="#ecfdf5" />
      <Rect x="26" y="76" width="68" height="22" rx="11" fill="#ffffff" stroke="#bbf7d0" strokeWidth={2} />
      <Circle cx="38" cy="87" r="5" fill="#22c55e" />
      <Rect x="48" y="83" width="34" height="4" rx="2" fill="#0f766e" opacity={0.8} />
      <Rect x="48" y="90" width="22" height="3" rx="1.5" fill="#94a3b8" />
    </Svg>
  );
}
