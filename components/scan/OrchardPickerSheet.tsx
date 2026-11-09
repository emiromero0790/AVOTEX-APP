/**
 * «¿Dónde guardarás este escaneo?» — selección de huerta antes de una captura cuando el GPS no
 * pudo asignarla solo (services/huertaResolver.ts). También exporta la fila y la miniatura para el
 * filtro de Actividad.
 *
 * Nada viene preseleccionado: «Continuar» se habilita con una elección explícita (una huerta o
 * «No asignar a ninguna huerta», que devuelve null). Cerrar no crea nada.
 *
 * Movimiento (animate-expo): la hoja sube con curva de salida (320 ms) y baja en 220 ms; el fondo se
 * funde. El contenido aparece escalonado (solo las primeras filas). Selección: borde, fondo y punto
 * con transiciones de 160 ms + Haptics.selectionAsync. «Continuar» se ilumina al habilitarse.
 * Con "Reducir movimiento": solo fundidos.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Reanimated, { FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { ArrowRight, Check, MapPin, Search, Sprout, Unlink, X } from 'lucide-react-native';
import { TranslationResource, useTranslations } from '../../context/LanguageContext';
import SatThumb from '../escaneos/SatThumb';
import { CSS_EASE_OUT, EASE_OUT } from './motion';
import type { Orchard } from '../../services/orchards';
import type { ManualReason } from '../../services/huertaResolver';
import { normalizePolygon } from '../../services/proximity';

const HEADER_IMG = require('../../assets/images/escanear/huerta-atardecer.jpg');

export const PICK_COLORS = {
  ink: '#0F172A', muted: '#64748B', line: '#E5E7EB', red: '#E11D48', lime: '#A3E635', limeSoft: '#F7FEE7',
  limeInk: '#3F6212', teal1: '#3AA88F', teal2: '#1F8A75', deep: '#123D25',
} as const;

const translations: TranslationResource = {
  title1: { es: '¿Dónde guardarás', en: 'Where will you save' },
  title2: { es: 'este escaneo?', en: 'this scan?' },
  outside: { es: 'No te encuentras dentro de ninguna de tus huertas. Selecciona dónde deseas guardar este escaneo.', en: 'You are not inside any of your orchards. Choose where to save this scan.' },
  noGps: { es: 'No pudimos verificar tu ubicación. Selecciona una huerta para continuar.', en: 'We could not verify your location. Choose an orchard to continue.' },
  imprecise: { es: 'La señal GPS no es lo bastante precisa (±{m} m) para saber en qué huerta estás. Selecciona una huerta para continuar.', en: 'The GPS signal is not precise enough (±{m} m) to know which orchard you are in. Choose an orchard to continue.' },
  impreciseNoAcc: { es: 'La señal GPS no es lo bastante precisa para saber en qué huerta estás. Selecciona una huerta para continuar.', en: 'The GPS signal is not precise enough to know which orchard you are in. Choose an orchard to continue.' },
  overlap: { es: 'Tu ubicación coincide con más de una huerta. Selecciona dónde deseas guardar este escaneo.', en: 'Your location matches more than one orchard. Choose where to save this scan.' },
  noOrchards: { es: 'Aún no tienes huertas registradas. Puedes guardar este escaneo sin huerta o registrar una en Mapeo.', en: 'You have no orchards yet. Save this scan without an orchard or register one in Mapping.' },
  loadError: { es: 'No pudimos cargar tus huertas. Puedes guardar este escaneo sin huerta.', en: 'We could not load your orchards. You can save this scan without an orchard.' },
  search: { es: 'Buscar huerta...', en: 'Search orchard...' },
  noMatch: { es: 'Ninguna huerta coincide con «{q}».', en: 'No orchard matches “{q}”.' },
  none: { es: 'No asignar a ninguna huerta', en: 'Do not assign to an orchard' },
  noneDesc: { es: 'Guardar el escaneo sin relacionarlo con una huerta.', en: 'Save the scan without linking it to an orchard.' },
  continue: { es: 'Continuar', en: 'Continue' },
  close: { es: 'Cerrar', en: 'Close' },
  here: { es: 'Tu ubicación', en: 'Your location' },
  register: { es: 'Registrar una huerta en Mapeo', en: 'Register an orchard in Mapping' },
  selected: { es: 'seleccionada', en: 'selected' },
};

export const haLabel = (m2: number) => `${(Math.max(0, m2 || 0) / 10000).toFixed(2)} ha`;

/** Miniatura satelital real de la huerta (mosaicos Esri de su polígono); si no hay polígono, un marcador neutro. */
export function OrchardThumb({ orchard, width = 64, height = 50 }: { orchard: Orchard; width?: number; height?: number }) {
  const outline = useMemo(() => normalizePolygon(orchard.coordinates).map(p => ({ lat: p.latitude, lng: p.longitude })), [orchard.coordinates]);
  return (
    <View style={[s.thumb, { width, height }]}>
      <LinearGradient colors={['#3F6F3A', '#1F4D2B']} style={StyleSheet.absoluteFill} />
      <View style={s.thumbIcon}><Sprout size={18} color="rgba(236,252,203,0.85)" /></View>
      {outline.length >= 3 && <SatThumb route={[]} outline={outline} size={width} height={height} radius={12} />}
    </View>
  );
}

/** Indicador circular de selección. */
export function Radio({ on }: { on: boolean }) {
  return (
    <Reanimated.View style={[s.radio, { borderColor: on ? PICK_COLORS.limeInk : '#94A3B8', backgroundColor: on ? PICK_COLORS.lime : 'transparent', transitionProperty: ['borderColor', 'backgroundColor'], transitionDuration: 160, transitionTimingFunction: CSS_EASE_OUT } as object]}>
      <Reanimated.View style={{ transform: [{ scale: on ? 1 : 0.4 }], opacity: on ? 1 : 0, transitionProperty: ['transform', 'opacity'], transitionDuration: 160, transitionTimingFunction: CSS_EASE_OUT } as object}>
        <Check size={13} color={PICK_COLORS.deep} strokeWidth={3.2} />
      </Reanimated.View>
    </Reanimated.View>
  );
}

/** Fila de huerta (también la usa el filtro de Actividad). */
export function OrchardRow({ orchard, selected, onPress, badge, trailing, a11yHint }: {
  orchard: Orchard; selected: boolean; onPress: () => void; badge?: string; trailing?: React.ReactNode; a11yHint?: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={`${orchard.nombre}, ${haLabel(orchard.area_m2)}${badge ? `, ${badge}` : ''}`} accessibilityHint={a11yHint}
      >
      {({ pressed }) => (
      <Reanimated.View style={[s.row, selected && s.rowOn, { transform: [{ scale: pressed ? 0.985 : 1 }], transitionProperty: ['borderColor', 'backgroundColor', 'transform'], transitionDuration: 160, transitionTimingFunction: CSS_EASE_OUT } as object]}>
      <OrchardThumb orchard={orchard} />
      <View style={s.rowText}>
        <Text style={s.rowTitle} numberOfLines={1} maxFontSizeMultiplier={1.25}>{orchard.nombre}</Text>
        <View style={s.rowMeta}>
          <Text style={s.rowSub} maxFontSizeMultiplier={1.25}>{haLabel(orchard.area_m2)}</Text>
          {badge ? <View style={s.badge}><MapPin size={10} color="#047857" /><Text style={s.badgeText} maxFontSizeMultiplier={1.15}>{badge}</Text></View> : null}
        </View>
      </View>
      {trailing ?? <Radio on={selected} />}
      </Reanimated.View>
      )}
    </Pressable>
  );
}

type Props = {
  visible: boolean;
  reason: ManualReason | null;
  accuracyM?: number | null;
  orchards: Orchard[];
  /** Huertas que contienen la ubicación (polígonos superpuestos o GPS impreciso): van primero, sin preseleccionar. */
  candidates?: string[];
  onConfirm: (huertaId: string | null) => void;
  onCancel: () => void;
  /** Sin huertas: ir a Mapeo a registrar una. */
  onRegister?: () => void;
};

type Choice = { type: 'orchard'; id: string } | { type: 'none' } | null;

export default function OrchardPickerSheet({ visible, reason, accuracyM, orchards, candidates = [], onConfirm, onCancel, onRegister }: Props) {
  const t = useTranslations(translations);
  const insets = useSafeAreaInsets();
  const { height: winH, width: winW } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const [choice, setChoice] = useState<Choice>(null);
  const [query, setQuery] = useState('');
  const ty = useSharedValue(winH);
  const fade = useSharedValue(0);

  // Cada apertura empieza limpia: sin selección previa ni búsqueda.
  useEffect(() => {
    if (visible) {
      setChoice(null);
      setQuery('');
      setMounted(true);
      ty.set(reduced ? 0 : winH * 0.6);
      fade.set(0);
      ty.set(withTiming(0, { duration: reduced ? 0 : 320, easing: EASE_OUT }));
      fade.set(withTiming(1, { duration: 240 }));
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Cierra con la animación de salida y luego entrega el resultado. */
  const close = (after: () => void) => {
    const finish = () => { setMounted(false); after(); };
    fade.set(withTiming(0, { duration: 200 }));
    ty.set(withTiming(reduced ? 0 : winH * 0.6, { duration: reduced ? 0 : 220, easing: EASE_OUT }, done => {
      'worklet';
      if (done) scheduleOnRN(finish);
    }));
    if (reduced) setTimeout(finish, 210);
  };

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));

  const ordered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const list = q ? orchards.filter(o => o.nombre.toLocaleLowerCase().includes(q)) : orchards;
    return [...list].sort((a, b) => Number(candidates.includes(b.id)) - Number(candidates.includes(a.id)));
  }, [orchards, query, candidates]);

  const message = reason === 'outside' ? t('outside')
    : reason === 'overlap' ? t('overlap')
      : reason === 'imprecise' ? (accuracyM != null ? t('imprecise', { m: Math.round(accuracyM) }) : t('impreciseNoAcc'))
        : reason === 'no-orchards' ? t('noOrchards')
          : reason === 'load-error' ? t('loadError')
            : t('noGps');

  const pick = (next: Choice) => {
    Haptics.selectionAsync().catch(() => {});
    setChoice(next);
  };
  const confirm = () => {
    if (!choice) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const id = choice.type === 'orchard' ? choice.id : null;
    close(() => onConfirm(id));
  };
  const cancel = () => close(onCancel);

  if (!mounted) return null;
  const sheetW = Math.min(winW - 20, 520);
  const headerH = Math.round(Math.min(190, sheetW * 0.42));
  const enter = (i: number) => (reduced ? FadeIn.duration(160) : FadeInDown.duration(260).delay(80 + Math.min(i, 6) * 45).easing(EASE_OUT));
  const ready = choice !== null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={cancel}>
      <Reanimated.View style={[StyleSheet.absoluteFill, s.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={cancel} accessibilityRole="button" accessibilityLabel={t('close')} />
      </Reanimated.View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.kav} pointerEvents="box-none">
        <Reanimated.View
          accessibilityViewIsModal
          style={[s.sheet, { width: sheetW, marginBottom: insets.bottom + 10, maxHeight: winH - insets.top - insets.bottom - 24 }, sheetStyle]}>
          {/* Cabecera fotográfica */}
          <View style={{ height: headerH }}>
            <Image source={HEADER_IMG} style={[s.headerImg, { height: headerH }]} resizeMode="cover" accessibilityIgnoresInvertColors />
            <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0.92)', '#FFFFFF']} locations={[0, 0.45, 0.82, 1]} style={StyleSheet.absoluteFill} />
            <View style={s.handle} />
            <Pressable onPress={cancel} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')} style={({ pressed }) => [s.close, pressed && { transform: [{ scale: 0.94 }] }]}>
              <X size={20} color={PICK_COLORS.ink} strokeWidth={2.4} />
            </Pressable>
            <Reanimated.View entering={reduced ? undefined : FadeIn.duration(260).delay(120)} style={[s.pinHalo, { top: headerH * 0.2 }]}>
              <View style={s.pinCore}><MapPin size={30} color={PICK_COLORS.red} strokeWidth={2.2} /></View>
            </Reanimated.View>
          </View>

          <View style={s.titleBox}>
            <Text style={s.title} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
              {t('title1')}{'\n'}<Text style={{ color: PICK_COLORS.red }}>{t('title2')}</Text>
            </Text>
            <Text style={s.message} maxFontSizeMultiplier={1.25}>{message}</Text>
          </View>

          {orchards.length > 0 && (
            <Reanimated.View entering={enter(0)} style={s.searchBox}>
              <View style={s.searchIcon}><Search size={19} color="#475569" /></View>
              <TextInput value={query} onChangeText={setQuery} placeholder={t('search')} placeholderTextColor="#64748B"
                style={s.searchInput} returnKeyType="search" autoCorrect={false} maxFontSizeMultiplier={1.25} accessibilityLabel={t('search')} />
              {query ? <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('close')}><X size={16} color="#64748B" /></Pressable> : null}
            </Reanimated.View>
          )}

          <ScrollView style={s.list} contentContainerStyle={s.listContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} accessibilityRole="radiogroup">
            {ordered.map((o, i) => (
              <Reanimated.View key={o.id} entering={i < 7 ? enter(i + 1) : undefined}>
                <OrchardRow orchard={o} selected={choice?.type === 'orchard' && choice.id === o.id} onPress={() => pick({ type: 'orchard', id: o.id })}
                  badge={candidates.includes(o.id) ? t('here') : undefined} />
              </Reanimated.View>
            ))}
            {query.trim() !== '' && ordered.length === 0 && <Text style={s.noMatch}>{t('noMatch', { q: query.trim() })}</Text>}
            {reason === 'no-orchards' && onRegister && (
              <Pressable onPress={() => close(onRegister)} accessibilityRole="button" style={({ pressed }) => [s.register, pressed && { opacity: 0.8 }]}>
                <Sprout size={18} color={PICK_COLORS.teal2} />
                <Text style={s.registerText} maxFontSizeMultiplier={1.2}>{t('register')}</Text>
                <ArrowRight size={16} color={PICK_COLORS.teal2} />
              </Pressable>
            )}
            <Reanimated.View entering={enter(Math.min(ordered.length, 6) + 1)}>
              <Pressable onPress={() => pick({ type: 'none' })} accessibilityRole="radio" accessibilityState={{ selected: choice?.type === 'none' }} accessibilityLabel={`${t('none')}. ${t('noneDesc')}`}
              >
                {({ pressed }) => (
                <Reanimated.View style={[s.row, s.noneRow, choice?.type === 'none' && s.noneRowOn, { transform: [{ scale: pressed ? 0.985 : 1 }], transitionProperty: ['borderColor', 'backgroundColor', 'transform'], transitionDuration: 160, transitionTimingFunction: CSS_EASE_OUT } as object]}>
                <View style={s.noneIcon}><Unlink size={24} color={PICK_COLORS.red} strokeWidth={2.2} /></View>
                <View style={s.rowText}>
                  <Text style={s.rowTitle} maxFontSizeMultiplier={1.25}>{t('none')}</Text>
                  <Text style={s.noneDesc} maxFontSizeMultiplier={1.25}>{t('noneDesc')}</Text>
                </View>
                <Radio on={choice?.type === 'none'} />
                </Reanimated.View>
                )}
              </Pressable>
            </Reanimated.View>
          </ScrollView>

          <View style={s.footer}>
            <Pressable onPress={confirm} disabled={!ready} accessibilityRole="button" accessibilityState={{ disabled: !ready }} accessibilityLabel={t('continue')}
            >
              {({ pressed }) => (
              <Reanimated.View style={[s.ctaWrap, { opacity: ready ? 1 : 0.55, transform: [{ scale: pressed && ready ? 0.98 : 1 }], transitionProperty: ['opacity', 'transform'], transitionDuration: 180, transitionTimingFunction: CSS_EASE_OUT } as object]}>
              <LinearGradient colors={[PICK_COLORS.teal1, PICK_COLORS.teal2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cta}>
                <View style={{ width: 24 }} />
                <Text style={s.ctaText} maxFontSizeMultiplier={1.2}>{t('continue')}</Text>
                <ArrowRight size={24} color="#FFFFFF" strokeWidth={2.4} />
              </LinearGradient>
              </Reanimated.View>
              )}
            </Pressable>
          </View>
        </Reanimated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(15,23,42,0.55)' },
  kav: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    backgroundColor: '#FFFFFF', borderRadius: 32, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 16,
  },
  headerImg: { position: 'absolute', top: 0, left: 0, width: '100%' },
  handle: { position: 'absolute', top: 10, alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(100,116,139,0.55)' },
  close: {
    position: 'absolute', top: 14, right: 14, width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  pinHalo: { position: 'absolute', alignSelf: 'center', width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.45)' },
  pinCore: {
    width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.88)',
    shadowColor: PICK_COLORS.red, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 4,
  },
  titleBox: { paddingHorizontal: 22, marginTop: -34, alignItems: 'center', gap: 8 },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 24, lineHeight: 30, color: PICK_COLORS.ink, textAlign: 'center', letterSpacing: -0.4 },
  message: { fontFamily: 'Poppins_400Regular', fontSize: 14, lineHeight: 20, color: PICK_COLORS.muted, textAlign: 'center' },
  searchBox: {
    marginTop: 16, marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 16,
    borderRadius: 25, backgroundColor: '#EEF0F2', borderWidth: 1, borderColor: '#E2E8F0',
  },
  searchIcon: { width: 20, height: 20, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  // Sin el contorno de foco del navegador (solo web); en el celular no existe.
  searchInput: { flex: 1, minWidth: 0, fontFamily: 'Poppins_400Regular', fontSize: 15, color: PICK_COLORS.ink, paddingVertical: 10, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}) },
  list: { flexShrink: 1, marginTop: 10 },
  listContent: { paddingHorizontal: 16, paddingBottom: 6, gap: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 9, paddingLeft: 9, paddingRight: 16, borderRadius: 18,
    borderWidth: 1.5, borderColor: PICK_COLORS.line, backgroundColor: '#FFFFFF',
  },
  rowOn: { borderColor: PICK_COLORS.lime, backgroundColor: PICK_COLORS.limeSoft },
  rowText: { flex: 1, gap: 1 },
  rowTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, lineHeight: 21, color: PICK_COLORS.ink },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowSub: { fontFamily: 'Poppins_400Regular', fontSize: 13.5, color: PICK_COLORS.muted },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999, backgroundColor: '#D1FAE5' },
  badgeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 10.5, color: '#047857' },
  thumb: { borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbIcon: { position: 'absolute' },
  radio: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  noneRow: { backgroundColor: '#FFF1F2', borderColor: '#FECDD3', marginTop: 2 },
  noneRowOn: { borderColor: PICK_COLORS.red, backgroundColor: '#FFE4E6' },
  noneIcon: { width: 64, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFE4E6' },
  noneDesc: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, lineHeight: 17, color: PICK_COLORS.muted },
  noMatch: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: PICK_COLORS.muted, textAlign: 'center', paddingVertical: 10 },
  register: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#99D5C8', backgroundColor: '#F0FDFA',
  },
  registerText: { flex: 1, fontFamily: 'Poppins_600SemiBold', fontSize: 14.5, color: PICK_COLORS.teal2 },
  footer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16 },
  ctaWrap: { borderRadius: 30, shadowColor: PICK_COLORS.teal2, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  cta: { height: 60, borderRadius: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22 },
  ctaText: { fontFamily: 'Poppins_700Bold', fontSize: 19, color: '#FFFFFF' },
});
