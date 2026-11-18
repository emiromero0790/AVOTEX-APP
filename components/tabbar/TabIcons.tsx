/**
 * Iconos de navegación de AVOTEX: SVG ligeros con trazo uniforme (1.8) en color crema
 * y pequeños acentos lima. Todos usan el mismo viewBox 24×24 para un tamaño visual parejo.
 */
import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type NavIconProps = { size: number; color: string; accent: string };

const S = { strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

export function HomeIcon({ size, color, accent }: NavIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3.2 11.2 L12 4 L20.8 11.2" stroke={color} {...S} />
      <Path d="M5.6 9.6 V19.6 H18.4 V9.6" stroke={color} {...S} />
      <Path d="M10 19.6 V14.6 H14 V19.6" stroke={color} {...S} />
      {/* brote */}
      <Path d="M16.2 6.6 C16.6 4.6 18.3 3.3 20.6 3.3 C20.4 5.4 18.7 6.7 16.2 6.6 Z" fill={accent} />
    </Svg>
  );
}

export function MapIcon({ size, color, accent }: NavIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 6.6 L9 4 L15 6.6 L21 4 V17.4 L15 20 L9 17.4 L3 20 Z" stroke={color} {...S} />
      <Path d="M9 4 V17.4 M15 6.6 V20" stroke={color} {...S} />
      {/* surcos */}
      <Path d="M10.9 9.6 L13.1 10.5 M10.9 13 L13.1 13.9" stroke={accent} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function ActivityIcon({ size, color, accent }: NavIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 20.4 H21" stroke={color} {...S} />
      <Path d="M6.2 17.4 V14.6 M11 17.4 V11.4 M15.8 17.4 V9.2" stroke={color} {...S} strokeWidth={2.8} />
      {/* brote sobre la barra más alta */}
      <Path d="M15.8 7.4 C15.8 5 17.3 3.4 19.9 3.2 C19.9 5.6 18.3 7.2 15.8 7.4 Z" fill={accent} />
      <Path d="M15.8 7.6 C15.4 6 14.2 5 12.6 4.9 C12.7 6.5 13.9 7.5 15.8 7.6 Z" fill={accent} opacity={0.75} />
    </Svg>
  );
}

export function SatelliteIcon({ size, color, accent }: NavIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 9 L15 12 L12 15 L9 12 Z" stroke={color} {...S} />
      <Path d="M3.6 7 L7 3.6 L9.6 6.2 L6.2 9.6 Z" stroke={color} {...S} />
      <Path d="M14.4 17.8 L17.8 14.4 L20.4 17 L17 20.4 Z" stroke={color} {...S} />
      <Path d="M7.9 7.9 L10.5 10.5 M13.5 13.5 L16.1 16.1" stroke={color} {...S} />
      <Path d="M13.6 10.4 L15.4 8.6" stroke={color} {...S} />
      {/* señal */}
      <Path d="M16.6 6.2 A2.6 2.6 0 0 1 17.8 7.4" stroke={accent} {...S} />
      <Path d="M17 3.3 A5.4 5.4 0 0 1 20.7 7" stroke={accent} {...S} />
    </Svg>
  );
}

export function GearIcon({ size, color }: NavIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
        stroke={color}
        {...S}
      />
      <Circle cx={12} cy={12} r={3} stroke={color} {...S} />
    </Svg>
  );
}

export function LockIcon({ size, color }: NavIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={4.5} y={10.5} width={15} height={10} rx={2.2} stroke={color} {...S} />
      <Path d="M8 10.5 V7.5 a4 4 0 0 1 8 0 V10.5" stroke={color} {...S} />
      <Circle cx={12} cy={15.5} r={1.3} fill={color} />
    </Svg>
  );
}

export function CameraIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M3.6 8.8 a2 2 0 0 1 2-2 h2.2 l1.6-2.2 h5.2 l1.6 2.2 h2.2 a2 2 0 0 1 2 2 v9 a2 2 0 0 1-2 2 H5.6 a2 2 0 0 1-2-2 Z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={12} cy={13.2} r={3.5} stroke={color} strokeWidth={2} fill="none" />
    </Svg>
  );
}
