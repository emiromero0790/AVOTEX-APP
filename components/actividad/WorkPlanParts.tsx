/**
 * Piezas del Plan de trabajo (Actividad → Plan de trabajo), sobre fondo marfil limpio: la única fotografía de
 * la sección es el encabezado de Actividad. Solo presentación: los datos y las acciones (completar, borrar,
 * crear) vienen de la pantalla, que sigue usando la tabla real `tasks`.
 *
 * La tabla `tasks` no tiene tipo, prioridad ni huerta: el tipo (riego, tratamiento, revisión…) se deduce del
 * texto de la tarea solo para elegir icono y color; la huerta/cultivo se muestra si viene anotada en el detalle
 * (así la guardan las acciones recomendadas del Resumen). No se inventan prioridades.
 */
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  CalendarCheck, Check, ChevronLeft, ChevronRight, ClipboardList, Clock, Droplets, Footprints, Leaf, MapPin,
  Satellite, ScanLine, SprayCan, Trash2, type LucideIcon,
} from 'lucide-react-native';
import { PressableScale } from '../scan/motion';
import { P } from './charts/core';

// ───────── Tipo de tarea (deducido del texto) ─────────

export type TaskKind = 'riego' | 'tratamiento' | 'revision' | 'monitoreo' | 'satelital' | 'visita' | 'escaneo' | 'general';

const KIND: Record<TaskKind, { Icon: LucideIcon; color: string; tile: string }> = {
  riego: { Icon: Droplets, color: '#3E9CB8', tile: '#E3F2F4' },
  tratamiento: { Icon: SprayCan, color: '#E0A21F', tile: '#FFF3D6' },
  revision: { Icon: Leaf, color: '#6DB33F', tile: '#EAF6DD' },
  monitoreo: { Icon: MapPin, color: P.leaf, tile: '#E6F4E2' },
  satelital: { Icon: Satellite, color: '#2E7D5B', tile: '#E2F0EA' },
  visita: { Icon: Footprints, color: '#7A9A3A', tile: '#EEF3DF' },
  escaneo: { Icon: ScanLine, color: P.agri, tile: '#E4F3E2' },
  general: { Icon: ClipboardList, color: '#7FA08A', tile: '#EDF2EC' },
};

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function taskKind(title: string, detail = ''): TaskKind {
  const v = norm(`${title} ${detail}`);
  if (/\b(rieg|regar|agua|irrig|water)/.test(v)) return 'riego';
  if (/(tratamiento|aplica|fumig|fertiliz|fungicid|insecticid|spray|treat)/.test(v)) return 'tratamiento';
  if (/(satel|ndvi|eosda)/.test(v)) return 'satelital';
  if (/(hallazgo|revis|separa|plaga|enfermedad|finding|review|inspect)/.test(v)) return 'revision';
  if (/(escane|foto|analiz|scan|photo)/.test(v)) return 'escaneo';
  if (/(visita|recorr|campo|walk|visit)/.test(v)) return 'visita';
  if (/(monitor|lote|huerta|seguimiento|document|plot|track)/.test(v)) return 'monitoreo';
  return 'general';
}

/** Separa del detalle la línea de contexto «Huerta: … · Cultivo: …» (o en inglés) para mostrarla aparte. */
export function splitContext(detail: string): { text: string; context: string | null } {
  const lines = detail.split('\n');
  const idx = lines.findIndex(l => /^(huerta|cultivo|orchard|crop)\s*:/i.test(l.trim()));
  if (idx < 0) return { text: detail.trim(), context: null };
  const context = lines[idx].trim();
  return { text: lines.filter((_, i) => i !== idx).join('\n').trim(), context };
}

// ───────── Encabezado del contenido ─────────

export const PlanIntro = memo(function PlanIntro({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={st.intro}>
      <View pointerEvents="none" style={st.introCurve}>
        <Svg width="100%" height="100%" viewBox="0 0 400 60" preserveAspectRatio="none">
          <Path d="M0 50 C 90 20, 200 62, 290 34 C 340 18, 375 22, 400 10 L400 60 L0 60 Z" fill={P.leaf} opacity={0.07} />
          <Path d="M210 58 C 260 40, 320 52, 400 30" stroke={P.lime} strokeOpacity={0.5} strokeWidth={1.5} fill="none" />
        </Svg>
      </View>
      <View style={st.introArt} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={st.introLeaf}><Leaf size={26} color={P.leaf} fill="rgba(56,163,74,0.25)" /></View>
        <View style={st.introTile}><ClipboardList size={34} color={P.deep} strokeWidth={2} /></View>
        <View style={st.introCheck}><Check size={14} color={P.forest} strokeWidth={3.2} /></View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.introTitle} accessibilityRole="header" maxFontSizeMultiplier={1.2}>{title}</Text>
        <Text style={st.introSub} maxFontSizeMultiplier={1.25}>{subtitle}</Text>
      </View>
    </View>
  );
});

// ───────── Calendario semanal ─────────

export type DayMark = { total: number; done: number };

export const WeekCalendar = memo(function WeekCalendar({ days, selected, onSelect, monthLabel, onPrev, onNext, onToday, todayKey, marks, keyOf, weekdayOf, labels }: {
  days: Date[]; selected: number; onSelect: (i: number) => void; monthLabel: string;
  onPrev: () => void; onNext: () => void; onToday?: () => void; todayKey: string;
  marks: Map<string, DayMark>; keyOf: (d: Date) => string; weekdayOf: (d: Date) => string;
  labels: { prev: string; next: string; today: string; day: (d: Date, mark?: DayMark) => string };
}) {
  return (
    <View style={st.card}>
      <View style={st.calHead}>
        <PressableScale onPress={onPrev} style={st.arrow} accessibilityRole="button" accessibilityLabel={labels.prev} hitSlop={8}>
          <ChevronLeft size={20} color={P.agri} strokeWidth={2.4} />
        </PressableScale>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={st.month} numberOfLines={1} maxFontSizeMultiplier={1.2}>{monthLabel}</Text>
          {onToday && (
            <Pressable onPress={onToday} hitSlop={8} accessibilityRole="button" style={st.todayChip}>
              <Text style={st.todayText}>{labels.today}</Text>
            </Pressable>
          )}
        </View>
        <PressableScale onPress={onNext} style={st.arrow} accessibilityRole="button" accessibilityLabel={labels.next} hitSlop={8}>
          <ChevronRight size={20} color={P.agri} strokeWidth={2.4} />
        </PressableScale>
      </View>
      <View style={st.week}>
        {days.map((day, i) => {
          const key = keyOf(day);
          const on = i === selected;
          const isToday = key === todayKey;
          const mark = marks.get(key);
          const allDone = !!mark && mark.total > 0 && mark.done === mark.total;
          return (
            <Pressable key={key} onPress={() => onSelect(i)} accessibilityRole="button" accessibilityState={{ selected: on }}
              accessibilityLabel={labels.day(day, mark)}
              style={({ pressed }) => [st.day, on && st.dayOn, pressed && !on && { backgroundColor: '#F3F8EC' }]}>
              <Text style={[st.dayName, on && { color: P.agri }]} maxFontSizeMultiplier={1.1}>{weekdayOf(day)}</Text>
              <Text style={[st.dayNum, isToday && !on && { color: P.agri }, on && { color: P.deep }]} maxFontSizeMultiplier={1.1}>{day.getDate()}</Text>
              {mark && mark.total > 0
                ? <View style={[st.dot, allDone ? st.dotDone : null]} />
                : isToday ? <View style={st.todayBar} /> : <View style={st.dotSpace} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

// ───────── Resumen del día ─────────

export type DayCounts = { total: number; pending: number; done: number; overdue: number };

export const DaySummary = memo(function DaySummary({ title, counts, labels }: {
  title: string; counts: DayCounts;
  labels: { tasks: (n: number) => string; pending: (n: number) => string; done: (n: number) => string; overdue: (n: number) => string; free: string; allDone: string };
}) {
  const progress = counts.total ? counts.done / counts.total : 0;
  return (
    <View style={st.summary}>
      <View style={st.summaryHead}>
        <Text style={st.summaryTitle} numberOfLines={2} maxFontSizeMultiplier={1.2}>{title}</Text>
        <View style={st.countChip}><Text style={st.countText}>{labels.tasks(counts.total)}</Text></View>
      </View>
      <View style={st.chips}>
        {counts.total === 0 && <Chip tone="info" text={labels.free} />}
        {counts.total > 0 && counts.done === counts.total && <Chip tone="done" text={labels.allDone} />}
        {counts.overdue > 0 && <Chip tone="warn" text={labels.overdue(counts.overdue)} />}
        {counts.pending > 0 && <Chip tone="pending" text={labels.pending(counts.pending)} />}
        {counts.done > 0 && counts.done < counts.total && <Chip tone="done" text={labels.done(counts.done)} />}
      </View>
      {counts.total > 0 && (
        <View style={st.progress} accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: counts.total, now: counts.done }}>
          <View style={[st.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      )}
    </View>
  );
});

type Tone = 'pending' | 'warn' | 'done' | 'info' | 'today';
const TONE: Record<Tone, { bg: string; ink: string; dot: string }> = {
  pending: { bg: '#EEFAD6', ink: '#3D6B0F', dot: '#8CCB2E' },
  today: { bg: '#E4FBB4', ink: '#2F5A0A', dot: P.lime },
  warn: { bg: '#FFF1D2', ink: '#8A5A00', dot: P.amber },
  done: { bg: P.agri, ink: '#FFFFFF', dot: P.limeSoft },
  info: { bg: '#EEF2EC', ink: '#556A5E', dot: '#9FB3A6' },
};

function Chip({ tone, text }: { tone: Tone; text: string }) {
  const c = TONE[tone];
  return (
    <View style={[st.chip, { backgroundColor: c.bg }]}>
      <View style={[st.chipDot, { backgroundColor: c.dot }]} />
      <Text style={[st.chipText, { color: c.ink }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{text}</Text>
    </View>
  );
}

// ───────── Tarjeta de tarea ─────────

export type TaskStatus = 'overdue' | 'today' | 'pending' | 'done';
const STATUS_TONE: Record<TaskStatus, Tone> = { overdue: 'warn', today: 'today', pending: 'info', done: 'done' };

export const TaskCard = memo(function TaskCard({ title, detail, time, status, statusLabel, completed, onToggle, onDelete, labels }: {
  title: string; detail: string; time: string | null; status: TaskStatus; statusLabel: string; completed: boolean;
  onToggle: () => void; onDelete: () => void;
  labels: { toggle: string; remove: string };
}) {
  const { text, context } = splitContext(detail);
  const kind = KIND[taskKind(title, text)];
  return (
    <View style={[st.task, completed && { backgroundColor: '#FBFCF8' }]}>
      <View style={[st.stripe, { backgroundColor: completed ? '#BFD8B5' : status === 'overdue' ? P.amber : kind.color }]} />
      <View style={[st.taskTile, { backgroundColor: kind.tile }]}>
        <kind.Icon size={22} color={kind.color} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={[st.taskTitle, completed && st.taskTitleDone]} numberOfLines={2} maxFontSizeMultiplier={1.25}>{title}</Text>
        {text ? <Text style={st.taskText} numberOfLines={2} maxFontSizeMultiplier={1.25}>{text}</Text> : null}
        {context ? (
          <View style={st.meta}>
            <MapPin size={13} color={P.agri} />
            <Text style={st.metaText} numberOfLines={1}>{context}</Text>
          </View>
        ) : null}
        <View style={st.metaRow}>
          {time ? (
            <View style={st.timeChip}>
              <Clock size={12} color={P.muted} />
              <Text style={st.timeText}>{time}</Text>
            </View>
          ) : null}
          <Chip tone={STATUS_TONE[status]} text={statusLabel} />
        </View>
      </View>
      <View style={st.side}>
        <Pressable onPress={onToggle} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: completed }} accessibilityLabel={labels.toggle}
          style={({ pressed }) => [st.check, completed && st.checkOn, pressed && { transform: [{ scale: 0.92 }] }]}>
          {completed && <Check size={16} color="#FFFFFF" strokeWidth={3} />}
        </Pressable>
        <Pressable onPress={onDelete} hitSlop={10} accessibilityRole="button" accessibilityLabel={labels.remove}
          style={({ pressed }) => [st.trash, pressed && { opacity: 0.55 }]}>
          <Trash2 size={16} color="#8A9A90" />
        </Pressable>
      </View>
    </View>
  );
});

// ───────── Día sin tareas ─────────

export const EmptyDay = memo(function EmptyDay({ title, body, action, onAction }: { title: string; body: string; action: string; onAction: () => void }) {
  return (
    <View style={st.empty}>
      <View style={st.emptyIcon}><CalendarCheck size={26} color={P.agri} strokeWidth={2} /></View>
      <Text style={st.emptyTitle} maxFontSizeMultiplier={1.25}>{title}</Text>
      <Text style={st.emptyBody} maxFontSizeMultiplier={1.25}>{body}</Text>
      <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button" style={({ pressed }) => [st.emptyLink, pressed && { opacity: 0.7 }]}>
        <Text style={st.emptyLinkText}>{action}</Text>
      </Pressable>
    </View>
  );
});

const shadow = { shadowColor: '#1C3A26', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 } as const;

const st = StyleSheet.create({
  intro: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 16, paddingVertical: 8, paddingBottom: 14 },
  introCurve: { position: 'absolute', left: -16, right: -16, bottom: -4, height: 46 },
  introArt: { width: 78, height: 78 },
  introLeaf: { position: 'absolute', left: -6, bottom: 2, transform: [{ rotate: '-35deg' }] },
  introTile: {
    position: 'absolute', right: 0, top: 0, width: 66, height: 70, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#D5EBC2', transform: [{ rotate: '-6deg' }], ...shadow,
  },
  introCheck: {
    position: 'absolute', right: -4, bottom: -2, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: P.lime, borderWidth: 2, borderColor: '#FFFFFF',
  },
  introTitle: { fontFamily: 'Poppins_700Bold', fontSize: 27, lineHeight: 33, letterSpacing: -0.6, color: P.forest },
  introSub: { fontFamily: 'Poppins_400Regular', fontSize: 13.5, lineHeight: 19, color: P.muted, marginTop: 2 },

  card: { marginHorizontal: 16, padding: 14, borderRadius: 26, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EDF1E6', ...shadow },
  calHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  arrow: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF7E4' },
  month: { fontFamily: 'Poppins_600SemiBold', fontSize: 17, color: P.ink },
  todayChip: { marginTop: 2, paddingHorizontal: 10, paddingVertical: 2, borderRadius: 10, backgroundColor: '#E9FFB8' },
  todayText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: P.deep },
  week: { flexDirection: 'row', gap: 4 },
  day: { flex: 1, minHeight: 74, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 2, borderWidth: 1.5, borderColor: 'transparent' },
  dayOn: { backgroundColor: '#E6F7D2', borderColor: '#B9F62F' },
  dayName: { fontFamily: 'Poppins_600SemiBold', fontSize: 11.5, color: P.muted, textTransform: 'uppercase' },
  dayNum: { fontFamily: 'Poppins_600SemiBold', fontSize: 19, lineHeight: 24, color: P.ink },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: P.agri },
  dotDone: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: P.agri },
  dotSpace: { height: 6 },
  todayBar: { width: 14, height: 3, borderRadius: 2, backgroundColor: P.lime },

  summary: { marginHorizontal: 16, marginTop: 18, gap: 8 },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryTitle: { flex: 1, fontFamily: 'Poppins_600SemiBold', fontSize: 16.5, lineHeight: 22, color: P.ink },
  countChip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14, backgroundColor: '#E9FFB8' },
  countText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: P.deep },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11.5 },
  progress: { height: 6, borderRadius: 3, backgroundColor: '#E6EDE0', overflow: 'hidden' },
  progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3, backgroundColor: P.leaf },

  task: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginHorizontal: 16, marginBottom: 10, paddingVertical: 14, paddingLeft: 16, paddingRight: 12,
    borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EDF1E6', overflow: 'hidden', ...shadow,
  },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  taskTile: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  taskTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, lineHeight: 20, color: P.ink },
  taskTitleDone: { color: '#8A9A90', textDecorationLine: 'line-through' },
  taskText: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, lineHeight: 17, color: '#4E6157' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { flexShrink: 1, fontFamily: 'Poppins_400Regular', fontSize: 12, color: P.deep },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 2 },
  timeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: '#F2F5EE' },
  timeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11.5, color: '#4E6157' },
  side: { alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', gap: 12 },
  check: { width: 28, height: 28, borderRadius: 9, borderWidth: 2, borderColor: '#C3D4BA', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  checkOn: { backgroundColor: P.agri, borderColor: P.agri },
  trash: { padding: 4 },

  empty: {
    marginHorizontal: 16, marginBottom: 10, paddingVertical: 24, paddingHorizontal: 20, alignItems: 'center', gap: 6, borderRadius: 24,
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#DCEACF', borderStyle: 'dashed',
  },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF8E4', marginBottom: 4 },
  emptyTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 15.5, color: P.ink, textAlign: 'center' },
  emptyBody: { fontFamily: 'Poppins_400Regular', fontSize: 13, lineHeight: 18, color: P.muted, textAlign: 'center' },
  emptyLink: { marginTop: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, backgroundColor: '#EEF8E4' },
  emptyLinkText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: P.agri },
});
