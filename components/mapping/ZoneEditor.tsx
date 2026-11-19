/**
 * Editor de zonas de una huerta (Mapeo › Editar › Editar zonas).
 *
 * Las zonas A–D se crean solas al delimitar la huerta. Aquí el agricultor puede cambiarlas trazando
 * líneas con el dedo: cada línea divide, de lado a lado, las zonas por las que pasa (máximo 4 zonas).
 * Se guarda solo la lista de líneas (huertas.zonas_cortes); las zonas se recalculan en la app, así
 * siempre quedan dentro del contorno. «Automáticas» vuelve a la división original (se guarda NULL).
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Check, RotateCcw, Sparkles, Trash2, Undo2, X } from 'lucide-react-native';
import ZoneEditorMap, { type ZoneEditorMapHandle } from '../ZoneEditorMap';
import { ZONE_PALETTE } from '../satMapHtml';
import type { ZoneEditorData } from '../zoneEditorHtml';
import {
  MAX_ZONES, autoZoneCuts, buildOrchardGeometry, checkNewCut, parseZoneCuts, serializeZoneCuts,
  type ZoneCut,
} from '../../services/satZones';
import { saveOrchardZones, ZonesMigrationMissingError, type Orchard } from '../../services/orchards';
import { TranslationResource, useTranslations } from '../../context/LanguageContext';

const tr: TranslationResource = {
  title: { es: 'Zonas de la huerta', en: 'Orchard zones' },
  hint: { es: 'Traza una línea con el dedo de un lado a otro de una zona para dividirla. Toca una línea para borrarla.', en: 'Draw a line with your finger across a zone to split it. Tap a line to delete it.' },
  count: { es: '{n} de {max} zonas', en: '{n} of {max} zones' },
  auto: { es: 'Automáticas', en: 'Automatic' },
  autoBadge: { es: 'Zonas automáticas', en: 'Automatic zones' },
  customBadge: { es: 'Zonas personalizadas', en: 'Custom zones' },
  undo: { es: 'Deshacer', en: 'Undo' },
  deleteLine: { es: 'Borrar línea', en: 'Delete line' },
  save: { es: 'Guardar', en: 'Save' },
  saving: { es: 'Guardando…', en: 'Saving…' },
  close: { es: 'Cerrar editor de zonas', en: 'Close zone editor' },
  noSplit: { es: 'La línea debe cruzar una zona de lado a lado (y no dejar una franja muy delgada).', en: 'The line must cross a zone from side to side (without leaving a very thin strip).' },
  maxZones: { es: 'Ya tienes 4 zonas, el máximo. Borra una línea para trazar otra.', en: 'You already have 4 zones, the maximum. Delete a line to draw another.' },
  noZones: { es: 'Esta huerta no admite zonas: su contorno se cruza consigo mismo o es muy pequeño. Corrige el contorno primero.', en: 'This orchard cannot have zones: its outline crosses itself or is too small. Fix the outline first.' },
  discardTitle: { es: '¿Descartar cambios?', en: 'Discard changes?' },
  discardBody: { es: 'Las zonas que dibujaste no se guardarán.', en: 'The zones you drew will not be saved.' },
  discard: { es: 'Descartar', en: 'Discard' },
  keep: { es: 'Seguir editando', en: 'Keep editing' },
  saveError: { es: 'No se pudieron guardar las zonas. Revisa tu conexión e inténtalo de nuevo.', en: 'Zones could not be saved. Check your connection and try again.' },
  migration: { es: 'Falta actualizar la base de datos (migración 20261119_huertas_zonas_cortes.sql en Supabase).', en: 'The database needs an update (migration 20261119_huertas_zonas_cortes.sql in Supabase).' },
  mapError: { es: 'No se pudo cargar el mapa. Revisa tu conexión.', en: 'The map could not load. Check your connection.' },
  note: { es: 'Las grabaciones ya subidas conservan las zonas con las que se clasificaron.', en: 'Recordings already uploaded keep the zones they were sorted with.' },
};

type Snapshot = { cuts: ZoneCut[]; isAuto: boolean };

type Props = {
  orchard: Orchard;
  userEmail: string;
  onClose: () => void;
  onSaved: (orchard: Orchard) => void;
};

const tick = () => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); };

export default function ZoneEditor({ orchard, userEmail, onClose, onSaved }: Props) {
  const t = useTranslations(tr);
  const insets = useSafeAreaInsets();
  const map = useRef<ZoneEditorMapHandle>(null);

  const initial = useMemo<Snapshot>(() => {
    const saved = parseZoneCuts(orchard.zonas_cortes);
    return saved ? { cuts: saved, isAuto: false } : { cuts: autoZoneCuts(orchard.coordinates, orchard.id), isAuto: true };
  }, [orchard]);
  const [state, setState] = useState<Snapshot>(initial);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const change = useCallback((next: Snapshot) => {
    setHistory(h => [...h, state].slice(-30));
    setState(next);
    setSelected(null);
    setMessage(null);
  }, [state]);

  const geometry = useMemo(
    () => buildOrchardGeometry(orchard.coordinates, orchard.id, state.isAuto ? undefined : serializeZoneCuts(state.cuts)),
    [orchard, state],
  );
  const zones = geometry.ok ? geometry.zones : [];
  const unsupported = geometry.ok && geometry.zonesNote !== null;
  const dirty = state.isAuto !== initial.isAuto || JSON.stringify(state.cuts) !== JSON.stringify(initial.cuts);

  const topPad = insets.top + 128;
  const bottomPad = insets.bottom + 210;
  const data = useMemo<ZoneEditorData>(() => ({
    key: orchard.id,
    outline: geometry.ok ? geometry.outline : [],
    zones: zones.map(z => ({ id: z.id, color: z.color, ring: z.ring, label: z.label, share: z.share })),
    cuts: state.cuts,
    selected,
    pad: { top: topPad, right: 0, bottom: bottomPad, left: 0 },
  }), [orchard.id, geometry, zones, state.cuts, selected, topPad, bottomPad]);

  const onCut = useCallback((cut: ZoneCut) => {
    const check = checkNewCut(orchard.coordinates, state.cuts, cut);
    if (!check.ok) {
      map.current?.reject();
      setMessage(check.reason === 'max-zones' ? t('maxZones') : check.reason === 'no-orchard' ? t('noZones') : t('noSplit'));
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    tick();
    change({ cuts: [...state.cuts, check.cut], isAuto: false });
  }, [orchard.coordinates, state.cuts, change, t]);

  const onSelect = useCallback((index: number | null) => {
    setSelected(index);
    setMessage(null);
    if (index !== null) tick();
  }, []);

  const deleteSelected = () => {
    if (selected === null) return;
    tick();
    change({ cuts: state.cuts.filter((_, i) => i !== selected), isAuto: false });
  };
  const undo = () => {
    if (!history.length) return;
    tick();
    setState(history[history.length - 1]);
    setHistory(h => h.slice(0, -1));
    setSelected(null);
    setMessage(null);
  };
  const resetAuto = () => {
    if (state.isAuto) return;
    tick();
    change({ cuts: autoZoneCuts(orchard.coordinates, orchard.id), isAuto: true });
  };

  const close = () => {
    if (!dirty || saving) { if (!saving) onClose(); return; }
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (window.confirm(`${t('discardTitle')}\n${t('discardBody')}`)) onClose();
      return;
    }
    Alert.alert(t('discardTitle'), t('discardBody'), [
      { text: t('keep'), style: 'cancel' },
      { text: t('discard'), style: 'destructive', onPress: onClose },
    ]);
  };

  const save = async () => {
    if (saving) return;
    if (!dirty) { onClose(); return; }
    setSaving(true);
    setMessage(null);
    try {
      const updated = await saveOrchardZones(orchard.id, userEmail, state.isAuto ? null : serializeZoneCuts(state.cuts));
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSaved(updated);
    } catch (e) {
      setMessage(e instanceof ZonesMigrationMissingError ? t('migration') : t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={close}>
      <View style={s.root}>
        <ZoneEditorMap ref={map} data={data} onCut={onCut} onSelect={onSelect} onError={() => setMessage(t('mapError'))} />

        {/* Encabezado */}
        <View style={[s.header, { top: insets.top + 10 }]} pointerEvents="box-none">
          <View style={s.headerCard}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.eyebrow} numberOfLines={1}>{orchard.nombre.toUpperCase()}</Text>
              <Text style={s.title}>{t('title')}</Text>
              <Text style={s.hint}>{unsupported ? t('noZones') : t('hint')}</Text>
            </View>
            <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')}
              style={({ pressed }) => [s.closeBtn, pressed && s.pressed]}>
              <X size={20} color="#F5F3E8" />
            </Pressable>
          </View>
        </View>

        {/* Panel inferior */}
        <View style={[s.panel, { paddingBottom: insets.bottom + 14 }]}>
          <View style={s.panelTop}>
            <View style={[s.badge, state.isAuto ? s.badgeAuto : s.badgeCustom]}>
              <Sparkles size={13} color={state.isAuto ? '#536238' : '#064B2C'} />
              <Text style={s.badgeText}>{state.isAuto ? t('autoBadge') : t('customBadge')}</Text>
            </View>
            <Text style={s.count}>{t('count', { n: zones.length, max: MAX_ZONES })}</Text>
          </View>

          <View style={s.chips}>
            {zones.map(z => {
              const c = ZONE_PALETTE[z.color];
              return (
                <View key={z.id} style={[s.chip, { borderColor: c.line }]}>
                  <View style={[s.dot, { backgroundColor: c.fill }]} />
                  <Text style={s.chipText}>{z.id}</Text>
                  <Text style={s.chipShare}>{Math.round(z.share)}%</Text>
                </View>
              );
            })}
          </View>

          {message ? <Text style={s.message} accessibilityLiveRegion="polite">{message}</Text> : <Text style={s.note}>{t('note')}</Text>}

          <View style={s.actions}>
            {selected !== null ? (
              <Pressable onPress={deleteSelected} accessibilityRole="button" style={({ pressed }) => [s.btn, s.btnDanger, pressed && s.pressed]}>
                <Trash2 size={17} color="#B42318" />
                <Text style={[s.btnText, { color: '#B42318' }]}>{t('deleteLine')}</Text>
              </Pressable>
            ) : (
              <Pressable onPress={undo} disabled={!history.length} accessibilityRole="button" accessibilityState={{ disabled: !history.length }}
                style={({ pressed }) => [s.btn, !history.length && s.btnDisabled, pressed && s.pressed]}>
                <Undo2 size={17} color="#536238" />
                <Text style={s.btnText}>{t('undo')}</Text>
              </Pressable>
            )}
            <Pressable onPress={resetAuto} disabled={state.isAuto} accessibilityRole="button" accessibilityState={{ disabled: state.isAuto }}
              style={({ pressed }) => [s.btn, state.isAuto && s.btnDisabled, pressed && s.pressed]}>
              <RotateCcw size={17} color="#536238" />
              <Text style={s.btnText}>{t('auto')}</Text>
            </Pressable>
            <Pressable onPress={save} disabled={saving} accessibilityRole="button" style={({ pressed }) => [s.btn, s.btnPrimary, pressed && s.pressed]}>
              {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Check size={17} color="#FFFFFF" />}
              <Text style={[s.btnText, { color: '#FFFFFF' }]}>{saving ? t('saving') : t('save')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1f17' },
  header: { position: 'absolute', left: 14, right: 14 },
  headerCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 22,
    backgroundColor: 'rgba(20,32,26,0.9)', borderWidth: 1, borderColor: 'rgba(245,243,232,0.25)',
  },
  eyebrow: { color: '#B9F62F', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: '#FAF9F4', fontSize: 19, fontWeight: '800', marginTop: 2 },
  hint: { color: '#D9DBD1', fontSize: 12.5, lineHeight: 17, marginTop: 4 },
  closeBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  panel: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 14, paddingHorizontal: 16,
    borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: '#F5F3E8',
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 16,
  },
  panelTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 28, borderRadius: 14 },
  badgeAuto: { backgroundColor: '#E8E9DA' },
  badgeCustom: { backgroundColor: '#D9F99D' },
  badgeText: { color: '#1F2A1C', fontSize: 12, fontWeight: '700' },
  count: { color: '#536238', fontSize: 13, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 32, borderRadius: 16, borderWidth: 1.5, backgroundColor: '#FFFFFF' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  chipText: { color: '#1F2A1C', fontSize: 14, fontWeight: '800' },
  chipShare: { color: '#536238', fontSize: 12, fontWeight: '600' },
  message: { color: '#B42318', fontSize: 12.5, lineHeight: 17, marginTop: 10, fontWeight: '600' },
  note: { color: '#6B7260', fontSize: 11.5, lineHeight: 16, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: {
    flex: 1, height: 48, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(83,98,56,0.25)',
  },
  btnPrimary: { backgroundColor: '#0B6B3A', borderColor: '#0B6B3A' },
  btnDanger: { borderColor: 'rgba(180,35,24,0.35)', backgroundColor: '#FEF3F2' },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: '#536238', fontSize: 13.5, fontWeight: '700' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
