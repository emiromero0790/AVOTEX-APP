/**
 * Acciones recomendadas: lista editorial de acciones (número, título, descripción) con el botón
 * «Añadir al plan de trabajo». Las recomendaciones y su texto vienen de la pantalla (lógica existente);
 * no se inventan tratamientos ni diagnósticos.
 *
 * Estados del botón: listo → guardando (deshabilitado: tocar varias veces no duplica) → en tu plan.
 */
import React, { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, ClipboardCheck, Plus } from 'lucide-react-native';
import { BotanicalCardDecoration, P } from './charts/core';

export type ActionItem = { key: string; title: string; text: string; tone: 'positive' | 'info' | 'warning'; state: 'idle' | 'saving' | 'added' };

/** Primera: amarillo crema; segunda: verde claro; siguientes alternan marfil/verde. */
const TONES = [
  { bg: '#FFF6DC', border: '#F5E2A4', badge: P.amber, badgeInk: '#4A3200' },
  { bg: '#EEF8E4', border: '#D5ECC0', badge: P.leaf, badgeInk: '#FFFFFF' },
  { bg: '#F6F7EF', border: '#E6E9DA', badge: P.deep, badgeInk: P.limeSoft },
] as const;

function RecommendedActions({ title, subtitle, items, onAdd, onOpenPlan, labels }: {
  title: string; subtitle: string; items: ActionItem[];
  onAdd: (key: string) => void; onOpenPlan: () => void;
  labels: { add: string; added: string; saving: string };
}) {
  return (
    <View style={st.card}>
      <View style={st.clip} pointerEvents="none">
        <BotanicalCardDecoration variant="sprig" corner="tr" size={92} opacity={0.2} />
      </View>
      <View style={st.head}>
        <View style={st.headIcon}><ClipboardCheck size={20} color={P.agri} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.title} accessibilityRole="header" maxFontSizeMultiplier={1.25}>{title}</Text>
          <Text style={st.subtitle} maxFontSizeMultiplier={1.25}>{subtitle}</Text>
        </View>
      </View>
      <View style={{ gap: 10 }}>
        {items.map((it, i) => {
          const tone = TONES[Math.min(i, TONES.length - 1)];
          const added = it.state === 'added';
          const saving = it.state === 'saving';
          return (
            <View key={it.key} style={[st.item, { backgroundColor: tone.bg, borderColor: tone.border }]}>
              <View style={[st.badge, { backgroundColor: tone.badge }]}><Text style={[st.badgeText, { color: tone.badgeInk }]}>{i + 1}</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={st.itemTitle} maxFontSizeMultiplier={1.25}>{it.title}</Text>
                <Text style={st.itemText} maxFontSizeMultiplier={1.25}>{it.text}</Text>
                <Pressable onPress={() => (added ? onOpenPlan() : onAdd(it.key))} disabled={saving}
                  accessibilityRole="button" accessibilityState={{ disabled: saving, busy: saving }}
                  accessibilityLabel={`${added ? labels.added : labels.add}: ${it.title}`} hitSlop={6}
                  style={({ pressed }) => [st.btn, added && st.btnAdded, pressed && { transform: [{ scale: 0.97 }] }]}>
                  {saving ? <ActivityIndicator size="small" color={P.agri} />
                    : added ? <Check size={15} color={P.deep} strokeWidth={2.6} />
                    : <Plus size={15} color="#FFFFFF" strokeWidth={2.6} />}
                  <Text style={[st.btnText, added && { color: P.deep }, saving && { color: P.agri }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                    {saving ? labels.saving : added ? labels.added : labels.add}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default memo(RecommendedActions);

const st = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#EDF1E6',
    shadowColor: '#1C3A26', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  clip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  headIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: P.mint },
  title: { fontFamily: 'Poppins_600SemiBold', fontSize: 17, lineHeight: 23, color: P.ink, letterSpacing: -0.2 },
  subtitle: { fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 16, color: P.muted },
  item: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1 },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: 'Poppins_700Bold', fontSize: 13 },
  itemTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 14.5, lineHeight: 20, color: P.ink },
  itemText: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, lineHeight: 18, color: '#3F5248', marginTop: 2 },
  btn: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, minHeight: 36,
    paddingHorizontal: 14, borderRadius: 18, backgroundColor: P.agri,
  },
  btnAdded: { backgroundColor: 'rgba(185,246,47,0.45)' },
  btnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: '#FFFFFF' },
});
