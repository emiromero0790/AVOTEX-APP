/**
 * Filtro de huerta del Historial de Actividad. Solo filtra lo que se muestra: no modifica registros.
 * Opciones: Todas las huertas · cada huerta del usuario · Sin huerta asignada, con su número de registros.
 *
 * Movimiento (animate-expo): la hoja entra desde abajo (300 ms, curva de salida) sobre un fondo que se
 * funde; elegir una opción aplica el filtro y cierra (Haptics.selectionAsync). Reducir movimiento: fundido.
 */
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Reanimated, { FadeIn, SlideInDown, useReducedMotion } from 'react-native-reanimated';
import { Layers, Unlink, X } from 'lucide-react-native';
import { TranslationResource, useTranslations } from '../../context/LanguageContext';
import { EASE_OUT } from '../scan/motion';
import { OrchardRow, PICK_COLORS, Radio } from '../scan/OrchardPickerSheet';
import type { Orchard } from '../../services/orchards';

export type OrchardFilter = 'all' | 'none' | string;

const translations: TranslationResource = {
  title: { es: 'Filtrar por huerta', en: 'Filter by orchard' },
  hint: { es: 'Solo cambia lo que ves en el historial.', en: 'Only changes what you see in the history.' },
  all: { es: 'Todas las huertas', en: 'All orchards' },
  allDesc: { es: 'Incluye los escaneos sin huerta', en: 'Includes scans without an orchard' },
  none: { es: 'Sin huerta asignada', en: 'No orchard assigned' },
  noneDesc: { es: 'Escaneos guardados sin huerta', en: 'Scans saved without an orchard' },
  close: { es: 'Cerrar', en: 'Close' },
  records: { es: '{count} registros', en: '{count} records' },
};

type Props = {
  visible: boolean;
  value: OrchardFilter;
  orchards: Orchard[];
  counts: { all: number; none: number; byOrchard: Record<string, number> };
  onChange: (value: OrchardFilter) => void;
  onClose: () => void;
};

function Count({ n, on }: { n: number; on: boolean }) {
  return (
    <View style={s.countRow}>
      <View style={[s.count, on && s.countOn]}><Text style={[s.countText, on && s.countTextOn]} maxFontSizeMultiplier={1.2}>{n}</Text></View>
      <Radio on={on} />
    </View>
  );
}

export default function OrchardFilterSheet({ visible, value, orchards, counts, onChange, onClose }: Props) {
  const t = useTranslations(translations);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const choose = (v: OrchardFilter) => {
    if (v !== value) Haptics.selectionAsync().catch(() => {});
    onChange(v);
    onClose();
  };
  const Special = ({ v, icon, title, desc, n }: { v: OrchardFilter; icon: React.ReactNode; title: string; desc: string; n: number }) => {
    const on = value === v;
    return (
      <Pressable onPress={() => choose(v)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${title}. ${t('records', { count: n })}`}>
        {({ pressed }) => (
          <View style={[s.row, on && s.rowOn, pressed && { transform: [{ scale: 0.985 }] }]}>
            <View style={s.iconTile}>{icon}</View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle} maxFontSizeMultiplier={1.25}>{title}</Text>
              <Text style={s.rowSub} maxFontSizeMultiplier={1.25}>{desc}</Text>
            </View>
            <Count n={n} on={on} />
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, s.backdrop]} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')} />
      <View style={s.wrap} pointerEvents="box-none">
        <Reanimated.View entering={reduced ? FadeIn.duration(160) : SlideInDown.duration(300).easing(EASE_OUT)}
          accessibilityViewIsModal style={[s.sheet, { paddingBottom: insets.bottom + 14, maxHeight: height - insets.top - 40 }]}>
          <View style={s.handle} />
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Text style={s.title} accessibilityRole="header" maxFontSizeMultiplier={1.2}>{t('title')}</Text>
              <Text style={s.hint} maxFontSizeMultiplier={1.25}>{t('hint')}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')} style={s.close}><X size={18} color={PICK_COLORS.ink} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false} accessibilityRole="radiogroup">
            <Special v="all" icon={<Layers size={22} color={PICK_COLORS.teal2} />} title={t('all')} desc={t('allDesc')} n={counts.all} />
            {orchards.map(o => (
              <OrchardRow key={o.id} orchard={o} selected={value === o.id} onPress={() => choose(o.id)}
                trailing={<Count n={counts.byOrchard[o.id] ?? 0} on={value === o.id} />} />
            ))}
            <Special v="none" icon={<Unlink size={22} color={PICK_COLORS.red} />} title={t('none')} desc={t('noneDesc')} n={counts.none} />
          </ScrollView>
        </Reanimated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(15,23,42,0.5)' },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#CBD5E1' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 20, color: PICK_COLORS.ink },
  hint: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: PICK_COLORS.muted },
  close: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  list: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 9, paddingLeft: 9, paddingRight: 16, borderRadius: 18, borderWidth: 1.5, borderColor: PICK_COLORS.line, backgroundColor: '#FFFFFF' },
  rowOn: { borderColor: PICK_COLORS.lime, backgroundColor: PICK_COLORS.limeSoft },
  iconTile: { width: 64, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  rowTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 15.5, color: PICK_COLORS.ink },
  rowSub: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: PICK_COLORS.muted },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  count: { minWidth: 30, paddingHorizontal: 8, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  countOn: { backgroundColor: '#D9F99D' },
  countText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#475569' },
  countTextOn: { color: PICK_COLORS.limeInk },
});
