/**
 * Visor de fotos a pantalla completa: deslizar entre imágenes, pellizcar para ampliar y doble toque.
 * Movimiento (animate-expo): el zoom y el arrastre corren en el hilo de UI (Gesture + shared values);
 * al soltar, el resorte vuelve a los límites. Con "Reducir movimiento" no hay resorte.
 */
import React, { useEffect, useState } from 'react';
import { Image, type ImageSourcePropType, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Reanimated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

const SPRING = { duration: 300, dampingRatio: 0.9 };

function ZoomableImage({ source, width, height, reduced, onZoomChange }: {
  source: ImageSourcePropType; width: number; height: number; reduced: boolean; onZoomChange: (zoomed: boolean) => void;
}) {
  const scale = useSharedValue(1);
  const saved = useSharedValue(1);
  const tx = useSharedValue(0), ty = useSharedValue(0), sx = useSharedValue(0), sy = useSharedValue(0);
  const [zoomed, setZoomed] = useState(false);
  const report = (z: boolean) => { setZoomed(z); onZoomChange(z); };
  const back = (v: number) => {
    'worklet';
    return reduced ? withTiming(v, { duration: 0 }) : withSpring(v, SPRING);
  };

  const pinch = Gesture.Pinch()
    .onStart(() => { saved.set(scale.get()); })
    .onUpdate(e => { scale.set(Math.max(0.8, Math.min(5, saved.get() * e.scale))); })
    .onEnd(() => {
      if (scale.get() < 1) { scale.set(back(1)); tx.set(back(0)); ty.set(back(0)); }
      scheduleOnRN(report, scale.get() > 1.02);
    });
  const pan = Gesture.Pan()
    .minPointers(1)
    .onStart(() => { sx.set(tx.get()); sy.set(ty.get()); })
    .onUpdate(e => {
      if (scale.get() <= 1) return;
      tx.set(sx.get() + e.translationX);
      ty.set(sy.get() + e.translationY);
    })
    .onEnd(() => {
      const maxX = (width * (scale.get() - 1)) / 2, maxY = (height * (scale.get() - 1)) / 2;
      tx.set(back(Math.max(-maxX, Math.min(maxX, tx.get()))));
      ty.set(back(Math.max(-maxY, Math.min(maxY, ty.get()))));
    });
  const doubleTap = Gesture.Tap().numberOfTaps(2).onEnd(() => {
    const next = scale.get() > 1 ? 1 : 2.5;
    scale.set(back(next));
    if (next === 1) { tx.set(back(0)); ty.set(back(0)); }
    scheduleOnRN(report, next > 1);
  });

  // Solo se arrastra la imagen cuando está ampliada; si no, el desplazamiento horizontal cambia de foto.
  const composed = Gesture.Simultaneous(pinch, zoomed ? Gesture.Exclusive(doubleTap, pan) : doubleTap);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }] }));
  return (
    <GestureDetector gesture={composed}>
      <Reanimated.View style={[{ width, height, alignItems: 'center', justifyContent: 'center' }, style]}>
        <Image source={source} style={{ width, height }} resizeMode="contain" accessibilityIgnoresInvertColors />
      </Reanimated.View>
    </GestureDetector>
  );
}

type Props = {
  visible: boolean;
  images: { source: ImageSourcePropType; caption?: string }[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  reduced: boolean;
  closeLabel: string;
};

export default function PhotoViewer({ visible, images, index, onIndex, onClose, reduced, closeLabel }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [zoomed, setZoomed] = useState(false);
  const scrollRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null);
  useEffect(() => { if (visible) setTimeout(() => scrollRef.current?.scrollTo({ x: index * width, animated: false }), 0); }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const imgH = height - insets.top - insets.bottom - 120;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={s.root}>
        <ScrollView
          ref={scrollRef}
          horizontal pagingEnabled scrollEnabled={!zoomed && images.length > 1}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={e => onIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          contentContainerStyle={{ alignItems: 'center' }}
        >
          {images.map((im, i) => (
            <View key={i} style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
              <ZoomableImage source={im.source} width={width} height={imgH} reduced={reduced} onZoomChange={setZoomed} />
            </View>
          ))}
        </ScrollView>
        <View style={[s.top, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
          {images.length > 1 ? <Text style={s.counter}>{index + 1} / {images.length}</Text> : <View />}
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel} hitSlop={10} style={s.close}>
            <X size={20} color="#fff" />
          </Pressable>
        </View>
        {!!images[index]?.caption && (
          <View style={[s.caption, { paddingBottom: insets.bottom + 16 }]} pointerEvents="none">
            <Text style={s.captionText}>{images[index].caption}</Text>
          </View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(3,7,6,0.97)' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  counter: { color: '#fff', fontFamily: 'Poppins_600SemiBold', fontSize: 13, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)' },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  caption: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12 },
  captionText: { color: '#E2E8F0', fontFamily: 'Poppins_400Regular', fontSize: 12.5, textAlign: 'center' },
});
