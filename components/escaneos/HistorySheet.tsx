/**
 * Panel inferior del historial de «Mis escaneos»: tres alturas (contraído, intermedio, expandido).
 *
 * Por qué así (y no el panel anterior):
 * - El panel vive a nivel de pantalla, no dentro de la tarjeta del mapa: su altura máxima es la
 *   pantalla menos la barra de estado, así que «expandido» llega de verdad hasta arriba.
 * - La lista es un FlatList virtualizado dentro del panel (no un ScrollView con todas las filas).
 * - Gestos (Gesture Handler + Reanimated, todo en el hilo de UI):
 *     · Cabecera: siempre arrastra el panel.
 *     · Lista, en contraído o intermedio: el desplazamiento de la lista está apagado y arrastrar
 *       en cualquier parte mueve el panel (no hay dos cosas compitiendo por el mismo gesto).
 *     · Lista, expandido: la lista se desplaza normal. Solo si está en su inicio y el dedo baja,
 *       el gesto pasa al panel para contraerlo (activación manual: si no se cumple, el gesto
 *       falla de inmediato y el desplazamiento nativo sigue sin interferencia).
 * - Al soltar: decide por velocidad (un movimiento rápido salta a la siguiente altura) o por cercanía,
 *   y asienta con un resorte sin rebote que conserva la velocidad del dedo.
 * - Los botones de expandir/contraer los pone la pantalla: solo cambian `index`.
 *
 * Movimiento (animate-expo): resorte { duration 320, dampingRatio 1 }; con "Reducir movimiento",
 * cambio directo. Vibración ligera al llegar a otra altura.
 */
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type FlatListProps, type ListRenderItem } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';

const SPRING = { duration: 320, dampingRatio: 1 };
/** Movimiento mínimo (px) antes de decidir quién se queda con el gesto. */
const SLOP = 8;

// Mientras se arrastra el panel (y 300 ms después), los toques dentro de él no cuentan: el dedo
// arrastra el panel y la tarjeta que tenía debajo se mueve con él, así que al soltar parecería un toque.
let dragging = false;
let dragEndedAt = 0;
const markDrag = () => { dragging = true; };
const markDragEnd = () => { dragging = false; dragEndedAt = Date.now(); };
/** true si el último toque fue en realidad un arrastre del panel (para ignorar onPress). */
export function sheetJustDragged() { return dragging || Date.now() - dragEndedAt < 300; }

export type HistorySheetHandle = {
  scrollToIndex: (i: number) => void;
  scrollToTop: () => void;
};

type Props<T> = {
  /** Alturas visibles [contraído, intermedio, expandido], incluido el espacio de la barra inferior. */
  snaps: [number, number, number];
  index: 0 | 1 | 2;
  onIndexChange: (i: 0 | 1 | 2) => void;
  reduced: boolean;
  /** Desplazamiento vertical del panel (0 = expandido). Lo lee la pantalla para el botón de ubicación. */
  y: SharedValue<number>;
  header: React.ReactNode;
  /** Botón explícito junto al asa (expandir / bajar). Los toques cortos no mueven el panel. */
  accessory?: React.ReactNode;
  /** Espacio libre al fondo de la lista (barra de pestañas flotante + margen). */
  bottomPad: number;
  data: readonly T[];
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T, i: number) => string;
  ListHeaderComponent?: FlatListProps<T>['ListHeaderComponent'];
  ListEmptyComponent?: FlatListProps<T>['ListEmptyComponent'];
  extraData?: unknown;
  a11yLabel: string;
  a11yExpand: string;
  a11yCollapse: string;
};

function HistorySheetInner<T>(props: Props<T>, ref: React.Ref<HistorySheetHandle>) {
  const { snaps, index, onIndexChange, reduced, y, header, accessory, bottomPad, data, renderItem, keyExtractor, ListHeaderComponent, ListEmptyComponent, extraData } = props;
  const full = snaps[2];
  const idx = useSharedValue<number>(index);
  const start = useSharedValue(0);
  const touchX = useSharedValue(0);
  const touchY = useSharedValue(0);
  const scrollY = useSharedValue(0);
  // Un arrastre empezó (aunque luego se cancele): al terminar SIEMPRE se libera el bloqueo de toques.
  const dragActive = useSharedValue(false);
  const dragEnded = useSharedValue(false);
  const list = useRef<React.ComponentRef<typeof Reanimated.FlatList>>(null);
  const [scrollEnabled, setScrollEnabled] = useState(index === 2);
  // Si la altura la eligió el propio gesto, el resorte ya va en camino: no se reinicia.
  const fromGesture = useRef(false);

  // Altura pedida desde fuera (botones, selección, cambio de tamaño de pantalla).
  useEffect(() => {
    idx.set(index);
    const target = full - snaps[index];
    if (fromGesture.current) fromGesture.current = false;
    else y.set(reduced ? withTiming(target, { duration: 0 }) : withSpring(target, SPRING));
    setScrollEnabled(index === 2);
    // Al contraer, la lista vuelve a su inicio para que el próximo arrastre no la encuentre a medias.
    if (index !== 2) list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [index, full, snaps, reduced, y, idx]);

  useImperativeHandle(ref, () => ({
    scrollToIndex: (i: number) => {
      try { list.current?.scrollToIndex({ index: i, animated: !reduced, viewPosition: 0, viewOffset: 8 }); } catch { /* fuera de rango */ }
    },
    scrollToTop: () => list.current?.scrollToOffset({ offset: 0, animated: !reduced }),
  }), [reduced]);

  const changeTo = (i: number) => {
    if (i !== index) {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      fromGesture.current = true;
      onIndexChange(i as 0 | 1 | 2);
    } else {
      setScrollEnabled(i === 2);
    }
  };

  const drag = (ty: number) => {
    'worklet';
    const max = full - snaps[0];
    let next = start.get() + ty;
    // Resistencia elástica fuera de los extremos.
    if (next < 0) next = next / 3;
    if (next > max) next = max + (next - max) / 3;
    y.set(next);
  };
  const settle = (vy: number) => {
    'worklet';
    const cur = y.get();
    const positions = snaps.map(h => full - h);
    let target = 0;
    if (Math.abs(vy) > 650) {
      // Movimiento rápido: la siguiente altura MÁS ALLÁ de donde está el dedo, en esa dirección
      // (un arrastre largo y rápido desde contraído llega hasta arriba, no se queda a medias).
      if (vy < 0) {
        target = 2;
        for (let i = 0; i < positions.length; i++) if (positions[i] < cur - 4) { target = i; break; }
      } else {
        target = 0;
        for (let i = positions.length - 1; i >= 0; i--) if (positions[i] > cur + 4) { target = i; break; }
      }
    } else {
      target = positions.reduce((b, p, i) => (Math.abs(p - cur) < Math.abs(positions[b] - cur) ? i : b), 0);
    }
    idx.set(target);
    y.set(withSpring(positions[target], { ...SPRING, velocity: vy }));
    scheduleOnRN(changeTo, target);
  };


  // Cabecera: siempre mueve el panel (los toques cortos siguen llegando a sus botones).
  const headerPan = Gesture.Pan()
    .activeOffsetY([-SLOP, SLOP])
    .failOffsetX([-24, 24])
    .onStart(() => { start.set(y.get()); dragActive.set(true); dragEnded.set(false); scheduleOnRN(markDrag); })
    .onUpdate(e => { drag(e.translationY); })
    .onEnd(e => { dragEnded.set(true); settle(e.velocityY); })
    .onFinalize(() => {
      if (!dragActive.get()) return;
      dragActive.set(false);
      // Gesto cancelado a medias (llamada, otra app): sin onEnd, el panel vuelve a la altura más cercana.
      if (!dragEnded.get()) settle(0);
      scheduleOnRN(markDragEnd);
    });

  // Lista: decide al primer movimiento claro quién se queda con el gesto.
  const listPan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown(e => {
      const t = e.allTouches[0];
      if (t) { touchX.set(t.absoluteX); touchY.set(t.absoluteY); }
    })
    .onTouchesMove((e, manager) => {
      const t = e.allTouches[0];
      if (!t) return;
      const dx = t.absoluteX - touchX.get();
      const dy = t.absoluteY - touchY.get();
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      if (Math.abs(dx) > Math.abs(dy)) { manager.fail(); return; }
      const expanded = idx.get() === 2;
      if (!expanded) manager.activate();                    // contraído/intermedio: mueve el panel
      else if (dy > 0 && scrollY.get() <= 1) manager.activate(); // inicio de la lista y dedo hacia abajo
      else manager.fail();                                   // desplazamiento normal de la lista
    })
    .onStart(() => { start.set(y.get()); dragActive.set(true); dragEnded.set(false); scheduleOnRN(markDrag); })
    .onUpdate(e => { drag(e.translationY); })
    .onEnd(e => { dragEnded.set(true); settle(e.velocityY); })
    .onFinalize(() => {
      if (!dragActive.get()) return;
      dragActive.set(false);
      // Gesto cancelado a medias (llamada, otra app): sin onEnd, el panel vuelve a la altura más cercana.
      if (!dragEnded.get()) settle(0);
      scheduleOnRN(markDragEnd);
    });

  const onScroll = useAnimatedScrollHandler(e => { scrollY.set(e.contentOffset.y); });
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));

  return (
    <Reanimated.View style={[s.sheet, { height: full }, sheetStyle]} accessibilityLabel={props.a11yLabel}>
      <GestureDetector gesture={headerPan}>
        <View collapsable={false}>
          <View style={s.handleZone}>
            {/* El asa es «ajustable» para lectores de pantalla (deslizar arriba/abajo cambia la altura). */}
            <View style={s.handleHit} accessible accessibilityRole="adjustable" accessibilityLabel={props.a11yLabel}
              accessibilityActions={[{ name: 'increment', label: props.a11yExpand }, { name: 'decrement', label: props.a11yCollapse }]}
              onAccessibilityAction={e => {
                if (e.nativeEvent.actionName === 'increment') onIndexChange(Math.min(2, index + 1) as 0 | 1 | 2);
                if (e.nativeEvent.actionName === 'decrement') onIndexChange(Math.max(0, index - 1) as 0 | 1 | 2);
              }}>
              <View style={s.handle} />
            </View>
            {accessory ? <View style={s.accessory}>{accessory}</View> : null}
          </View>
          {header}
        </View>
      </GestureDetector>
      <GestureDetector gesture={listPan}>
        <View style={s.body} collapsable={false}>
          <Reanimated.FlatList
            ref={list}
            data={data as T[]}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            extraData={extraData}
            ListHeaderComponent={ListHeaderComponent}
            ListEmptyComponent={ListEmptyComponent}
            onScroll={onScroll}
            scrollEventThrottle={16}
            scrollEnabled={scrollEnabled}
            bounces={false}
            overScrollMode="never"
            showsVerticalScrollIndicator={scrollEnabled}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={7}
            removeClippedSubviews={Platform.OS === 'android'}
            contentContainerStyle={{ paddingBottom: bottomPad }}
            onScrollToIndexFailed={info => {
              list.current?.scrollToOffset({ offset: Math.max(0, info.averageItemLength * info.index), animated: !reduced });
            }}
          />
        </View>
      </GestureDetector>
    </Reanimated.View>
  );
}

const HistorySheet = forwardRef(HistorySheetInner) as <T>(p: Props<T> & { ref?: React.Ref<HistorySheetHandle> }) => React.ReactElement;
export default HistorySheet;

const s = StyleSheet.create({
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(14,20,24,0.94)',
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 22, shadowOffset: { width: 0, height: -6 }, elevation: 18,
  },
  handleZone: { height: 40, alignItems: 'center', justifyContent: 'center' },
  handleHit: { paddingVertical: 10, paddingHorizontal: 40 },
  accessory: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.32)' },
  body: { flex: 1, overflow: 'hidden' },
});
