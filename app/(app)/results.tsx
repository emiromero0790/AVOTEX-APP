import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, BarChart3, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Leaf, Plus, ScanLine, ShieldCheck, Trash2 } from 'lucide-react-native';
import { useFonts, Poppins_400Regular, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { supabase } from '../../supabaseConfig';
import { useAccessibility } from '../../context/AccessibilityContext';

type Scan = { id: number; created_at: string; user_id: string; label: string; score: number; fruto?: string };
type Task = { id: number; title: string; detail?: string; completed: boolean; user_id: string };
type Section = 'summary' | 'history' | 'plan';
type Recommendation = { title: string; text: string; tone: 'positive' | 'info' | 'warning' };
const TASK_DATE_PATTERN = /^\[avotex-date:(\d{4}-\d{2}-\d{2})\]\n?/;
const FRUIT_REMOTE_IMAGES: Record<string, string> = {
  limon: 'https://cdn.aarp.net/content/dam/aarpe/es/home/cocina/dieta-y-nutricion/info-10-2013/fotos-limon-beneficios/_jcr_content/root/container_main/container_body_main/list_container_body2/container_body_cf/body_two_cf_listicle_ten/cfimage.coreimg.50.932.jpeg/content/dam/aarp/food/diet_nutrition/2017/12/1140-lime-juice-lemon-benefits-esp.jpg',
  mango: 'https://cdn.myikas.com/images/0fc5e2e6-3ea7-443f-a09e-daf74b83e708/8ff8ba6b-d866-4e48-88c7-44e07abc07e2/3840/mango.webp',
  guayaba: 'https://clickabasto.com/cdn/shop/products/IMG_1458_665x462.jpg?v=1655783207',
  granada: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQoNOSa7eeyMktiOgpxYd8BV95f3PTgPnzHcg&s',
  cafe: 'https://cdn.alsuper.com/products/420910_p.webp',
};
const HEALTHY_FALLBACK = require('../../assets/images/avotexSano.png');
const REVIEW_FALLBACK = require('../../assets/images/avotexEnfermo.png');
const normalize = (value = '') => value.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
const healthy = (label = '') => {
  const normalized = normalize(label);
  if (/\b(no|not|sin)\s+(saludable|healthy|sano|fresh|fresco)\b/.test(normalized)) return false;
  return ['saludable', 'healthy', 'sano', 'fresh', 'fresco'].some(word => normalized.includes(word));
};
const diagnosisName = (label = '') => healthy(label) ? 'Saludable' : label.trim() || 'Sin diagnóstico';
const fruitImage = (fruit = 'Aguacate', isHealthy = true) => {
  const key = normalize(fruit);
  if (!fruit || key === 'aguacate') return isHealthy ? HEALTHY_FALLBACK : REVIEW_FALLBACK;
  const remoteImage = FRUIT_REMOTE_IMAGES[key];
  return remoteImage ? { uri: remoteImage } : (isHealthy ? HEALTHY_FALLBACK : REVIEW_FALLBACK);
};
const dateText = (value: string) => new Date(value).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const taskDate = (task: Task) => task.detail?.match(TASK_DATE_PATTERN)?.[1] ?? null;
const visibleTaskDetail = (detail = '') => detail.replace(TASK_DATE_PATTERN, '');

export default function ResultsScreen() {
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold });
  const { isColorblindMode } = useAccessibility();
  const { width } = useWindowDimensions();
  const { view } = useLocalSearchParams<{ view?: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>(view === 'list' ? 'history' : view === 'plan' ? 'plan' : 'summary');
  const [fruit, setFruit] = useState('Todos');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDetail, setTaskDetail] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState((new Date().getDay() + 6) % 7);
  const colors = useMemo(() => ({
    primary: isColorblindMode ? '#145DA0' : '#14B8A6',
    accent: isColorblindMode ? '#3B82C4' : '#55D68B',
    soft: isColorblindMode ? '#EAF4FC' : '#E9F9EF',
    danger: isColorblindMode ? '#145DA0' : '#C75C4B',
  }), [isColorblindMode]);
  const tablet = width >= 768;

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    setSection(view === 'list' ? 'history' : view === 'plan' ? 'plan' : 'summary');
  }, [view]);
  useFocusEffect(useCallback(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [scanResult, taskResult] = await Promise.all([
        supabase.from('scans').select('*').eq('user_id', user.uid).order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').eq('user_id', user.uid).order('created_at', { ascending: false }),
      ]);
      if (!cancelled) {
        if (!scanResult.error) setScans((scanResult.data ?? []) as Scan[]);
        if (!taskResult.error) setTasks((taskResult.data ?? []) as Task[]);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user]));

  const validScans = useMemo(() => scans.filter(scan => !['nofruta', 'no fruta'].includes(normalize(scan.fruto))), [scans]);
  const fruits = useMemo(() => ['Todos', ...Array.from(new Set(validScans.map(scan => scan.fruto || 'Aguacate'))).sort()], [validScans]);
  const filtered = useMemo(() => fruit === 'Todos' ? validScans : validScans.filter(scan => (scan.fruto || 'Aguacate') === fruit), [fruit, validScans]);
  const goodCount = filtered.filter(scan => healthy(scan.label)).length;
  const average = filtered.length ? filtered.reduce((sum, scan) => sum + Number(scan.score || 0), 0) / filtered.length : 0;
  const fruitAnalytics = useMemo(() => {
    const source = fruit === 'Todos' ? validScans : filtered;
    const groups = Array.from(new Set(source.map(scan => scan.fruto || 'Aguacate')));
    return groups.map(name => {
      const items = source.filter(scan => (scan.fruto || 'Aguacate') === name);
      const healthyCount = items.filter(scan => healthy(scan.label)).length;
      const averageScore = items.length ? items.reduce((sum, scan) => sum + Number(scan.score || 0), 0) / items.length : 0;
      const statusCounts = items.reduce<Record<string, number>>((acc, scan) => {
        const key = diagnosisName(scan.label);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      return { name, count: items.length, healthyCount, averageScore, statusCounts };
    }).sort((a, b) => b.count - a.count);
  }, [filtered, fruit, validScans]);
  const weekDays = useMemo(() => {
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + weekOffset * 7);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [weekOffset]);
  const recommendations = useMemo(() => {
    if (!validScans.length) return [{ title: 'Realiza tu primer escaneo', text: 'Analiza un fruto para recibir acciones personalizadas.', tone: 'info' as const }];
    const findings = filtered.length - goodCount;
    const items: Recommendation[] = findings > 0
      ? [{ title: 'Separa los frutos con hallazgos', text: `${findings} análisis requieren revisión antes de mezclarlos con frutos saludables.`, tone: 'warning' as const }]
      : [{ title: 'Mantén el control preventivo', text: 'Los análisis seleccionados no muestran señales de riesgo.', tone: 'positive' as const }];
    if (average < 0.8) items.push({ title: 'Repite los análisis con menor confianza', text: 'Una nueva fotografía con luz uniforme puede confirmar el resultado.', tone: 'info' as const });
    items.push({ title: 'Documenta la acción aplicada', text: 'Añade una tarea para revisar la evolución del lote durante la semana.', tone: 'positive' as const });
    return items;
  }, [average, filtered.length, goodCount, validScans.length]);
  const selectedDateLabel = weekDays[selectedDay]?.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }) ?? '';
  const selectedDateKey = weekDays[selectedDay] ? dateKey(weekDays[selectedDay]) : '';
  const todayKey = dateKey(new Date());
  const tasksForSelectedDay = useMemo(
    () => tasks.filter(task => taskDate(task) === selectedDateKey || (!taskDate(task) && selectedDateKey === todayKey)),
    [selectedDateKey, tasks, todayKey],
  );
  const scheduledDates = useMemo(() => new Set(tasks.map(taskDate).filter(Boolean)), [tasks]);

  const addTask = async () => {
    if (!user || !taskTitle.trim()) return;
    const datedDetail = `[avotex-date:${selectedDateKey}]\n${taskDetail.trim()}`;
    const { data, error } = await supabase.from('tasks').insert({ title: taskTitle.trim(), detail: datedDetail, user_id: user.uid, completed: false }).select().single();
    if (!error && data) setTasks(current => [data as Task, ...current]);
    setTaskTitle(''); setTaskDetail(''); setShowForm(false);
  };
  const updateTask = async (task: Task) => {
    const completed = !task.completed;
    const { error } = await supabase.from('tasks').update({ completed }).eq('id', task.id);
    if (!error) setTasks(current => current.map(item => item.id === task.id ? { ...item, completed } : item));
  };
  const deleteTask = async (id: number) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (!error) setTasks(current => current.filter(task => task.id !== id));
  };
  const prepareTask = (item: Recommendation) => {
    setTaskTitle(item.title);
    setTaskDetail(item.text);
    setShowForm(true);
    changeSection('plan');
  };
  const changeSection = (nextSection: Section) => {
    setSection(nextSection);
    router.setParams({ view: nextSection === 'history' ? 'list' : nextSection === 'plan' ? 'plan' : 'charts' });
  };
  if (!fontsLoaded) return null;
  if (!user) return <View style={styles.center}><Text style={styles.emptyTitle}>Inicia sesión para ver tu actividad</Text></View>;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Actividad' }} />
      <ScrollView contentContainerStyle={[styles.content, tablet && styles.contentTablet]} keyboardShouldPersistTaps="handled">
         <View style={styles.header}>
          <Text style={styles.title}>Decisiones claras a partir de tus escaneos</Text>
         </View>
        <View style={styles.navigator}>{([
          ['summary', 'Resumen', BarChart3], ['history', 'Historial', ClipboardList], ['plan', 'Plan de trabajo', Check],
        ] as const).map(([key, label, Icon]) => <TouchableOpacity key={key} onPress={() => changeSection(key)} style={[styles.navItem, section === key && { backgroundColor: colors.primary }]}><Icon size={17} color={section === key ? '#fff' : colors.primary} /><Text style={[styles.navText, section === key && styles.navTextActive]}>{label}</Text></TouchableOpacity>)}</View>
        {loading ? <ActivityIndicator color={colors.primary} style={{ margin: 40 }} /> : section === 'summary' ? (
          <View>
            <Text style={styles.heading}>Resumen de salud</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{fruits.map(item => <TouchableOpacity key={item} onPress={() => setFruit(item)} style={[styles.chip, fruit === item && { backgroundColor: colors.primary }]}><Text style={[styles.chipText, fruit === item && styles.chipTextActive]}>{item}</Text></TouchableOpacity>)}</ScrollView>
            <View style={styles.metrics}><Metric value={String(filtered.length)} label="escaneos" /><Metric value={`${Math.round(average * 100)}%`} label="confianza media" /><Metric value={`${filtered.length ? Math.round(goodCount / filtered.length * 100) : 0}%`} label="saludable" /></View>
             <View style={styles.card}><View style={styles.cardTitle}><ShieldCheck size={18} color={colors.primary} /><Text style={styles.headingSmall}>Estado de tus frutos</Text></View><Text style={styles.cardCaption}>Distribución de resultados por cada fruto analizado.</Text>{fruitAnalytics.length ? fruitAnalytics.map(item => <View key={item.name} style={styles.fruitChart}><View style={styles.fruitChartHeader}><Text style={styles.headingSmall}>{item.name}</Text><Text style={styles.muted}>{item.count} {item.count === 1 ? 'escaneo' : 'escaneos'}</Text></View><View style={styles.statusTrack}><View style={[styles.statusHealthy, { width: `${item.count ? item.healthyCount / item.count * 100 : 0}%`, backgroundColor: colors.accent }]} /><View style={[styles.statusNeedsReview, { width: `${item.count ? (item.count - item.healthyCount) / item.count * 100 : 0}%`, backgroundColor: colors.danger }]} /></View><View style={styles.chartLegend}><Text style={styles.legendHealthy}>Saludable {item.count ? Math.round(item.healthyCount / item.count * 100) : 0}%</Text><Text style={styles.legendReview}>Revisión {item.count ? Math.round((item.count - item.healthyCount) / item.count * 100) : 0}%</Text></View></View>) : <Empty text="Aún no hay datos para graficar." />}</View>
             <View style={styles.card}><View style={styles.cardTitle}><BarChart3 size={18} color={colors.primary} /><Text style={styles.headingSmall}>Volumen por fruto</Text></View><Text style={styles.cardCaption}>Cantidad de escaneos en la selección actual.</Text>{fruitAnalytics.length ? <View style={styles.volumeChart}>{fruitAnalytics.map(item => { const max = Math.max(...fruitAnalytics.map(value => value.count), 1); return <View key={item.name} style={styles.volumeColumn}><Text style={styles.volumeValue}>{item.count}</Text><View style={styles.volumeTrack}><View style={[styles.volumeBar, { height: `${Math.max(12, item.count / max * 100)}%`, backgroundColor: colors.primary }]} /></View><Text numberOfLines={1} style={styles.volumeLabel}>{item.name}</Text></View>; })}</View> : <Empty text="Aún no hay datos para graficar." />}</View>
             <View style={styles.card}><View style={styles.cardTitle}><Leaf size={18} color={colors.primary} /><Text style={styles.headingSmall}>Lectura por fruto</Text></View><Text style={styles.cardCaption}>Confianza media y resultados que requieren atención.</Text>{fruitAnalytics.length ? fruitAnalytics.map(item => <View key={item.name} style={styles.readingRow}><View style={{ flex: 1 }}><Text style={styles.body}>{item.name}</Text><View style={styles.confidenceTrack}><View style={[styles.confidenceFill, { width: `${Math.round(item.averageScore * 100)}%`, backgroundColor: colors.accent }]} /></View></View><Text style={styles.readingScore}>{Math.round(item.averageScore * 100)}%</Text><Text style={styles.readingAttention}>{item.count - item.healthyCount} revisión</Text></View>) : <Empty text="Aún no hay datos para graficar." />}</View>
            <Text style={styles.subheading}>Acciones recomendadas</Text>
            {recommendations.map((item, index) => <View key={item.title} style={[styles.recommendation, { backgroundColor: item.tone === 'warning' ? '#FFF4E1' : item.tone === 'info' ? '#EAF4FC' : colors.soft }]}><View style={[styles.priorityBadge, { backgroundColor: item.tone === 'warning' ? '#C78335' : colors.primary }]}><Text style={styles.priorityText}>{index + 1}</Text></View><View style={{ flex: 1 }}><Text style={styles.headingSmall}>{item.title}</Text><Text style={styles.body}>{item.text}</Text><TouchableOpacity onPress={() => prepareTask(item)}><Text style={[styles.actionText, { color: colors.primary }]}>Añadir al plan de trabajo</Text></TouchableOpacity></View></View>)}
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={() => router.push('/(app)/scan')}><ScanLine size={18} color="#fff" /><Text style={styles.buttonText}>Escanear un fruto</Text></TouchableOpacity>
          </View>
        ) : section === 'history' ? (
          <View><Text style={styles.heading}>Historial de análisis</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{fruits.map(item => <TouchableOpacity key={item} onPress={() => setFruit(item)} style={[styles.chip, fruit === item && { backgroundColor: colors.primary }]}><Text style={[styles.chipText, fruit === item && styles.chipTextActive]}>{item}</Text></TouchableOpacity>)}</ScrollView>{filtered.length ? filtered.map((scan, index) => { const isHealthy = healthy(scan.label); const score = Math.max(0, Math.min(1, Number(scan.score) || 0)); return <TouchableOpacity key={`${scan.id ?? scan.created_at}-${index}`} style={styles.scanRow} onPress={() => setExpanded(expanded === scan.id ? null : scan.id)}><Image source={fruitImage(scan.fruto, isHealthy)} style={styles.scanImage} /><View style={styles.scanInfo}><Text style={styles.headingSmall}>{scan.fruto || 'Aguacate'}</Text><Text numberOfLines={1} style={[styles.scanDiagnosis, { color: isHealthy ? '#3BAE72' : colors.danger }]}>{scan.label}</Text><Text style={styles.muted}>{dateText(scan.created_at)}</Text>{expanded === scan.id && <Text style={styles.detail}>{isHealthy ? 'Sin señales de riesgo' : 'Revisión recomendada'}</Text>}</View><View style={styles.scanSparkline}>{[0.62, 0.8, 0.7, 0.92, 0.76, 1].map((factor, barIndex) => <View key={barIndex} style={[styles.scanSparkBar, { height: Math.max(5, Math.min(28, score * factor * 28)), backgroundColor: isHealthy ? colors.primary : colors.danger }]} />)}</View><View style={styles.scanScoreColumn}><Text style={styles.scanScoreValue}>{Math.round(score * 100)}%</Text><Text style={[styles.scanScoreCaption, { color: isHealthy ? '#3BAE72' : colors.danger }]}>score</Text></View><ChevronDown size={15} color="#94A3B8" /></TouchableOpacity>; }) : <Empty text="Aún no tienes escaneos." />}</View>
        ) : (
          <View><Text style={styles.heading}>Plan de trabajo</Text><Text style={[styles.body, styles.planIntro]}>Organiza tus acciones de esta semana y da seguimiento a cada lote.</Text><View style={styles.calendar}><View style={styles.calendarHeader}><TouchableOpacity accessibilityLabel="Semana anterior" onPress={() => setWeekOffset(value => value - 1)}><ChevronLeft size={19} color={colors.primary} /></TouchableOpacity><Text style={styles.calendarMonth}>{weekDays[0].toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</Text><TouchableOpacity accessibilityLabel="Semana siguiente" onPress={() => setWeekOffset(value => value + 1)}><ChevronRight size={19} color={colors.primary} /></TouchableOpacity></View><View style={styles.week}>{weekDays.map((day, index) => <TouchableOpacity key={day.toISOString()} onPress={() => setSelectedDay(index)} style={[styles.day, selectedDay === index && { backgroundColor: colors.soft }]}><Text style={[styles.dayName, selectedDay === index && { color: colors.primary }]}>{day.toLocaleDateString('es-MX', { weekday: 'narrow' })}</Text><Text style={[styles.dayNumber, selectedDay === index && { color: colors.primary }]}>{day.getDate()}</Text>{(scheduledDates.has(dateKey(day)) || selectedDay === index) && <View style={[styles.dayDot, { backgroundColor: scheduledDates.has(dateKey(day)) ? colors.accent : colors.primary }]} />}</TouchableOpacity>)}</View></View><Text style={styles.selectedDate}>Tareas para {selectedDateLabel}</Text><TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={() => setShowForm(value => !value)}><Plus size={18} color="#fff" /><Text style={styles.buttonText}>Añadir tarea</Text></TouchableOpacity>{showForm && <View style={styles.form}><Text style={styles.formDate}>Se programará para {selectedDateLabel}</Text><TextInput value={taskTitle} onChangeText={setTaskTitle} placeholder="Ej. Revisar caja de mangos" style={styles.input} placeholderTextColor="#94A3B8" /><TextInput value={taskDetail} onChangeText={setTaskDetail} placeholder="Detalle opcional" style={styles.input} placeholderTextColor="#94A3B8" /><TouchableOpacity onPress={addTask} style={[styles.smallButton, { backgroundColor: colors.primary }]}><Text style={styles.buttonText}>Guardar tarea</Text></TouchableOpacity></View>}{tasksForSelectedDay.length ? tasksForSelectedDay.map((task, index) => <View style={styles.task} key={`${task.id}-${index}`}><TouchableOpacity onPress={() => updateTask(task)} style={[styles.check, task.completed && { backgroundColor: colors.primary }]}>{task.completed && <Check size={14} color="#fff" />}</TouchableOpacity><View style={{ flex: 1 }}><Text style={[styles.headingSmall, task.completed && styles.done]}>{task.title}</Text>{visibleTaskDetail(task.detail) ? <Text style={styles.muted}>{visibleTaskDetail(task.detail)}</Text> : null}</View><TouchableOpacity accessibilityLabel={`Eliminar ${task.title}`} onPress={() => deleteTask(task.id)}><Trash2 size={17} color="#94A3B8" /></TouchableOpacity></View>) : <View style={styles.emptyTasks}><Text style={styles.headingSmall}>No hay tareas para este día</Text><Text style={styles.muted}>Selecciona otra fecha o crea una acción nueva.</Text></View>}<TouchableOpacity style={styles.scanLink} onPress={() => router.push('/(app)/scan')}><AlertTriangle size={18} color={colors.primary} /><Text style={{ color: colors.primary, fontFamily: 'Poppins_600SemiBold' }}>Crear una tarea desde un nuevo escaneo</Text></TouchableOpacity></View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
function Metric({ value, label }: { value: string; label: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.muted}>{label}</Text></View>; }
function Empty({ text }: { text: string }) { return <View style={styles.empty}><Text style={styles.emptyTitle}>{text}</Text><Text style={styles.muted}>Ve a Escanear para empezar.</Text></View>; }
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' }, content: { paddingBottom: 120, backgroundColor: '#FFFFFF' }, contentTablet: { maxWidth: 760, width: '100%', alignSelf: 'center' },
  header: { paddingHorizontal: 22, paddingTop: 72, paddingBottom: 30, backgroundColor: '#FFFFFF' }, title: { maxWidth: 390, color: '#0A0A0A', fontFamily: 'Poppins_700Bold', fontSize: 38, lineHeight: 42, letterSpacing: -1.2 },
  navigator: { flexDirection: 'row', margin: 16, padding: 4, borderRadius: 16, backgroundColor: '#EAF4FC', gap: 3 }, navItem: { flex: 1, minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 2 }, navText: { color: '#52606D', fontFamily: 'Poppins_600SemiBold', fontSize: 10, textAlign: 'center' }, navTextActive: { color: '#fff' },
  heading: { fontFamily: 'Poppins_600SemiBold', color: '#1F2937', fontSize: 21, marginHorizontal: 18, marginTop: 8 }, headingSmall: { fontFamily: 'Poppins_600SemiBold', color: '#263238', fontSize: 14 }, body: { fontFamily: 'Poppins_400Regular', color: '#52606D', fontSize: 12, lineHeight: 19 }, muted: { color: '#718096', fontFamily: 'Poppins_400Regular', fontSize: 11 }, chips: { paddingHorizontal: 18, gap: 8, paddingVertical: 14 }, chip: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff' }, chipText: { color: '#52606D', fontFamily: 'Poppins_600SemiBold', fontSize: 11 }, chipTextActive: { color: '#fff' },
  subheading: { marginHorizontal: 18, marginTop: 20, marginBottom: 2, fontFamily: 'Poppins_600SemiBold', color: '#1F2937', fontSize: 17 },
  metrics: { flexDirection: 'row', marginHorizontal: 16, gap: 10 }, metric: { flex: 1, backgroundColor: '#fff', borderRadius: 15, padding: 14 }, metricValue: { color: '#14B8A6', fontFamily: 'Poppins_600SemiBold', fontSize: 20 }, card: { backgroundColor: '#fff', borderRadius: 18, margin: 16, marginBottom: 0, padding: 16, shadowColor: '#7895B2', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, cardTitle: { flexDirection: 'row', gap: 8, alignItems: 'center' }, cardCaption: { color: '#718096', fontFamily: 'Poppins_400Regular', fontSize: 11, marginTop: 5, marginBottom: 12 }, fruitChart: { borderTopWidth: 1, borderTopColor: '#E8EFF5', paddingTop: 11, marginTop: 3 }, fruitChartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, statusTrack: { height: 11, borderRadius: 8, overflow: 'hidden', backgroundColor: '#FBEDEA', flexDirection: 'row' }, statusHealthy: { height: '100%' }, statusNeedsReview: { height: '100%' }, chartLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }, legendHealthy: { color: '#3BAE72', fontFamily: 'Poppins_600SemiBold', fontSize: 10 }, legendReview: { color: '#B65B50', fontFamily: 'Poppins_400Regular', fontSize: 10 }, volumeChart: { height: 172, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', gap: 8, paddingTop: 16 }, volumeColumn: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' }, volumeValue: { color: '#374151', fontFamily: 'Poppins_600SemiBold', fontSize: 11, marginBottom: 5 }, volumeTrack: { height: 112, width: 27, borderRadius: 8, backgroundColor: '#EAF4FC', justifyContent: 'flex-end', overflow: 'hidden' }, volumeBar: { width: '100%', borderRadius: 8 }, volumeLabel: { color: '#52606D', fontFamily: 'Poppins_400Regular', fontSize: 9, marginTop: 7, maxWidth: 64 }, readingRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#E8EFF5' }, confidenceTrack: { height: 7, backgroundColor: '#EAF4FC', borderRadius: 5, overflow: 'hidden', marginTop: 6 }, confidenceFill: { height: '100%', borderRadius: 5 }, readingScore: { color: '#263238', fontFamily: 'Poppins_600SemiBold', fontSize: 12, width: 36, textAlign: 'right' }, readingAttention: { color: '#718096', fontFamily: 'Poppins_400Regular', fontSize: 9, width: 54, textAlign: 'right' },
  recommendation: { flexDirection: 'row', marginHorizontal: 16, marginTop: 10, padding: 16, borderRadius: 18, gap: 12 }, priorityBadge: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, priorityText: { color: '#fff', fontFamily: 'Poppins_600SemiBold', fontSize: 11 }, actionText: { marginTop: 7, fontFamily: 'Poppins_600SemiBold', fontSize: 11 }, primaryButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, margin: 16, borderRadius: 14, padding: 14 }, buttonText: { color: '#fff', fontFamily: 'Poppins_600SemiBold', fontSize: 13 }, scanRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 9, gap: 9, shadowColor: '#7895B2', shadowOpacity: 0.07, shadowRadius: 9, shadowOffset: { width: 0, height: 3 }, elevation: 2 }, scanImage: { width: 52, height: 52, borderRadius: 14 }, scanInfo: { flex: 1, minWidth: 0 }, scanDiagnosis: { fontFamily: 'Poppins_400Regular', fontSize: 10, marginTop: 1, marginBottom: 1 }, scanSparkline: { width: 46, height: 30, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 2 }, scanSparkBar: { width: 3, minHeight: 5, borderRadius: 2 }, scanScoreColumn: { width: 43, alignItems: 'flex-end' }, scanScoreValue: { color: '#263238', fontFamily: 'Poppins_600SemiBold', fontSize: 12 }, scanScoreCaption: { fontFamily: 'Poppins_600SemiBold', fontSize: 8, marginTop: 1 }, detail: { color: '#526B68', fontSize: 10, marginTop: 5, fontFamily: 'Poppins_400Regular' },
  planIntro: { marginHorizontal: 18, marginTop: 4 }, calendar: { margin: 16, marginBottom: 0, backgroundColor: '#fff', borderRadius: 18, padding: 13 }, calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, calendarMonth: { color: '#263238', fontFamily: 'Poppins_600SemiBold', fontSize: 13, textTransform: 'capitalize' }, week: { flexDirection: 'row', justifyContent: 'space-between' }, day: { width: 38, minHeight: 57, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, dayName: { color: '#718096', fontFamily: 'Poppins_600SemiBold', fontSize: 10, textTransform: 'uppercase' }, dayNumber: { color: '#374151', fontFamily: 'Poppins_600SemiBold', fontSize: 13, marginTop: 3 }, dayDot: { width: 4, height: 4, borderRadius: 2, marginTop: 3 }, selectedDate: { marginHorizontal: 18, marginTop: 13, color: '#374151', fontFamily: 'Poppins_600SemiBold', fontSize: 13, textTransform: 'capitalize' }, form: { backgroundColor: '#fff', margin: 16, padding: 14, borderRadius: 16, gap: 9 }, formDate: { color: '#52606D', fontFamily: 'Poppins_600SemiBold', fontSize: 11, textTransform: 'capitalize' }, input: { borderWidth: 1, borderColor: '#D8E3EA', borderRadius: 10, padding: 11, fontFamily: 'Poppins_400Regular', fontSize: 12 }, smallButton: { alignSelf: 'flex-end', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 }, task: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 15 }, check: { width: 23, height: 23, borderRadius: 12, borderWidth: 1.5, borderColor: '#55D68B', alignItems: 'center', justifyContent: 'center' }, done: { textDecorationLine: 'line-through', color: '#94A3B8' }, emptyTasks: { marginHorizontal: 16, marginBottom: 8, padding: 20, alignItems: 'center', backgroundColor: '#EAF4FC', borderRadius: 15 }, scanLink: { flexDirection: 'row', alignItems: 'center', gap: 9, margin: 20 }, empty: { alignItems: 'center', padding: 50 }, emptyTitle: { color: '#263238', fontFamily: 'Poppins_600SemiBold', fontSize: 15, textAlign: 'center' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
});