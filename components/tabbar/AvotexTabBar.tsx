/**
 * Barra de navegación inferior de AVOTEX: plataforma vegetal flotante con medio aguacate
 * como botón central de Escanear, hojas en las esquinas y divisiones entre opciones.
 *
 * Se usa como `tabBar` del <Tabs> de Expo Router. Conserva el mismo contrato que la barra por defecto:
 * emite `tabPress` / `tabLongPress` con `emitter` y cambia de pestaña con `navigateToTab(route.key)`.
 *
 * Movimiento (skill animate-expo):
 * - Cambio de pestaña: sin desplazamientos de pantalla; solo el indicador lima y una escala leve
 *   del icono, transición CSS de 180 ms (ease-out). Presión: escala 0.92 en 120 ms.
 * - Aguacate al activarse: sube 4 dp y escala 1.04, el contorno lima y el halo se encienden (220 ms).
 * - Hojas: un fundido de entrada al montar; quietas después. Nada se anima en bucle.
 * - "Reducir movimiento": se quitan escalas y traslaciones, se conservan los cambios de opacidad.
 */
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, { FadeIn, cubicBezier, useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { BarBody, type Separator } from './BarBody';
import { LeafCluster } from './Leaves';
import { AVOCADO_PIT, AVOCADO_VIEWBOX, AvocadoArt, AvocadoGlow, AvocadoHalo } from './AvocadoArt';
import { ActivityIcon, CameraIcon, GearIcon, HomeIcon, LockIcon, MapIcon, SatelliteIcon, type NavIconProps } from './TabIcons';
import { NAV } from './palette';

const CSS_EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);

/** Orden fijo de las seis opciones visibles. */
export const AVOTEX_TABS = ['index', 'scan', 'mapping', 'results', 'satelite', 'settings'] as const;
type TabName = (typeof AVOTEX_TABS)[number];
const SCAN_WEIGHT = 1.6;
const MOUND_PAD = 14;
const SHADOW_PAD = 14;
const ROW_PAD = 4;

const ICONS: Record<Exclude<TabName, 'scan'>, (p: NavIconProps) => React.ReactElement> = {
  index: HomeIcon,
  mapping: MapIcon,
  results: ActivityIcon,
  satelite: SatelliteIcon,
  settings: GearIcon,
};

/** Medidas de la barra según la pantalla y los insets reales. */
export function useAvotexTabBarMetrics() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tablet = width >= 768;
  const narrow = width < 350;
  const margin = tablet ? 40 : narrow ? 8 : 10;
  const barW = Math.min(width - margin * 2, tablet ? 760 : 9999);
  const barH = tablet ? 76 : 66;
  // Separación visible bajo la barra, además del área segura (indicador de inicio / barra de gestos).
  const bottom = insets.bottom + (tablet ? 16 : 12);
  const unit = (barW - ROW_PAD * 2) / (AVOTEX_TABS.length - 1 + SCAN_WEIGHT);
  const scanW = unit * SCAN_WEIGHT;
  const avoW = Math.min(scanW - 2, tablet ? 104 : 88);
  const avoH = (avoW * AVOCADO_VIEWBOX.h) / AVOCADO_VIEWBOX.w;
  const avoBottom = 8;
  // Lo que sobresale el aguacate sobre la barra + margen para la elevación activa.
  const topRoom = Math.ceil(avoH + avoBottom - barH + 6);
  return {
    width, tablet, narrow, barW, barH, bottom, unit, scanW, avoW, avoH, avoBottom, topRoom,
    /** Distancia desde el borde inferior de la pantalla hasta el borde superior del cuerpo de la barra. */
    barTop: bottom + barH,
    labelSize: tablet ? 13 : narrow ? 9.5 : width < 400 ? 10.5 : 11,
    iconSize: tablet ? 27 : narrow ? 21 : 24,
  };
}

/** Props que Expo Router entrega a `tabBar` (state, descriptors, emitter, navigateToTab, insets). */
type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

type Props = BottomTabBarProps & {
  hidden?: boolean;
  /** Pestañas bloqueadas (invitado): muestran candado y llaman a onLocked. */
  locked?: ReadonlySet<string>;
  onLocked?: () => void;
  labels: Record<TabName, string>;
};

export function AvotexTabBar({ state, emitter, navigateToTab, hidden, locked, onLocked, labels }: Props) {
  const m = useAvotexTabBarMetrics();
  const reduced = useReducedMotion();
  if (hidden) return null;

  const focusedName = state.routes[state.index]?.name;
  const scanCx = ROW_PAD + m.unit + m.scanW / 2;

  // Divisiones en los límites entre opciones; las que rodean al aguacate son más cortas y bajas.
  const separators: Separator[] = [];
  let x = ROW_PAD;
  AVOTEX_TABS.forEach((name, i) => {
    x += name === 'scan' ? m.scanW : m.unit;
    if (i === AVOTEX_TABS.length - 1) return;
    const nearScan = name === 'scan' || AVOTEX_TABS[i + 1] === 'scan';
    separators.push(nearScan ? { x, len: 24, dy: 6 } : { x, len: m.tablet ? 36 : 32 });
  });

  const press = (name: TabName) => {
    const route = state.routes.find(r => r.name === name);
    if (!route) return;
    if (locked?.has(name)) {
      onLocked?.();
      return;
    }
    const focused = focusedName === name;
    const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
      navigateToTab(route.key);
    }
  };
  const longPress = (name: TabName) => {
    const route = state.routes.find(r => r.name === name);
    if (route) emitter.emit({ type: 'tabLongPress', target: route.key });
  };

  const leafSize = m.tablet ? 78 : 66;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.root,
        { left: (m.width - m.barW) / 2, width: m.barW, bottom: m.bottom, height: m.topRoom + m.barH },
      ]}
    >
      {/* 1–3. Sombra, cuerpo vegetal, relieve y divisiones */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: m.topRoom - MOUND_PAD }}>
        <BarBody
          width={m.barW}
          height={m.barH}
          moundPad={MOUND_PAD}
          shadowPad={SHADOW_PAD}
          moundX={scanCx}
          separators={separators}
        />
      </View>

      {/* 4. Hojas en las esquinas (decorativas, no interceptan toques) */}
      <Reanimated.View
        pointerEvents="none"
        entering={reduced ? undefined : FadeIn.duration(450)}
        style={{ position: 'absolute', left: -leafSize * 0.3, top: m.topRoom - leafSize * 0.8 }}
      >
        <LeafCluster size={leafSize} ids="avxLeafL" />
      </Reanimated.View>
      <Reanimated.View
        pointerEvents="none"
        entering={reduced ? undefined : FadeIn.duration(450)}
        style={{
          position: 'absolute',
          right: -leafSize * 0.3,
          top: m.topRoom - leafSize * 0.8,
          transform: [{ scaleX: -1 }],
        }}
      >
        <LeafCluster size={leafSize} ids="avxLeafR" />
      </Reanimated.View>

      {/* 5–8. Opciones */}
      <View pointerEvents="box-none" style={[styles.row, { paddingHorizontal: ROW_PAD }]}>
        {AVOTEX_TABS.map(name =>
          name === 'scan' ? (
            <ScanTab
              key={name}
              label={labels.scan}
              focused={focusedName === 'scan'}
              reduced={reduced}
              m={m}
              onPress={() => press('scan')}
              onLongPress={() => longPress('scan')}
            />
          ) : (
            <NavTab
              key={name}
              name={name}
              label={labels[name]}
              focused={focusedName === name}
              locked={!!locked?.has(name)}
              reduced={reduced}
              m={m}
              onPress={() => press(name)}
              onLongPress={() => longPress(name)}
            />
          ),
        )}
      </View>
    </View>
  );
}

type Metrics = ReturnType<typeof useAvotexTabBarMetrics>;

function NavTab({
  name, label, focused, locked, reduced, m, onPress, onLongPress,
}: {
  name: Exclude<TabName, 'scan'>;
  label: string;
  focused: boolean;
  locked: boolean;
  reduced: boolean;
  m: Metrics;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const Icon = locked ? LockIcon : ICONS[name];
  const color = locked ? 'rgba(249,246,233,0.55)' : focused ? '#FFFFFF' : NAV.creamDim;
  const accent = focused ? NAV.lime : NAV.limeDim;
  const scale = reduced ? 1 : pressed ? 0.92 : focused ? 1.08 : 1;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      aria-selected={focused}
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      pressRetentionOffset={16}
      style={[styles.tab, { width: m.unit, height: m.barH }]}
    >
      <Reanimated.View
        style={{
          transform: [{ scale }],
          transitionProperty: 'transform',
          transitionDuration: pressed ? 120 : 180,
          transitionTimingFunction: CSS_EASE_OUT,
        }}
      >
        <Icon size={m.iconSize} color={color} accent={accent} />
      </Reanimated.View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        allowFontScaling={false}
        style={[
          styles.label,
          { fontSize: m.labelSize, color: focused ? '#FFFFFF' : NAV.creamDim },
          focused && styles.labelActive,
        ]}
      >
        {label}
      </Text>
      {/* Indicador activo: línea lima luminosa bajo la etiqueta */}
      <Reanimated.View
        pointerEvents="none"
        style={[
          styles.indicator,
          {
            bottom: m.tablet ? 7 : 5,
            opacity: focused ? 1 : 0,
            transform: [{ scaleX: focused || reduced ? 1 : 0.4 }],
            transitionProperty: ['opacity', 'transform'],
            transitionDuration: 180,
            transitionTimingFunction: CSS_EASE_OUT,
          },
        ]}
      />
    </Pressable>
  );
}

function ScanTab({
  label, focused, reduced, m, onPress, onLongPress,
}: {
  label: string;
  focused: boolean;
  reduced: boolean;
  m: Metrics;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const { avoW, avoH, avoBottom } = m;
  const k = avoW / AVOCADO_VIEWBOX.w;
  const pitX = AVOCADO_PIT.cx * k;
  const pitY = AVOCADO_PIT.cy * k;
  const camSize = m.tablet ? 30 : 26;

  const lift = reduced ? 0 : focused ? -4 : 0;
  const scale = reduced ? 1 : pressed ? 0.97 : focused ? 1.04 : 1;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      aria-selected={focused}
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      pressRetentionOffset={16}
      style={{ width: m.scanW, height: m.topRoom + m.barH, alignItems: 'center' }}
    >
      {/* halo verde suave detrás del aguacate */}
      <Reanimated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: avoBottom - avoH * 0.05,
          width: avoW * 1.55,
          height: avoH * 1.05,
          opacity: focused ? 1 : 0.45,
          transitionProperty: 'opacity',
          transitionDuration: 220,
          transitionTimingFunction: CSS_EASE_OUT,
        }}
      >
        <AvocadoHalo width={avoW * 1.55} height={avoH * 1.05} />
      </Reanimated.View>

      <Reanimated.View
        style={{
          position: 'absolute',
          bottom: avoBottom,
          width: avoW,
          height: avoH,
          transform: [{ translateY: lift }, { scale }],
          transitionProperty: 'transform',
          transitionDuration: pressed ? 120 : 220,
          transitionTimingFunction: CSS_EASE_OUT,
        }}
      >
        <AvocadoArt width={avoW} height={avoH} />

        {/* iluminación: inactivo un poco más apagado; activo con contorno lima luminoso */}
        <Reanimated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: focused ? 1 : 0.25,
              transitionProperty: 'opacity',
              transitionDuration: 220,
              transitionTimingFunction: CSS_EASE_OUT,
            },
          ]}
        >
          <AvocadoGlow width={avoW} height={avoH} />
        </Reanimated.View>

        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: pitX - camSize / 2, top: pitY - camSize / 2 - 6 }}
        >
          <CameraIcon size={camSize} color={NAV.cream} />
        </View>
        <Text
          numberOfLines={1}
          allowFontScaling={false}
          style={[
            styles.scanLabel,
            { fontSize: m.narrow ? m.labelSize - 0.5 : m.labelSize, top: pitY + camSize / 2 - 7, left: 0, right: 0 },
          ]}
        >
          {label}
        </Text>
      </Reanimated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
  },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 6,
  },
  label: {
    fontFamily: 'Poppins_600SemiBold',
    marginTop: 3,
    letterSpacing: -0.1,
    includeFontPadding: false,
  },
  labelActive: {
    textShadowColor: 'rgba(185,246,47,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  indicator: {
    position: 'absolute',
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: NAV.lime,
    shadowColor: NAV.lime,
    shadowOpacity: 0.9,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  scanLabel: {
    position: 'absolute',
    textAlign: 'center',
    fontFamily: 'Poppins_600SemiBold',
    color: '#FFFFFF',
    includeFontPadding: false,
    textShadowColor: 'rgba(20,10,2,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
