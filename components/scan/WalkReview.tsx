/**
 * Recorrido terminado: elegir qué fotos se analizan.
 *
 * Se muestran todas las fotos del recorrido, todas marcadas. Tocar una la desmarca (por ejemplo, si no era
 * un aguacate). Solo las marcadas se guardan y se mandan a procesar; las demás se borran del celular.
 *
 * Rejilla virtualizada (FlatList, 3 columnas) porque un recorrido puede tener cientos de fotos.
 * Movimiento: el check y el velo cambian con una transición de opacidad de 120 ms; vibración ligera al tocar.
 */
import React, { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Check, Trash2 } from 'lucide-react-native';
import { TranslationResource, useTranslations } from '../../context/LanguageContext';
import type { FotoLocal } from '../../services/recorridos';
import { CSS_EASE_OUT, PressableScale } from './motion';
import { LIME_GRADIENT, SCAN } from './theme';

const translations: TranslationResource = {
  title: { es: 'Elige qué analizar', en: 'Choose what to analyze' },
  sub: { es: 'Toca una foto para quitarla (por ejemplo, si no es un aguacate). Solo se procesan las marcadas.', en: 'Tap a photo to remove it (e.g. if it is not an avocado). Only the selected ones are processed.' },
  count: { es: '{n} de {total} seleccionadas', en: '{n} of {total} selected' },
  all: { es: 'Todas', en: 'All' },
  none: { es: 'Ninguna', en: 'None' },
  process: { es: 'Procesar {n} fotos', en: 'Process {n} photos' },
  processOne: { es: 'Procesar 1 foto', en: 'Process 1 photo' },
  pickOne: { es: 'Elige al menos una foto', en: 'Choose at least one photo' },
  discard: { es: 'Descartar recorrido', en: 'Discard walk' },
  photo: { es: 'Foto {n}', en: 'Photo {n}' },
  on: { es: 'seleccionada', en: 'selected' },
  off: { es: 'no seleccionada', en: 'not selected' },
};

const Tile = memo(function Tile({ foto, n, on, size, onToggle, label }: {
  foto: FotoLocal; n: number; on: boolean; size: number; onToggle: (id: string) => void; label: string;
}) {
  return (
    <Pressable onPress={() => onToggle(foto.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label}
      style={({ pressed }) => [{ width: size, height: size, padding: 3 }, pressed && { transform: [{ scale: 0.97 }] }]}>
      <View style={[s.tile, on ? s.tileOn : s.tileOff]}>
        <Image source={{ uri: foto.uri }} style={s.img} resizeMode="cover" />
        <View pointerEvents="none" style={[s.veil, { opacity: on ? 0 : 1, transitionProperty: 'opacity', transitionDuration: 120, transitionTimingFunction: CSS_EASE_OUT } as object]} />
        <View style={[s.check, on ? s.checkOn : s.checkOff]}>{on && <Check size={14} color={SCAN.ink} strokeWidth={3.2} />}</View>
        <Text style={s.num}>{n}</Text>
      </View>
    </Pressable>
  );
});

export default function WalkReview({ fotos, onConfirm, onDiscard }: {
  fotos: FotoLocal[];
  /** Ids de las fotos que se procesan. */
  onConfirm: (keep: string[]) => void;
  onDiscard: () => void;
}) {
  const t = useTranslations(translations);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cols = width >= 700 ? 5 : 3;
  const size = Math.floor((Math.min(width, 900) - 26) / cols);
  // Desmarcadas (al inicio, ninguna): así «todas marcadas» es el estado natural.
  const [off, setOff] = useState<Set<string>>(() => new Set());
  const selected = fotos.length - off.size;

  const toggle = useCallback((id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setOff(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const index = useMemo(() => new Map(fotos.map((f, i) => [f.id, i + 1])), [fotos]);

  return (
    <View style={[s.screen, { paddingTop: insets.top + 10 }]}>
      <View style={s.head}>
        <Text style={s.title} accessibilityRole="header">{t('title')}</Text>
        <Text style={s.sub}>{t('sub')}</Text>
        <View style={s.bar}>
          <Text style={s.count}>{t('count', { n: selected, total: fotos.length })}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <PressableScale style={s.chip} onPress={() => setOff(new Set())} accessibilityRole="button"><Text style={s.chipText}>{t('all')}</Text></PressableScale>
            <PressableScale style={s.chip} onPress={() => setOff(new Set(fotos.map(f => f.id)))} accessibilityRole="button"><Text style={s.chipText}>{t('none')}</Text></PressableScale>
          </View>
        </View>
      </View>
      <FlatList
        data={fotos}
        key={cols}
        numColumns={cols}
        keyExtractor={f => f.id}
        contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 150 + insets.bottom, alignSelf: 'center' }}
        initialNumToRender={18}
        windowSize={7}
        removeClippedSubviews
        extraData={off}
        renderItem={({ item }) => {
          const n = index.get(item.id) ?? 0;
          const on = !off.has(item.id);
          return <Tile foto={item} n={n} on={on} size={size} onToggle={toggle} label={`${t('photo', { n })}, ${on ? t('on') : t('off')}`} />;
        }}
      />
      <LinearGradient colors={['rgba(255,255,255,0)', '#FFFFFF']} locations={[0, 0.3]} style={[s.footer, { paddingBottom: insets.bottom + 14 }]}>
        <PressableScale onPress={() => selected > 0 && onConfirm(fotos.filter(f => !off.has(f.id)).map(f => f.id))} disabled={selected === 0}
          accessibilityRole="button" accessibilityState={{ disabled: selected === 0 }} style={s.ctaWrap}>
          <LinearGradient colors={selected ? [...LIME_GRADIENT] : ['#E2E8F0', '#CBD5E1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cta}>
            <Text style={[s.ctaText, !selected && { color: SCAN.muted }]}>
              {selected === 0 ? t('pickOne') : selected === 1 ? t('processOne') : t('process', { n: selected })}
            </Text>
          </LinearGradient>
        </PressableScale>
        <PressableScale onPress={onDiscard} accessibilityRole="button" style={s.discard}>
          <Trash2 size={16} color={SCAN.red} />
          <Text style={s.discardText}>{t('discard')}</Text>
        </PressableScale>
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  head: { paddingHorizontal: 18, gap: 6, paddingBottom: 8 },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 26, lineHeight: 32, letterSpacing: -0.6, color: SCAN.ink },
  sub: { fontFamily: 'Poppins_400Regular', fontSize: 13.5, lineHeight: 19, color: SCAN.muted },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  count: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: SCAN.limeInk },
  chip: { height: 32, paddingHorizontal: 14, borderRadius: 16, justifyContent: 'center', backgroundColor: SCAN.surface, borderWidth: 1, borderColor: SCAN.line },
  chipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: SCAN.ink },
  tile: { flex: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: '#E2E8F0', borderWidth: 2.5 },
  tileOn: { borderColor: '#84CC16' },
  tileOff: { borderColor: 'transparent' },
  img: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  veil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.62)' },
  check: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: '#A3E635' },
  checkOff: { backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 2, borderColor: '#FFFFFF' },
  num: { position: 'absolute', left: 6, bottom: 4, fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 30, gap: 4 },
  ctaWrap: { borderRadius: 22, shadowColor: '#65A30D', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  cta: { height: 56, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: 'Poppins_700Bold', fontSize: 17, color: SCAN.ink },
  discard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44 },
  discardText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: SCAN.red },
});
