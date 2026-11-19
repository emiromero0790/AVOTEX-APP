import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Reanimated, { FadeIn, FadeInDown, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import * as Network from 'expo-network';
import { Calendar as CalendarIcon, CalendarClock, ClipboardCheck, Layers, Map as MapIcon, RefreshCw, Sprout, WifiOff, X } from 'lucide-react-native';
import ConfidenceHero from '../../components/actividad/ConfidenceHero';
import ActividadHeader from '../../components/actividad/ActividadHeader';
import ActividadTabs, { type TabItem } from '../../components/actividad/ActividadTabs';
import QuickMetrics from '../../components/actividad/QuickMetrics';
import RecommendedActions, { type ActionItem } from '../../components/actividad/RecommendedActions';
import { DaySummary, EmptyDay, PlanIntro, TaskCard, WeekCalendar } from '../../components/actividad/WorkPlanParts';
import { SectionSkeleton } from '../../components/actividad/Skeleton';
import OrchardFilterSheet, { type OrchardFilter } from '../../components/actividad/OrchardFilterSheet';
import { CAT_GRADIENTS, ChartCard, EmptyChart, P } from '../../components/actividad/charts/core';
import OrchardShareBar, { NONE_GRADIENT, ORCHARD_GRADIENTS, OTHER_GRADIENT, type ShareSeg } from '../../components/actividad/charts/OrchardShareBar';
import FruitBars from '../../components/actividad/charts/FruitBars';
import { ClassBars, StatusStackBars, type ClassBar, type StackRow } from '../../components/actividad/charts/StatusStackBars';
import TrendLine, { type TrendPoint } from '../../components/actividad/charts/TrendLine';
import AttentionPanel from '../../components/actividad/charts/AttentionPanel';
import { attention, classRows, cropRows as buildCropRows, matchOrchard, orchardShare, sinceOf, timeline, type Granularity, type PeriodKey } from '../../services/actividadStats';
import { listRemote, type RecorridoRemoto } from '../../services/recorridos';
import { Footprints, Unlink } from 'lucide-react-native';
import { listOrchards, type Orchard } from '../../services/orchards';
import { categoria, listUserHallazgos, type CategoriaHallazgo, type HallazgoMapa } from '../../services/escaneos';
import { EASE_IN_OUT, EASE_OUT, PressableScale } from '../../components/scan/motion';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { AlertCircle, AlertTriangle, BarChart3, CalendarDays, CheckCircle2, Circle, Microscope, TrendingUp, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock, Plus, ScanLine, Trash2 } from 'lucide-react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useFonts, Poppins_400Regular, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { supabase } from '../../supabaseConfig';
import { useAccessibility } from '../../context/AccessibilityContext';
import { localizeDomainLabel, TranslationResource, useLanguage, useTranslations } from '../../context/LanguageContext';
import { fruitImage, isHealthyLabel } from '../../components/fruitImage';
import { noOverscroll } from '../../components/ui/noOverscroll';
import { useAvotexTabBarMetrics } from '../../components/tabbar/AvotexTabBar';

type Scan = { id: number; created_at: string; user_id: string; label: string; score: number; fruto?: string; huerta_id?: string | null };
type Period = PeriodKey;
/** Un análisis para el Resumen: foto individual (scans) o hallazgo de un recorrido (hallazgos). Fuentes distintas: no se duplican. */
type Rec = { source: 'foto' | 'recorrido'; crop: string; cat: Exclude<CategoriaHallazgo, 'otro'>; conf: number; date: number; huertaId: string | null; label: string };
type Task = { id: number; title: string; detail?: string; completed: boolean; user_id: string; scheduled_at?: string; created_at?: string };
type Section = 'summary' | 'history' | 'plan';
type Recommendation = { title: string; text: string; tone: 'positive' | 'info' | 'warning' };
const TASK_DATE_PATTERN = /^\[avotex-date:(\d{4}-\d{2}-\d{2})\]\n?/;
const translations: TranslationResource = {
  activity: { es: 'Actividad', en: 'Activity' },
  loginToSee: { es: 'Inicia sesión para ver tu actividad', en: 'Sign in to see your activity' },
  clearDecisions: { es: 'Decisiones claras a partir de tus escaneos', en: 'Clear decisions from your scans' },
  summary: { es: 'Resumen', en: 'Summary' }, history: { es: 'Historial', en: 'History' }, workPlan: { es: 'Plan de trabajo', en: 'Work plan' },
  healthSummary: { es: 'Resumen de salud', en: 'Health summary' }, all: { es: 'Todos', en: 'All' },
  scans: { es: 'escaneos', en: 'scans' }, scan: { es: 'escaneo', en: 'scan' }, averageConfidence: { es: 'confianza media', en: 'average confidence' },
  healthy: { es: 'saludable', en: 'healthy' }, fruitStatus: { es: 'Estado de tus frutos', en: 'Your fruit status' },
  resultDistribution: { es: 'Distribución de resultados por cada fruto analizado.', en: 'Result distribution for each analyzed fruit.' },
  volumeByFruit: { es: 'Volumen por fruto', en: 'Volume by fruit' }, currentSelectionScans: { es: 'Cantidad de escaneos en la selección actual.', en: 'Number of scans in the current selection.' },
  readingByFruit: { es: 'Lectura por fruto', en: 'Reading by fruit' }, confidenceAttention: { es: 'Confianza media y resultados que requieren atención.', en: 'Average confidence and results requiring attention.' },
  review: { es: 'Revisión', en: 'Review' }, reviews: { es: 'revisión', en: 'review' },
  recommendedActions: { es: 'Acciones recomendadas', en: 'Recommended actions' },
  firstScanTitle: { es: 'Realiza tu primer escaneo', en: 'Complete your first scan' }, firstScanText: { es: 'Analiza un fruto para recibir acciones personalizadas.', en: 'Analyze a fruit to receive personalized actions.' },
  separateTitle: { es: 'Separa los frutos con hallazgos', en: 'Separate fruit with findings' }, separateText: { es: '{count} análisis requieren revisión antes de mezclarlos con frutos saludables.', en: '{count} analyses require review before mixing them with healthy fruit.' },
  preventiveTitle: { es: 'Mantén el control preventivo', en: 'Maintain preventive control' }, preventiveText: { es: 'Los análisis seleccionados no muestran señales de riesgo.', en: 'The selected analyses show no signs of risk.' },
  repeatTitle: { es: 'Repite los análisis con menor confianza', en: 'Repeat analyses with lower confidence' }, repeatText: { es: 'Una nueva fotografía con luz uniforme puede confirmar el resultado.', en: 'A new photo with even lighting can confirm the result.' },
  documentTitle: { es: 'Documenta la acción aplicada', en: 'Document the action taken' }, documentText: { es: 'Añade una tarea para revisar la evolución del lote durante la semana.', en: 'Add a task to track the batch throughout the week.' },
  addToPlan: { es: 'Añadir al plan de trabajo', en: 'Add to work plan' }, scanFruit: { es: 'Escanear un fruto', en: 'Scan a fruit' },
  analysisHistory: { es: 'Historial de análisis', en: 'Analysis history' }, noRisk: { es: 'Sin señales de riesgo', en: 'No signs of risk' }, reviewRecommended: { es: 'Revisión recomendada', en: 'Review recommended' }, score: { es: 'confianza IA', en: 'AI confidence' }, noScans: { es: 'Aún no tienes escaneos.', en: 'You do not have any scans yet.' },
  organizeWeek: { es: 'Organiza tus acciones de esta semana y da seguimiento a cada lote.', en: 'Organize this week’s actions and track each batch.' },
  previousWeek: { es: 'Semana anterior', en: 'Previous week' }, nextWeek: { es: 'Semana siguiente', en: 'Next week' }, tasksFor: { es: 'Tareas para {date}', en: 'Tasks for {date}' },
  addTask: { es: 'Crear nueva tarea', en: 'Create new task' }, closeForm: { es: 'Cerrar', en: 'Close' },
  today: { es: 'Hoy', en: 'Today' }, nTasks: { es: '{count} tareas', en: '{count} tasks' }, nTask1: { es: '1 tarea', en: '1 task' },
  nPending: { es: '{count} pendientes', en: '{count} pending' }, nDone: { es: '{count} completadas', en: '{count} done' }, nOverdue: { es: '{count} atrasadas', en: '{count} overdue' },
  nPending1: { es: '1 pendiente', en: '1 pending' }, nDone1: { es: '1 completada', en: '1 done' }, nOverdue1: { es: '1 atrasada', en: '1 overdue' },
  dayFree: { es: 'Día libre', en: 'Free day' }, allDone: { es: 'Todo completado', en: 'All done' },
  dayA11y: { es: '{date}: {count}', en: '{date}: {count}' }, createOne: { es: 'Crear una tarea', en: 'Create a task' },
  newTaskTitle: { es: 'Nueva tarea', en: 'New task' }, savingTask: { es: 'Guardando…', en: 'Saving…' },
  statusOverdue: { es: 'Atrasada', en: 'Overdue' }, statusToday: { es: 'Hoy', en: 'Today' }, statusPending: { es: 'Pendiente', en: 'Pending' }, statusDone: { es: 'Completada', en: 'Done' },
  markDone: { es: 'Marcar como completada: {title}', en: 'Mark as done: {title}' }, markPending: { es: 'Marcar como pendiente: {title}', en: 'Mark as pending: {title}' }, scheduledFor: { es: 'Se programará para {date}', en: 'Scheduled for {date}' },
  date: { es: 'Fecha', en: 'Date' }, time: { es: 'Hora', en: 'Time' }, taskSchedule: { es: '{date} a las {time}', en: '{date} at {time}' },
  taskPlaceholder: { es: 'Ej. Revisar caja de mangos', en: 'E.g. Check box of mangoes' }, detailPlaceholder: { es: 'Detalle opcional', en: 'Optional details' }, saveTask: { es: 'Guardar tarea', en: 'Save task' },
  noTasks: { es: 'No hay tareas para este día', en: 'No tasks for this day' }, createAction: { es: 'Selecciona otra fecha o crea una acción nueva.', en: 'Select another date or create a new action.' }, delete: { es: 'Eliminar {title}', en: 'Delete {title}' },
  newScanTask: { es: 'Crear una tarea desde un nuevo escaneo', en: 'Create a task from a new scan' }, goScan: { es: 'Ve a Escanear para empezar.', en: 'Go to Scan to get started.' },
  noChartData: { es: 'Aún no hay datos para graficar.', en: 'There is not enough data to chart yet.' },
  settings: { es: 'Ajustes', en: 'Settings' },
  avgConfidence: { es: 'Confianza media', en: 'Average confidence' }, healthyCap: { es: 'Saludable', en: 'Healthy' }, withProblem: { es: 'Con problema', en: 'With issues' },
  toReview: { es: 'por revisar', en: 'to review' }, noData: { es: 'Sin escaneos en esta selección', en: 'No scans in this selection' },
  allOrchards: { es: 'Todas las huertas', en: 'All orchards' }, pickOrchard: { es: 'Elige una huerta', en: 'Choose an orchard' },
  scansCap: { es: 'Escaneos', en: 'Scans' }, crops: { es: 'Cultivos', en: 'Crops' }, area: { es: 'Superficie', en: 'Area' }, period: { es: 'Periodo', en: 'Period' },
  days: { es: '{count} días', en: '{count} days' }, allTime: { es: 'Todo', en: 'All time' }, allTimeLong: { es: 'Todo el historial', en: 'All history' },
  crop: { es: 'Cultivo', en: 'Crop' }, allCrops: { es: 'Todos', en: 'All' },
  cropStatus: { es: 'Estado de tus cultivos', en: 'Your crop status' }, seeDetail: { es: 'Ver detalle', en: 'See details' },
  nScans: { es: '{count} escaneos', en: '{count} scans' }, nScan1: { es: '1 escaneo', en: '1 scan' },
  healthyPct: { es: 'Saludable {pct}%', en: 'Healthy {pct}%' },
  sources: { es: '{photos} fotos individuales · {walk} de recorridos', en: '{photos} single photos · {walk} from walks' },
  histAll: { es: 'Todas las huertas', en: 'All orchards' }, histNone: { es: 'Sin huerta asignada', en: 'No orchard assigned' },
  histCount: { es: '{count} registros', en: '{count} records' }, histFilterLabel: { es: 'Huerta del historial: {name}', en: 'History orchard: {name}' },
  typePhoto: { es: 'Foto individual', en: 'Single photo' }, typeWalk: { es: 'Recorrido inteligente', en: 'Smart walk' },
  walkStats: { es: '{photos} fotos · {findings} hallazgos', en: '{photos} photos · {findings} findings' },
  walkStatsPending: { es: '{photos} fotos · análisis pendiente', en: '{photos} photos · analysis pending' },
  st_subiendo: { es: 'Subiendo', en: 'Uploading' }, st_pendiente: { es: 'En cola', en: 'Queued' }, st_procesando: { es: 'Analizando', en: 'Analyzing' }, st_listo: { es: 'Listo', en: 'Ready' }, st_error: { es: 'Con error', en: 'Error' },
  emptyOrchardTitle: { es: 'Todavía no hay escaneos en esta huerta', en: 'There are no scans in this orchard yet' },
  emptyOrchardText: { es: 'Comienza a analizar tus cultivos para construir su historial.', en: 'Start analyzing your crops to build its history.' },
  emptyNoneTitle: { es: 'No hay escaneos sin huerta', en: 'There are no scans without an orchard' },
  doScan: { es: 'Realizar escaneo', en: 'Scan now' },
  noOrchardNote: { es: '{count} fotos individuales sin huerta asignada no se incluyen al filtrar por huerta.', en: '{count} single photos without an orchard are excluded when filtering by orchard.' },
  legendHealthy: { es: 'Saludable', en: 'Healthy' }, legendReview: { es: 'Revisar', en: 'Review' }, legendProblem: { es: 'Con problema', en: 'With issue' },
  close: { es: 'Cerrar', en: 'Close' },
  scansTab: { es: 'Escaneos', en: 'Scans' },
  noOrchardOpt: { es: 'Sin huerta asignada', en: 'No orchard assigned' },
  months: { es: '{count} meses', en: '{count} months' }, year: { es: '12 meses', en: '12 months' },
  byOrchard: { es: 'Estado por huerta', en: 'Status by orchard' },
  byOrchardSub: { es: 'Reparto de análisis entre huertas', en: 'How analyses split across orchards' },
  analyses: { es: 'análisis', en: 'analyses' }, other: { es: 'Otras', en: 'Others' },
  topFruits: { es: 'Frutas más analizadas', en: 'Most analyzed fruit' }, topFruitsSub: { es: 'Toca un cultivo para ver el detalle', en: 'Tap a crop to see the details' },
  nAnalyses: { es: '{count} análisis', en: '{count} analyses' }, nAnalysis1: { es: '1 análisis', en: '1 analysis' },
  diseases: { es: 'Enfermedades por fruto', en: 'Diseases by fruit' },
  diseasesSub: { es: 'Diagnósticos por cultivo', en: 'Diagnoses by crop' },
  diseasesDetail: { es: 'Diagnósticos de la IA en {crop}', en: 'AI diagnoses in {crop}' },
  backGeneral: { es: 'Vista general', en: 'Overview' },
  catHealthy: { es: 'Saludable', en: 'Healthy' }, catReview: { es: 'Revisar', en: 'Review' }, catProblem: { es: 'Con problema', en: 'With issue' },
  lowConf: { es: 'Confianza baja (revisar)', en: 'Low confidence (review)' },
  sample: { es: 'n = {count}', en: 'n = {count}' },
  perDay: { es: 'Escaneos por día', en: 'Scans per day' }, perWeek: { es: 'Escaneos por semana', en: 'Scans per week' }, perMonth: { es: 'Escaneos por mes', en: 'Scans per month' },
  trendSub: { es: 'Análisis de IA en el periodo', en: 'AI analyses in the period' },
  weekOf: { es: 'Semana del {date}', en: 'Week of {date}' },
  vsPrev: { es: '{sign}{pct}% vs. periodo anterior', en: '{sign}{pct}% vs. previous period' }, samePrev: { es: 'Igual que el periodo anterior', en: 'Same as previous period' },
  attention: { es: 'Hallazgos que requieren atención', en: 'Findings that need attention' },
  attentionSub: { es: 'Problemas detectados por la IA', en: 'Issues detected by the AI' },
  frequent: { es: 'Más frecuentes', en: 'Most frequent' },
  disclaimer: { es: 'Resultados orientativos de la IA: confírmalos en campo o con un especialista antes de aplicar un tratamiento.', en: 'AI results are indicative: confirm them in the field or with a specialist before applying any treatment.' },
  recSub: { es: 'Sugerencias a partir de tus análisis', en: 'Suggestions based on your analyses' },
  inPlan: { es: 'En tu plan · ver', en: 'In your plan · view' }, saving: { es: 'Guardando…', en: 'Saving…' },
  taskAdded: { es: 'Añadida al plan de trabajo', en: 'Added to your work plan' }, taskError: { es: 'No se pudo guardar la tarea', en: 'Could not save the task' },
  taskCtxOrchard: { es: 'Huerta', en: 'Orchard' },
  back: { es: 'Volver', en: 'Back' }, orchardHint: { es: 'Cambia la huerta del resumen', en: 'Changes the summary orchard' },
  periodHint: { es: 'Cambia el periodo', en: 'Changes the period' },
  errorTitle: { es: 'No pudimos cargar tu actividad', en: 'We could not load your activity' },
  errorText: { es: 'Ocurrió un error al consultar tus análisis. Inténtalo de nuevo.', en: 'Something went wrong while loading your analyses. Please try again.' },
  offlineTitle: { es: 'Sin conexión', en: 'You are offline' },
  offlineText: { es: 'Conéctate a internet para ver tus estadísticas actualizadas.', en: 'Connect to the internet to see your up-to-date statistics.' },
  retry: { es: 'Reintentar', en: 'Retry' },
  noScansTitle: { es: 'Aún no tienes escaneos', en: 'You have no scans yet' },
  emptyNone: { es: 'No hay análisis sin huerta asignada en este periodo', en: 'There are no analyses without an orchard in this period' },
  emptyCropTitle: { es: 'Sin resultados para este cultivo', en: 'No results for this crop' },
  emptyCropText: { es: 'Este cultivo no tiene análisis con la huerta y el periodo elegidos.', en: 'This crop has no analyses for the chosen orchard and period.' },
  clearCrop: { es: 'Ver todos los cultivos', en: 'Show all crops' }, clearFilters: { es: 'Limpiar', en: 'Clear' },
  noOrchardsYet: { es: 'Aún no registras huertas: tus análisis aparecen como «Sin huerta asignada».', en: 'You have no orchards yet: your analyses appear as “No orchard assigned”.' },
  moreOrchards: { es: 'Ver todas las huertas', en: 'See all orchards' },
  partialData: { es: 'Algunos datos no se pudieron actualizar.', en: 'Some data could not be refreshed.' },
  ofAnalyses: { es: 'de los análisis con problema', en: 'of analyses with an issue' },
  nFindings: { es: '{count} hallazgos', en: '{count} findings' }, nFinding1: { es: '1 hallazgo', en: '1 finding' },
  topCrop: { es: 'Cultivo con más hallazgos', en: 'Crop with most findings' },
  lowNote: { es: '{count} análisis con confianza baja no se cuentan aquí (están en «Revisar»).', en: '{count} low-confidence analyses are not counted here (see “Review”).' },
  ofProblems: { es: 'de los problemas', en: 'of issues' },
  noAttention: { es: 'Ningún análisis de esta selección detectó un problema con confianza suficiente.', en: 'No analysis in this selection detected an issue with enough confidence.' },
  emptyPeriod: { es: 'Todavía no hay análisis para este periodo', en: 'There are no analyses for this period yet' },
  emptyOrchard: { es: 'Esta huerta aún no tiene escaneos registrados', en: 'This orchard has no scans yet' },
  notEnough: { es: 'No hay suficientes resultados para esta visualización', en: 'Not enough results for this chart' },
  unitNote: { es: 'Unidad: análisis de IA (cada foto individual o foto analizada de un recorrido cuenta una vez).', en: 'Unit: AI analysis (each single photo or analyzed walk photo counts once).' },
};
/** Primera letra en mayúscula (las clases del modelo llegan en minúsculas). */
const cap = (v: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v);
const normalize = (value = '') => value.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
const healthy = isHealthyLabel;
/** Degradados de las clases de problema en el detalle por cultivo (coral → ámbar → vino). */
const PROBLEM_GRADIENTS = [['#FF8A78', '#E4493B'], ['#FFB06B', '#EE7D2A'], ['#E77A9A', '#C2416A'], ['#C4A1F2', '#8B5CF6'], ['#E0B36A', '#A16207']] as const;
const NO_FRUIT_LABELS = new Set(['ninguno', 'none', 'nofruta', 'no fruta', 'no_fruta']);
const diagnosisName = (label = '') => healthy(label) ? 'Saludable' : label.trim() || 'Sin diagnóstico';
const dateText = (value: string, locale: string) => new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const taskDate = (task: Task) => task.scheduled_at ? dateKey(new Date(task.scheduled_at)) : task.detail?.match(TASK_DATE_PATTERN)?.[1] ?? null;
const visibleTaskDetail = (detail = '') => detail.replace(TASK_DATE_PATTERN, '');

// ───────── Plan de trabajo: estado visual de cada tarea ─────────
// La tabla `tasks` no tiene prioridad ni huerta asociada: el estado se deriva solo de datos reales
// (completada y fecha programada). «Atrasada» = de un día ya pasado y sin completar (franja amarilla).
type TaskStatus = 'overdue' | 'today' | 'pending' | 'done';
const taskStatus = (task: Task, todayKey: string): TaskStatus => {
  if (task.completed) return 'done';
  const key = taskDate(task) ?? todayKey;
  if (key < todayKey) return 'overdue';
  if (key === todayKey) return 'today';
  return 'pending';
};
const TASK_TONE: Record<TaskStatus, { label: string; tile: string; pill: string; ink: string; icon: typeof Circle }> = {
  overdue: { label: 'statusOverdue', tile: '#FDF3C7', pill: '#FDE68A', ink: '#854D0E', icon: AlertCircle },
  today: { label: 'statusToday', tile: '#D7F5EC', pill: '#C8F1E3', ink: '#0F766E', icon: CalendarDays },
  pending: { label: 'statusPending', tile: '#EEF1F4', pill: '#E6EAEE', ink: '#475569', icon: Circle },
  done: { label: 'statusDone', tile: '#DDF7E7', pill: '#CDEFD9', ink: '#15803D', icon: CheckCircle2 },
};
// Entrada de las tarjetas (animate-expo: entrada escalonada corta, ease-out; reacomodo al borrar, ease-in-out).
const TASK_IN = FadeInDown.duration(260).easing(EASE_OUT);
const TASK_REFLOW = LinearTransition.duration(240).easing(EASE_IN_OUT);
const FORM_IN = FadeInDown.duration(220).easing(EASE_OUT);

export default function ResultsScreen() {
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold });
  const { locale, language } = useLanguage();
  const t = useTranslations(translations);
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
  const [scheduledAt, setScheduledAt] = useState(() => {
    const date = new Date();
    date.setMinutes(0, 0, 0);
    date.setHours(date.getHours() + 1);
    return date;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState((new Date().getDay() + 6) % 7);
  // Resumen: hallazgos de recorridos y huertas, con filtros propios (no afectan Historial ni Plan).
  const insets = useSafeAreaInsets();
  const nav = useAvotexTabBarMetrics();
  const reduced = useReducedMotion();
  const [hallazgos, setHallazgos] = useState<HallazgoMapa[]>([]);
  const [orchards, setOrchards] = useState<Orchard[]>([]);
  // Huerta del Resumen: todas, una huerta o sin huerta asignada.
  const [orchardF, setOrchardF] = useState<OrchardFilter>('all');
  const orchardId = orchardF !== 'all' && orchardF !== 'none' ? orchardF : null;
  // Enfermedades por fruto: cultivo abierto en detalle (si no hay filtro de cultivo).
  const [detailCrop, setDetailCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period | null>(null);
  const [picker, setPicker] = useState<'orchard' | 'crop' | 'period' | null>(null);
  // Cambio de sección sin congelar: la pestaña cambia al instante, se muestra el esqueleto y el contenido
  // pesado se dibuja en el siguiente cuadro. El historial se dibuja por partes (25 filas cada vez).
  const [pending, setPending] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(25);
  // Historial: filtro de huerta propio (no modifica registros ni afecta el Resumen).
  const [walks, setWalks] = useState<RecorridoRemoto[]>([]);
  const [histOrchard, setHistOrchard] = useState<OrchardFilter>('all');
  const [histPicker, setHistPicker] = useState(false);
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
  // Estado de la consulta del Resumen: null = bien; 'offline' = sin red; 'error' = falló la consulta principal.
  const [loadError, setLoadError] = useState<null | 'offline' | 'error'>(null);
  const [partial, setPartial] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  useFocusEffect(useCallback(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const email = user.email ?? '';
      let failedSide = false;
      const side = <T,>(p: Promise<T>, fallback: T) => p.catch(() => { failedSide = true; return fallback; });
      const [scanResult, taskResult, hz, orch, walkList] = await Promise.all([
        supabase.from('scans').select('*').eq('user_id', user.uid).order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').eq('user_id', user.uid).order('created_at', { ascending: false }),
        email ? side(listUserHallazgos(email), [] as HallazgoMapa[]) : Promise.resolve([] as HallazgoMapa[]),
        email ? side(listOrchards(email), [] as Orchard[]) : Promise.resolve([] as Orchard[]),
        email ? side(listRemote(email, 300), [] as RecorridoRemoto[]) : Promise.resolve([] as RecorridoRemoto[]),
      ]);
      let offline = false;
      if (scanResult.error || failedSide) {
        try { const net = await Network.getNetworkStateAsync(); offline = net.isConnected === false || net.isInternetReachable === false; } catch { /* sin dato de red */ }
      }
      if (!cancelled) {
        // Si falla una consulta se conservan los datos anteriores (no se muestran ceros ficticios).
        if (!scanResult.error) setScans((scanResult.data ?? []) as Scan[]);
        if (!taskResult.error) setTasks((taskResult.data ?? []) as Task[]);
        if (!failedSide || hz.length) setHallazgos(hz);
        if (!failedSide || orch.length) setOrchards(orch);
        if (!failedSide || walkList.length) setWalks(walkList);
        setLoadError(scanResult.error ? (offline ? 'offline' : 'error') : null);
        setPartial(!scanResult.error && failedSide);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user, reloadKey]));

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
  // ───────── Resumen: un solo conjunto de registros, filtrado igual para todas las métricas ─────────
  const records = useMemo<Rec[]>(() => {
    const cropOf = (f?: string | null) => localizeDomainLabel(f || 'Aguacate', 'es') ?? (f || 'Aguacate');
    const out: Rec[] = [];
    // «ninguno»/«none» es la clase del modelo para «aquí no hay fruto» (processor/nucleo.py): no es una
    // enfermedad ni un resultado de cultivo, así que no entra al Resumen (igual que «no fruta»).
    const noFruit = (label?: string | null) => NO_FRUIT_LABELS.has(normalize(label ?? ''));
    for (const sc of scans) {
      const cat = categoria({ fruto: sc.fruto ?? '', estado: sc.label ?? '', confianza: Number(sc.score) });
      if (cat === 'otro' || noFruit(sc.label)) continue; // "no es fruto": no cuenta como resultado de un cultivo
      out.push({ source: 'foto', crop: cropOf(sc.fruto), cat, conf: Math.max(0, Math.min(1, Number(sc.score) || 0)), date: new Date(sc.created_at).getTime(), huertaId: sc.huerta_id ?? null, label: sc.label ?? '' });
    }
    for (const h of hallazgos) {
      const cat = categoria(h);
      if (cat === 'otro' || noFruit(h.estado)) continue;
      out.push({ source: 'recorrido', crop: cropOf(h.fruto), cat, conf: Math.max(0, Math.min(1, Number(h.confianza) || 0)), date: new Date(h.tomada_at).getTime(), huertaId: h.huerta_id, label: h.estado ?? '' });
    }
    return out;
  }, [scans, hallazgos]);
  // Periodo inicial: 30 días si hay datos recientes; si no, todo el historial (no se muestra un resumen vacío).
  // ── Historial unificado: fotos individuales (scans) y recorridos (recorridos), por su fecha real.
  // Un recorrido es UN registro (sus hallazgos no se cuentan como recorridos aparte).
  const walkCrops = useMemo(() => {
    const m = new Map<string, Set<string>>();
    hallazgos.forEach(h => { if (!m.has(h.recorrido_id)) m.set(h.recorrido_id, new Set()); m.get(h.recorrido_id)!.add(normalize(h.fruto)); });
    return m;
  }, [hallazgos]);
  type HistItem = { kind: 'foto'; key: string; date: number; huertaId: string | null; scan: Scan } | { kind: 'walk'; key: string; date: number; huertaId: string | null; walk: RecorridoRemoto };
  const histByCrop = useMemo<HistItem[]>(() => {
    const photos: HistItem[] = filtered.map((scan, i) => ({ kind: 'foto', key: `f-${scan.id ?? scan.created_at}-${i}`, date: new Date(scan.created_at).getTime(), huertaId: scan.huerta_id ?? null, scan }));
    const walkItems: HistItem[] = walks
      .filter(w => fruit === 'Todos' || walkCrops.get(w.id)?.has(normalize(fruit)))
      .map(w => ({ kind: 'walk', key: `w-${w.id}`, date: new Date(w.iniciado_at || w.created_at).getTime(), huertaId: w.huerta_id ?? null, walk: w }));
    return [...photos, ...walkItems].sort((a, b) => b.date - a.date);
  }, [filtered, walks, fruit, walkCrops]);
  const histCounts = useMemo(() => {
    const byOrchard: Record<string, number> = {};
    let none = 0;
    histByCrop.forEach(it => { if (it.huertaId) byOrchard[it.huertaId] = (byOrchard[it.huertaId] ?? 0) + 1; else none++; });
    return { all: histByCrop.length, none, byOrchard };
  }, [histByCrop]);
  const history = useMemo(() => histByCrop.filter(it => histOrchard === 'all' || (histOrchard === 'none' ? !it.huertaId : it.huertaId === histOrchard)), [histByCrop, histOrchard]);
  const orchardName = useCallback((id: string | null) => (id ? orchards.find(o => o.id === id)?.nombre ?? null : null), [orchards]);
  // Si la huerta elegida ya no existe (se borró), se vuelve a «Todas».
  useEffect(() => {
    if (histOrchard !== 'all' && histOrchard !== 'none' && orchards.length && !orchards.some(o => o.id === histOrchard)) setHistOrchard('all');
  }, [orchards, histOrchard]);
  const histLabel = histOrchard === 'all' ? t('histAll') : histOrchard === 'none' ? t('histNone') : orchardName(histOrchard) ?? t('histAll');

  const effPeriod: Period = period ?? (records.some(r => r.date >= Date.now() - 30 * 86400000) ? 30 : 'all');
  // Registros del periodo (sin filtro de huerta): base de «Estado por huerta».
  const inPeriod = useMemo(() => {
    const since = sinceOf(effPeriod);
    return records.filter(r => r.date >= since);
  }, [records, effPeriod]);
  const scoped = useMemo(() => {
    // Con huerta elegida solo cuentan registros con ese huerta_id; nada sin relación verificable se le atribuye.
    return inPeriod.filter(r => matchOrchard(r, orchardF));
  }, [inPeriod, orchardF]);
  const excludedNoOrchard = useMemo(() => (orchardId ? inPeriod.filter(r => r.source === 'foto' && !r.huertaId).length : 0), [inPeriod, orchardId]);
  const sel = useMemo(() => (crop ? scoped.filter(r => r.crop === crop) : scoped), [scoped, crop]);
  const stat = useMemo(() => {
    const n = sel.length;
    const c = (k: CategoriaHallazgo) => sel.filter(r => r.cat === k).length;
    return {
      n,
      conf: n ? Math.round((sel.reduce((a, r) => a + r.conf, 0) / n) * 100) : null,
      healthy: n ? Math.round((c('sano') / n) * 100) : null,
      problem: n ? Math.round((c('enfermo') / n) * 100) : null,
      review: n ? Math.round((c('revisar') / n) * 100) : null,
      photos: sel.filter(r => r.source === 'foto').length,
      walk: sel.filter(r => r.source === 'recorrido').length,
    };
  }, [sel]);
  const cropOptions = useMemo(() => Array.from(new Set(scoped.map(r => r.crop))).sort(), [scoped]);
  const orchardObj = orchards.find(o => o.id === orchardId) ?? null;
  // Superficie de las huertas del filtro (cada huerta una vez, no por escaneo). «Sin huerta»: no aplica.
  const areaHa = orchardF === 'none' ? 0 : (orchardObj ? orchardObj.area_m2 || 0 : orchards.reduce((a, o) => a + (o.area_m2 || 0), 0)) / 10000;
  const orchardLabel = orchardF === 'none' ? t('noOrchardOpt') : orchardObj?.nombre ?? t('allOrchards');
  const periodLabel = effPeriod === 'all' ? t('allTime') : effPeriod === 180 ? t('months', { count: 6 }) : effPeriod === 365 ? t('year') : t('days', { count: effPeriod });
  const periodLong = effPeriod === 'all' ? t('allTimeLong') : periodLabel;
  const cropName = useCallback((c: string) => localizeDomainLabel(c, language) ?? c, [language]);
  const nA = useCallback((n: number) => (n === 1 ? t('nAnalysis1') : t('nAnalyses', { count: n.toLocaleString(locale) })), [t, locale]);

  // ───────── Gráficas del Resumen (todas desde los mismos registros filtrados) ─────────
  const orchardNames = useMemo(() => Object.fromEntries(orchards.map(o => [o.id, o.nombre])), [orchards]);
  // 1. Estado por huerta: base sin filtro de huerta (es el reparto entre huertas); sí respeta cultivo y periodo.
  const shareSegs = useMemo<ShareSeg[]>(() => {
    const base = crop ? inPeriod.filter(r => r.crop === crop) : inPeriod;
    const sl = orchardShare(base, orchardNames, { none: t('noOrchardOpt'), other: t('other') }, 4);
    let ci = 0;
    return sl.map(x => ({
      key: x.key, name: x.name, count: x.count, pct: x.pct, kind: x.kind,
      colors: x.kind === 'orchard' ? ORCHARD_GRADIENTS[ci++ % ORCHARD_GRADIENTS.length] : x.kind === 'other' ? OTHER_GRADIENT : NONE_GRADIENT,
    }));
  }, [inPeriod, crop, orchardNames, t]);
  const shareSel = orchardF === 'all' ? null : orchardF === 'none' ? '__none' : orchardF;
  const fruitRows = useMemo(() => buildCropRows(scoped).map(r => ({ crop: r.crop, label: cropName(r.crop), count: r.count, pct: r.pct })), [scoped, cropName]);
  const openCrop = crop ?? (detailCrop && scoped.some(r => r.crop === detailCrop) ? detailCrop : null);
  // 3. Enfermedades por fruto: general (un cultivo por fila, tres estados) o detalle (clases del modelo).
  const stackRows = useMemo<StackRow[]>(() => buildCropRows(scoped).slice(0, 6).map(r => ({
    crop: r.crop, label: cropName(r.crop), n: r.count,
    segs: [
      { key: 'sano', pct: (r.sano / r.count) * 100, colors: CAT_GRADIENTS.sano, label: t('catHealthy') },
      { key: 'revisar', pct: (r.revisar / r.count) * 100, colors: CAT_GRADIENTS.revisar, label: t('catReview') },
      { key: 'enfermo', pct: (r.enfermo / r.count) * 100, colors: CAT_GRADIENTS.enfermo, label: t('catProblem') },
    ],
  })), [scoped, cropName, t]);
  const classBars = useMemo<ClassBar[]>(() => {
    if (!openCrop) return [];
    let pi = 0;
    return classRows(scoped, openCrop, normalize).map(r => ({
      key: r.key, pct: r.pct, count: r.count,
      colors: r.healthy ? CAT_GRADIENTS.sano : r.lowConfidence ? CAT_GRADIENTS.revisar : PROBLEM_GRADIENTS[pi++ % PROBLEM_GRADIENTS.length],
      label: r.healthy ? t('catHealthy') : r.lowConfidence ? t('lowConf') : cap(localizeDomainLabel(r.label, language) ?? r.label),
    }));
  }, [openCrop, scoped, language, t]);
  const trend = useMemo(() => {
    const fmtShort = (start: number, g: Granularity) => new Date(start).toLocaleDateString(locale, g === 'month' ? { month: 'short' } : { day: 'numeric', month: 'short' });
    const { g, buckets } = timeline(sel, effPeriod, fmtShort);
    const points: TrendPoint[] = buckets.map(b => ({
      label: b.label, count: b.count,
      long: g === 'month' ? new Date(b.start).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
        : g === 'week' ? t('weekOf', { date: new Date(b.start).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) })
        : new Date(b.start).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }),
    }));
    return { g, points };
  }, [sel, effPeriod, locale, t]);
  const attn = useMemo(() => attention(sel, normalize, 3), [sel]);
  const fmtNum = useCallback((n: number) => n.toLocaleString(locale), [locale]);
  const compare = useCallback((cur: number, prev: number) => {
    if (prev <= 0) return null;
    const d = Math.round(((cur - prev) / prev) * 100);
    return d === 0 ? t('samePrev') : t('vsPrev', { sign: d > 0 ? '+' : '', pct: d });
  }, [t]);
  const cardW = Math.min(width, 1100) - 32;
  const chartW = cardW - 34; // padding 16 + borde 1 por lado
  const enter = (i: number) => (reduced ? undefined : FadeInDown.duration(320).delay(80 + i * 70));
  const tap = () => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); };

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
    if (!validScans.length && !records.length) return [{ title: t('firstScanTitle'), text: t('firstScanText'), tone: 'info' as const }];
    const findings = sel.length ? sel.filter(r => r.cat !== 'sano').length : filtered.length - goodCount;
    const items: Recommendation[] = findings > 0
      ? [{ title: t('separateTitle'), text: t('separateText', { count: findings }), tone: 'warning' as const }]
      : [{ title: t('preventiveTitle'), text: t('preventiveText'), tone: 'positive' as const }];
    if ((stat.conf ?? Math.round(average * 100)) < 80) items.push({ title: t('repeatTitle'), text: t('repeatText'), tone: 'info' as const });
    items.push({ title: t('documentTitle'), text: t('documentText'), tone: 'positive' as const });
    return items;
  }, [average, filtered.length, goodCount, t, validScans.length, sel, stat.conf, records.length]);
  const selectedDateLabel = weekDays[selectedDay]?.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }) ?? '';
  const selectedDateKey = weekDays[selectedDay] ? dateKey(weekDays[selectedDay]) : '';
  const scheduledDateLabel = scheduledAt.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const scheduledTimeLabel = scheduledAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const todayKey = dateKey(new Date());
  useEffect(() => {
    if (!selectedDateKey) return;
    const [year, month, day] = selectedDateKey.split('-').map(Number);
    setScheduledAt(current => new Date(year, month - 1, day, current.getHours(), current.getMinutes()));
  }, [selectedDateKey]);
  const tasksForSelectedDay = useMemo(
    () => tasks.filter(task => taskDate(task) === selectedDateKey || (!taskDate(task) && selectedDateKey === todayKey)),
    [selectedDateKey, tasks, todayKey],
  );
  // Marcas del calendario: tareas por día (total y completadas). Las tareas sin fecha cuentan para hoy,
  // igual que en la lista del día.
  const dayMarks = useMemo(() => {
    const m = new Map<string, { total: number; done: number }>();
    tasks.forEach(task => {
      const k = taskDate(task) ?? todayKey;
      const e = m.get(k) ?? { total: 0, done: 0 };
      e.total++; if (task.completed) e.done++;
      m.set(k, e);
    });
    return m;
  }, [tasks, todayKey]);
  const dayCounts = useMemo(() => {
    const c = { total: tasksForSelectedDay.length, pending: 0, done: 0, overdue: 0 };
    tasksForSelectedDay.forEach(task => {
      const st = taskStatus(task, todayKey);
      if (st === 'done') c.done++; else if (st === 'overdue') c.overdue++; else c.pending++;
    });
    return c;
  }, [tasksForSelectedDay, todayKey]);
  const [savingTask, setSavingTask] = useState(false);

  const addTask = async () => {
    if (!user || !taskTitle.trim() || savingTask) return;
    setSavingTask(true);
    const { data, error } = await supabase.from('tasks').insert({
      title: taskTitle.trim(),
      detail: taskDetail.trim(),
      user_id: user.uid,
      completed: false,
      scheduled_at: scheduledAt.toISOString(),
    }).select().single();
    setSavingTask(false);
    if (error || !data) { Toast.show({ type: 'error', text1: t('taskError') }); return; }
    setTasks(current => [data as Task, ...current]);
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
  // «Añadir al plan de trabajo» desde una recomendación: inserta en la tabla real `tasks` (programada para la
  // próxima hora, como el formulario del plan). Un candado por recomendación evita duplicados por toques
  // repetidos mientras se guarda, y una tarea pendiente con el mismo título cuenta como «ya en el plan».
  // La tabla no tiene huerta ni cultivo: si hay filtros activos se anotan en el detalle de la tarea.
  const savingRef = useRef(new Set<string>());
  const [savingKeys, setSavingKeys] = useState<string[]>([]);
  const planTitles = useMemo(() => new Set(tasks.filter(task => !task.completed).map(task => task.title)), [tasks]);
  const addRecommendation = async (key: string) => {
    const item = recommendations.find(r => r.title === key);
    if (!user || !item || savingRef.current.has(key) || planTitles.has(item.title)) return;
    savingRef.current.add(key);
    setSavingKeys(cur => [...cur, key]);
    const when = new Date();
    when.setMinutes(0, 0, 0);
    when.setHours(when.getHours() + 1);
    const ctx = [orchardF !== 'all' ? `${t('taskCtxOrchard')}: ${orchardLabel}` : null, crop ? `${t('crop')}: ${cropName(crop)}` : null].filter(Boolean).join(' · ');
    try {
      const { data, error } = await supabase.from('tasks').insert({
        title: item.title,
        detail: ctx ? `${item.text}\n${ctx}` : item.text,
        user_id: user.uid,
        completed: false,
        scheduled_at: when.toISOString(),
      }).select().single();
      if (error || !data) throw error ?? new Error('no data');
      setTasks(current => [data as Task, ...current]);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Toast.show({ type: 'success', text1: t('taskAdded'), text2: item.title });
    } catch {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Toast.show({ type: 'error', text1: t('taskError') });
    } finally {
      savingRef.current.delete(key);
      setSavingKeys(cur => cur.filter(k => k !== key));
    }
  };
  const actionItems = useMemo<ActionItem[]>(() => recommendations.map(r => ({
    key: r.title, title: r.title, text: r.text, tone: r.tone,
    state: savingKeys.includes(r.title) ? 'saving' : planTitles.has(r.title) ? 'added' : 'idle',
  })), [recommendations, savingKeys, planTitles]);
  const changeScheduledDate = (_event: DateTimePickerEvent, value?: Date) => {
    setShowDatePicker(false);
    if (!value) return;
    setScheduledAt(current => new Date(value.getFullYear(), value.getMonth(), value.getDate(), current.getHours(), current.getMinutes()));
  };
  const changeScheduledTime = (_event: DateTimePickerEvent, value?: Date) => {
    setShowTimePicker(false);
    if (!value) return;
    setScheduledAt(current => new Date(current.getFullYear(), current.getMonth(), current.getDate(), value.getHours(), value.getMinutes()));
  };
  const requestDate = () => {
    if (Platform.OS !== 'web') return setShowDatePicker(true);
    const value = window.prompt('YYYY-MM-DD', dateKey(scheduledAt));
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const [year, month, day] = value.split('-').map(Number);
    setScheduledAt(current => new Date(year, month - 1, day, current.getHours(), current.getMinutes()));
  };
  const requestTime = () => {
    if (Platform.OS !== 'web') return setShowTimePicker(true);
    const currentTime = `${String(scheduledAt.getHours()).padStart(2, '0')}:${String(scheduledAt.getMinutes()).padStart(2, '0')}`;
    const value = window.prompt('HH:MM', currentTime);
    if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return;
    const [hours, minutes] = value.split(':').map(Number);
    setScheduledAt(current => new Date(current.getFullYear(), current.getMonth(), current.getDate(), hours, minutes));
  };
  const changeSection = (nextSection: Section) => {
    // Antes se llamaba a router.setParams en cada cambio: eso volvía a dibujar toda la navegación de
    // pestañas y congelaba la pantalla unos segundos. El parámetro `view` solo se lee al llegar de fuera.
    setPending(true);
    setSection(nextSection);
    setHistoryLimit(25);
    requestAnimationFrame(() => setTimeout(() => setPending(false), 0));
  };
  const heroW = Math.min(width, 1100) - 32;
  const heroH = Math.round(Math.max(240, Math.min(260, heroW * 0.7)));
  if (!fontsLoaded) return null;
  if (!user) return <View style={styles.center}><Text style={styles.emptyTitle}>{t('loginToSee')}</Text></View>;
  const plan = section === 'plan';
  const summary = section === 'summary';
  // Fondo de cada sección: marfil en Resumen y Plan (la única foto es el encabezado); Historial conserva el blanco.
  const pageBg = summary || plan ? P.ivory : '#FFFFFF';
  const tabItems: TabItem<Section | 'scans'>[] = [
    { key: 'summary', label: t('summary'), Icon: BarChart3 },
    { key: 'scans', label: t('scansTab'), Icon: ScanLine },
    { key: 'history', label: t('history'), Icon: CalendarClock },
    { key: 'plan', label: t('workPlan'), Icon: ClipboardCheck },
  ];
  const pressTab = (key: Section | 'scans') => {
    // «Escaneos» abre Mis escaneos (mapa y recorridos) a pantalla completa; al regresar se vuelve a la
    // sección en la que estabas (la pantalla de Actividad conserva su estado).
    if (key === 'scans') { tap(); router.push({ pathname: '/(app)/escaneos', params: { n: String(Date.now()) } }); return; }
    if (key !== section) { tap(); changeSection(key); }
  };
  const filtersActive = orchardF !== 'all' || crop !== null || period !== null;
  const emptyTitle = records.length === 0 ? t('noScansTitle') : orchardF === 'none' ? t('emptyNone') : orchardId ? t('emptyOrchard') : t('emptyPeriod');
  // Espacio final para que lo último quede por encima de la barra de navegación y del aguacate.
  const bottomPad = nav.clearTop + 32;

  return (
    <KeyboardAvoidingView style={[styles.screen, (summary || plan) && { backgroundColor: P.ivory }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: t('activity') }} />
      <ScrollView
        {...noOverscroll}
        contentContainerStyle={[styles.content, tablet && styles.contentTablet, { backgroundColor: pageBg }, { paddingBottom: bottomPad }]}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={200}
        onScroll={e => {
          // Historial: al acercarse al final se dibujan 25 filas más.
          if (section !== 'history' || historyLimit >= filtered.length) return;
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 600) setHistoryLimit(n => n + 25);
        }}
      >
        {/* Encabezado fotográfico (foto + capa verde + fundido al fondo) con el selector montado encima. */}
        <ActividadHeader topInset={insets.top} title={t('activity')} subtitle={t('clearDecisions')} fadeTo={pageBg}
          onSettings={() => { tap(); router.navigate('/(app)/settings'); }} settingsLabel={t('settings')}
          onBack={() => { tap(); if (router.canGoBack()) router.back(); else router.navigate('/(app)'); }} backLabel={t('back')}>
          <ActividadTabs items={tabItems} active={section} onPress={pressTab} />
        </ActividadHeader>
        <View style={{ height: 16 }} />
        {loading || pending ? <SectionSkeleton kind={section} heroH={heroH} /> : summary ? (
          <Reanimated.View entering={reduced ? undefined : FadeIn.duration(200)}>
            {loadError && records.length === 0 ? (
              // Error de consulta o sin conexión: no se muestran estadísticas ficticias.
              <View style={styles.cards}>
                <ChartCard icon={loadError === 'offline' ? <WifiOff size={19} color={P.coral} /> : <AlertTriangle size={19} color={P.coral} />} iconBg="#FDE7E1"
                  title={loadError === 'offline' ? t('offlineTitle') : t('errorTitle')}
                  decorations={[{ variant: 'leaf', corner: 'tr', size: 86, opacity: 0.22 }]}>
                  <Text style={[styles.body, { fontSize: 13, marginBottom: 14 }]}>{loadError === 'offline' ? t('offlineText') : t('errorText')}</Text>
                  <PressableScale onPress={() => { tap(); setReloadKey(k => k + 1); }} style={sm.retry} accessibilityRole="button">
                    <RefreshCw size={16} color="#FFFFFF" /><Text style={sm.retryText}>{t('retry')}</Text>
                  </PressableScale>
                </ChartCard>
              </View>
            ) : (
            <>
            <View style={{ paddingHorizontal: 16 }}>
              <ConfidenceHero
                width={heroW} height={heroH}
                confidence={stat.conf} healthy={stat.healthy} problem={stat.problem} review={stat.review}
                orchardLabel={orchardLabel}
                onOrchard={() => { tap(); setPicker('orchard'); }}
                labels={{ confidence: t('avgConfidence'), healthy: t('healthyCap'), problem: t('withProblem'), review: t('toReview'), empty: t('noData'), orchardHint: t('orchardHint') }}
                reduced={reduced}
              />
            </View>

            {/* Métricas rápidas (datos reales de la selección) */}
            <Reanimated.View entering={enter(0)} style={{ marginHorizontal: 16, marginTop: 14 }}>
              <QuickMetrics items={[
                { key: 'scans', Icon: Layers, value: stat.n.toLocaleString(locale), label: t('scansCap') },
                { key: 'crops', Icon: Sprout, value: String(new Set(sel.map(r => r.crop)).size), label: t('crops') },
                { key: 'area', Icon: MapIcon, value: areaHa > 0 ? `${areaHa.toFixed(2)} ha` : '—', label: t('area') },
                { key: 'period', Icon: CalendarIcon, value: periodLabel, label: t('period'), onPress: () => { tap(); setPicker('period'); }, hint: t('periodHint') },
              ]} />
            </Reanimated.View>
            {stat.n > 0 && <Text style={styles.sources}>{t('sources', { photos: stat.photos, walk: stat.walk })}</Text>}
            {excludedNoOrchard > 0 && <Text style={styles.sources}>{t('noOrchardNote', { count: excludedNoOrchard })}</Text>}
            {(partial || (loadError && records.length > 0)) && <Text style={[styles.sources, { color: '#A0522D' }]}>{loadError === 'offline' ? t('offlineText') : t('partialData')}</Text>}

            {/* Filtros secundarios: la huerta se elige en el hero (mismo estado: orchardF). */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              <Pressable onPress={() => { tap(); setPicker('crop'); }} accessibilityRole="button" style={({ pressed }) => [styles.filterPill, crop && styles.filterPillOn, pressed && { transform: [{ scale: 0.97 }] }]}>
                <Sprout size={15} color={crop ? P.deep : P.agri} />
                <Text style={[styles.filterText, crop && styles.filterTextOn]} numberOfLines={1}>{t('crop')}: {crop ? cropName(crop) : t('allCrops')}</Text>
                <ChevronDown size={15} color={P.deep} />
              </Pressable>
              <Pressable onPress={() => { tap(); setPicker('period'); }} accessibilityRole="button" style={({ pressed }) => [styles.filterPill, period !== null && styles.filterPillOn, pressed && { transform: [{ scale: 0.97 }] }]}>
                <CalendarIcon size={15} color={period !== null ? P.deep : P.agri} />
                <Text style={[styles.filterText, period !== null && styles.filterTextOn]} numberOfLines={1}>{t('period')}: {periodLong}</Text>
                <ChevronDown size={15} color={P.deep} />
              </Pressable>
              {filtersActive && (
                <Pressable onPress={() => { tap(); setOrchardF('all'); setCrop(null); setPeriod(null); setDetailCrop(null); }} accessibilityRole="button"
                  style={({ pressed }) => [styles.filterPill, styles.filterClear, pressed && { transform: [{ scale: 0.97 }] }]}>
                  <X size={14} color={P.muted} /><Text style={[styles.filterText, { color: P.muted }]}>{t('clearFilters')}</Text>
                </Pressable>
              )}
            </ScrollView>

            {scoped.length === 0 ? (
              <Reanimated.View entering={enter(1)} style={styles.cards}>
                <ChartCard icon={<ScanLine size={19} color={P.agri} />} title={emptyTitle}
                  decorations={[{ variant: 'leaf', corner: 'tr', size: 92, opacity: 0.3 }, { variant: 'fern', corner: 'bl', size: 84, opacity: 0.16 }]}>
                  <Text style={[styles.body, { fontSize: 13, marginBottom: 14 }]}>{t('emptyOrchardText')}</Text>
                  <PressableScale onPress={() => router.navigate('/(app)/scan')} style={sm.retry} accessibilityRole="button">
                    <ScanLine size={17} color={P.lime} /><Text style={sm.retryText}>{t('doScan')}</Text>
                  </PressableScale>
                </ChartCard>
              </Reanimated.View>
            ) : sel.length === 0 ? (
              // Cultivo elegido sin análisis en la huerta/periodo actuales.
              <Reanimated.View entering={enter(1)} style={styles.cards}>
                <ChartCard icon={<Sprout size={19} color={P.agri} />} title={t('emptyCropTitle')}>
                  <Text style={[styles.body, { fontSize: 13, marginBottom: 14 }]}>{t('emptyCropText')}</Text>
                  <PressableScale onPress={() => { tap(); setCrop(null); }} style={sm.retry} accessibilityRole="button">
                    <Text style={sm.retryText}>{t('clearCrop')}</Text>
                  </PressableScale>
                </ChartCard>
              </Reanimated.View>
            ) : (
              // UNA SOLA COLUMNA: cada tarjeta ocupa todo el ancho disponible.
              <View style={styles.cards}>
                {/* 1. Estado por huerta: barra segmentada */}
                <Reanimated.View entering={enter(1)}>
                  <ChartCard icon={<MapIcon size={19} color={P.agri} />} title={t('byOrchard')} subtitle={t('byOrchardSub')}
                    onMore={() => { tap(); setPicker('orchard'); }} moreLabel={t('moreOrchards')}
                    decorations={[{ variant: 'leaf', corner: 'tr', size: 78, opacity: 0.16 }]}>
                    {shareSegs.length ? (
                      <OrchardShareBar segs={shareSegs} selected={shareSel} reduced={reduced} countLabel={nA}
                        onSelect={seg => {
                          tap();
                          if (seg.kind === 'other') { setPicker('orchard'); return; }
                          const next: OrchardFilter = seg.kind === 'none' ? 'none' : seg.key;
                          setOrchardF(f => (f === next ? 'all' : next));
                        }} />
                    ) : <EmptyChart text={t('notEnough')} />}
                    {orchards.length === 0 && <Text style={sm.note}>{t('noOrchardsYet')}</Text>}
                  </ChartCard>
                </Reanimated.View>

                {/* 2. Frutas más analizadas: barras volumétricas */}
                <Reanimated.View entering={enter(2)}>
                  <ChartCard icon={<Sprout size={19} color={P.agri} />} title={t('topFruits')} subtitle={t('topFruitsSub')}
                    onMore={() => { tap(); setPicker('crop'); }} moreLabel={t('crop')}
                    decorations={[{ variant: 'sprig', corner: 'br', size: 80, opacity: 0.14 }]}>
                    <FruitBars rows={fruitRows} selected={crop} reduced={reduced} countLabel={nA}
                      onSelect={c => { tap(); setCrop(cur => (cur === c ? null : c)); setDetailCrop(null); }} />
                  </ChartCard>
                </Reanimated.View>

                {/* 3. Enfermedades por fruto: barras apiladas (general → detalle por cultivo) */}
                <Reanimated.View entering={enter(3)}>
                  <ChartCard icon={<Microscope size={19} color={P.agri} />} title={t('diseases')}
                    subtitle={openCrop ? t('diseasesDetail', { crop: cropName(openCrop) }) : t('diseasesSub')}
                    onMore={openCrop ? undefined : () => { tap(); if (stackRows[0]) setDetailCrop(stackRows[0].crop); }} moreLabel={t('seeDetail')}
                    decorations={[{ variant: 'leaf', corner: 'tr', size: 72, opacity: 0.14, rotate: 15 }]}>
                    {openCrop && !crop && (
                      <Pressable onPress={() => { tap(); setDetailCrop(null); }} accessibilityRole="button" style={styles.backChip}>
                        <ChevronLeft size={14} color={P.agri} /><Text style={styles.backChipText}>{t('backGeneral')}</Text>
                      </Pressable>
                    )}
                    {openCrop ? (
                      classBars.length ? <ClassBars rows={classBars} reduced={reduced} countLabel={nA} /> : <EmptyChart text={t('notEnough')} />
                    ) : stackRows.length ? (
                      <>
                        <StatusStackBars rows={stackRows} reduced={reduced} onPick={c => { tap(); setDetailCrop(c); }}
                          a11yLabel={row => `${row.label}: ${row.segs.map(sg => `${sg.label} ${Math.round(sg.pct)} %`).join(', ')}. ${nA(row.n)}`} />
                        <View style={sm.legend}>
                          {([['sano', t('legendHealthy')], ['revisar', t('legendReview')], ['enfermo', t('legendProblem')]] as const).map(([k, label]) => (
                            <View key={k} style={sm.legendItem}>
                              <View style={[sm.legendDot, { backgroundColor: CAT_GRADIENTS[k][1] }]} />
                              <Text style={sm.legendText}>{label}</Text>
                            </View>
                          ))}
                        </View>
                      </>
                    ) : <EmptyChart text={t('notEnough')} />}
                  </ChartCard>
                </Reanimated.View>

                {/* 4. Escaneos por semana (o día/mes según el periodo): línea con degradado y tooltip */}
                <Reanimated.View entering={enter(4)}>
                  <ChartCard icon={<TrendingUp size={19} color={P.agri} />} title={trend.g === 'day' ? t('perDay') : trend.g === 'week' ? t('perWeek') : t('perMonth')} subtitle={t('trendSub')}
                    decorations={[{ variant: 'leaf', corner: 'tr', size: 66, opacity: 0.12, rotate: 20 }]}>
                    {trend.points.length >= 2 ? (
                      <TrendLine points={trend.points} width={chartW} reduced={reduced} fmt={fmtNum} compareLabel={compare} />
                    ) : <EmptyChart text={t('notEnough')} />}
                  </ChartCard>
                </Reanimated.View>

                {/* 5. Hallazgos que requieren atención (tarjeta destacada, acentos coral) */}
                <Reanimated.View entering={enter(5)}>
                  <ChartCard icon={<AlertTriangle size={19} color={P.coral} />} iconBg="#FDE7E1" title={t('attention')} subtitle={t('attentionSub')}
                    tint="#FFFBF5" style={sm.attention} onMore={() => { tap(); changeSection('history'); }} moreLabel={t('seeDetail')}
                    decorations={[{ variant: 'leaf', corner: 'tr', size: 80, opacity: 0.14, color: '#E07A5F' }]}>
                    {attn.total > 0 ? (
                      <AttentionPanel pct={attn.pct} total={attn.total} reduced={reduced}
                        top={attn.top.map(x => ({ ...x, label: cap(localizeDomainLabel(x.label, language) ?? x.label) }))}
                        topCrop={attn.topCrop ? { label: cropName(attn.topCrop.crop), count: attn.topCrop.count } : null}
                        lowConfidence={attn.lowConfidence}
                        onOpen={() => { tap(); changeSection('history'); }}
                        labels={{
                          ofAnalyses: t('ofAnalyses'), findings: n => (n === 1 ? t('nFinding1') : t('nFindings', { count: n })),
                          topCrop: t('topCrop'), low: n => t('lowNote', { count: n }), ofProblems: t('ofProblems'),
                          frequent: t('frequent'), disclaimer: t('disclaimer'),
                        }} />
                    ) : <EmptyChart text={t('noAttention')} />}
                  </ChartCard>
                </Reanimated.View>
                <Text style={styles.unitNote}>{t('unitNote')}</Text>
              </View>
            )}

            {/* 6. Acciones recomendadas (última tarjeta de la columna) */}
            <Reanimated.View entering={enter(6)} style={{ marginHorizontal: 16, marginTop: 14 }}>
              <RecommendedActions title={t('recommendedActions')} subtitle={t('recSub')} items={actionItems}
                onAdd={key => { tap(); addRecommendation(key); }}
                onOpenPlan={() => { tap(); changeSection('plan'); }}
                labels={{ add: t('addToPlan'), added: t('inPlan'), saving: t('saving') }} />
            </Reanimated.View>
            </>
            )}

            {/* CTA existente «Escanear un fruto», con la paleta verde bosque + lima */}
            <PressableScale onPress={() => router.push('/(app)/scan')} style={sm.ctaWrap} accessibilityRole="button" accessibilityLabel={t('scanFruit')}>
              <LinearGradient colors={['#1D8E42', P.deep, P.forest]} locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={sm.cta}>
                <View style={sm.ctaIcon}><ScanLine size={19} color={P.forest} strokeWidth={2.4} /></View>
                <Text style={sm.ctaText}>{t('scanFruit')}</Text>
              </LinearGradient>
            </PressableScale>
          </Reanimated.View>
        ) : section === 'history' ? (
           <View>
             <Text style={styles.heading}>{t('analysisHistory')}</Text>
             {/* Huerta del historial (filtra, no modifica registros) */}
             <Pressable onPress={() => setHistPicker(true)} accessibilityRole="button" accessibilityLabel={`${t('histFilterLabel', { name: histLabel })}. ${t('histCount', { count: history.length })}`}
               style={({ pressed }) => [styles.histSelector, pressed && { transform: [{ scale: 0.98 }] }]}>
               <View style={styles.histSelectorIcon}>{histOrchard === 'none' ? <Unlink size={17} color="#BE123C" /> : <Sprout size={18} color="#0D756B" />}</View>
               <Text style={styles.histSelectorText} numberOfLines={1}>{histLabel}</Text>
               <View style={styles.histSelectorCount}><Text style={styles.histSelectorCountText}>{history.length}</Text></View>
               <ChevronDown size={18} color="#475569" />
             </Pressable>
             <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{fruits.map(item => <TouchableOpacity key={item} onPress={() => { setFruit(item); setHistoryLimit(25); }} style={[styles.chip, fruit === item && { backgroundColor: colors.primary }]}><Text style={[styles.chipText, fruit === item && styles.chipTextActive]}>{item === 'Todos' ? t('all') : localizeDomainLabel(item, language)}</Text></TouchableOpacity>)}</ScrollView>
             {history.length ? history.slice(0, historyLimit).map(item => {
               const place = orchardName(item.huertaId);
               if (item.kind === 'walk') {
                 const w = item.walk;
                 const ready = w.estado === 'listo';
                 return (
                   <TouchableOpacity key={item.key} style={styles.scanRow} onPress={() => router.push({ pathname: '/(app)/escaneos', params: { focus: w.id, n: String(Date.now()) } })}
                     accessibilityRole="button" accessibilityLabel={`${t('typeWalk')}, ${dateText(new Date(item.date).toISOString(), locale)}`}>
                     <View style={[styles.scanImage, styles.walkIcon]}><Footprints size={22} color="#0D756B" /></View>
                     <View style={styles.scanInfo}>
                       <Text style={styles.typeTag}>{t('typeWalk')}</Text>
                       <Text style={styles.headingSmall} numberOfLines={1}>{t(`st_${w.estado}` as 'st_listo')}</Text>
                       <Text style={styles.scanDiagnosis} numberOfLines={1}>{ready ? t('walkStats', { photos: w.fotos_total ?? 0, findings: w.hallazgos_total ?? 0 }) : t('walkStatsPending', { photos: w.fotos_total ?? 0 })}</Text>
                       <Text style={styles.muted} numberOfLines={1}>{dateText(new Date(item.date).toISOString(), locale)}</Text>
                       {place ? <Text style={styles.placeText} numberOfLines={1}>{place}</Text> : null}
                     </View>
                     <ChevronRight size={16} color="#94A3B8" />
                   </TouchableOpacity>
                 );
               }
               const scan = item.scan;
               const isHealthy = healthy(scan.label);
               const score = Math.max(0, Math.min(1, Number(scan.score) || 0));
               return (
                 <TouchableOpacity key={item.key} style={styles.scanRow} onPress={() => setExpanded(expanded === scan.id ? null : scan.id)}>
                   <Image source={fruitImage(scan.fruto, isHealthy)} style={styles.scanImage} />
                   <View style={styles.scanInfo}>
                     <Text style={styles.typeTag}>{t('typePhoto')}</Text>
                     <Text style={styles.headingSmall}>{localizeDomainLabel(scan.fruto || 'Aguacate', language)}</Text>
                     <Text numberOfLines={1} style={[styles.scanDiagnosis, { color: isHealthy ? '#3BAE72' : colors.danger }]}>{localizeDomainLabel(scan.label, language)}</Text>
                     <Text style={styles.muted} numberOfLines={1}>{dateText(scan.created_at, locale)}</Text>
                     {place ? <Text style={styles.placeText} numberOfLines={1}>{place}</Text> : null}
                     {expanded === scan.id && <Text style={styles.detail}>{isHealthy ? t('noRisk') : t('reviewRecommended')}</Text>}
                   </View>
                   <View style={styles.scanSparkline}>{[0.62, 0.8, 0.7, 0.92, 0.76, 1].map((factor, barIndex) => <View key={barIndex} style={[styles.scanSparkBar, { height: Math.max(5, Math.min(28, score * factor * 28)), backgroundColor: isHealthy ? colors.primary : colors.danger }]} />)}</View>
                   <View style={styles.scanScoreColumn}><Text style={styles.scanScoreValue}>{Math.round(score * 100)}%</Text><Text style={[styles.scanScoreCaption, { color: isHealthy ? '#3BAE72' : colors.danger }]}>{t('score')}</Text></View>
                   <ChevronDown size={15} color="#94A3B8" />
                 </TouchableOpacity>
               );
             }) : histOrchard === 'all' ? <Empty text={t('noScans')} /> : (
               <View style={styles.histEmpty}>
                 <View style={styles.histEmptyIcon}>{histOrchard === 'none' ? <Unlink size={26} color="#BE123C" /> : <Sprout size={28} color="#0D756B" />}</View>
                 <Text style={styles.emptyTitle}>{histOrchard === 'none' ? t('emptyNoneTitle') : t('emptyOrchardTitle')}</Text>
                 <Text style={[styles.body, { textAlign: 'center' }]}>{t('emptyOrchardText')}</Text>
                 <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary, alignSelf: 'stretch' }]} onPress={() => router.navigate('/(app)/scan')}>
                   <ScanLine size={18} color="#fff" /><Text style={styles.buttonText}>{t('doScan')}</Text>
                 </TouchableOpacity>
               </View>
             )}
             {history.length > historyLimit && <ActivityIndicator color={colors.primary} style={{ marginVertical: 18 }} />}
             <OrchardFilterSheet visible={histPicker} value={histOrchard} orchards={orchards} counts={histCounts}
               onChange={v => { setHistOrchard(v); setHistoryLimit(25); }} onClose={() => setHistPicker(false)} />
           </View>
        ) : (
           <View>
             {/* Plan de trabajo sobre fondo marfil limpio: la única fotografía es el encabezado de Actividad. */}
             <PlanIntro title={t('workPlan')} subtitle={t('organizeWeek')} />
             <WeekCalendar
               days={weekDays} selected={selectedDay} onSelect={i => { tap(); setSelectedDay(i); }}
               monthLabel={cap(weekDays[0].toLocaleDateString(locale, { month: 'long', year: 'numeric' }))}
               onPrev={() => { tap(); setWeekOffset(v => v - 1); }} onNext={() => { tap(); setWeekOffset(v => v + 1); }}
               onToday={weekOffset !== 0 ? () => { tap(); setWeekOffset(0); setSelectedDay((new Date().getDay() + 6) % 7); } : undefined}
               todayKey={todayKey} marks={dayMarks} keyOf={dateKey}
               weekdayOf={d => d.toLocaleDateString(locale, { weekday: 'narrow' })}
               labels={{
                 prev: t('previousWeek'), next: t('nextWeek'), today: t('today'),
                 day: (d, mark) => t('dayA11y', { date: d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }), count: !mark?.total ? t('noTasks') : mark.total === 1 ? t('nTask1') : t('nTasks', { count: mark.total }) }),
               }}
             />
             <DaySummary title={t('tasksFor', { date: selectedDateLabel })} counts={dayCounts}
               labels={{
                 tasks: n => (n === 1 ? t('nTask1') : t('nTasks', { count: n })),
                 pending: n => (n === 1 ? t('nPending1') : t('nPending', { count: n })), done: n => (n === 1 ? t('nDone1') : t('nDone', { count: n })),
                 overdue: n => (n === 1 ? t('nOverdue1') : t('nOverdue', { count: n })),
                 free: t('dayFree'), allDone: t('allDone'),
               }} />
             <View style={{ height: 12 }} />
             {tasksForSelectedDay.length ? tasksForSelectedDay.map((task, index) => {
               const when = task.scheduled_at ? new Date(task.scheduled_at) : null;
               const status = taskStatus(task, todayKey);
               return (
                 <Reanimated.View key={`${task.id}-${index}`} entering={reduced ? undefined : TASK_IN.delay(Math.min(index, 6) * 45)} layout={reduced ? undefined : TASK_REFLOW}>
                   <TaskCard title={task.title} detail={visibleTaskDetail(task.detail)} completed={task.completed}
                     time={when ? when.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : null}
                     status={status} statusLabel={t(TASK_TONE[status].label)}
                     onToggle={() => { tap(); updateTask(task); }} onDelete={() => { tap(); deleteTask(task.id); }}
                     labels={{
                       toggle: task.completed ? t('markPending', { title: task.title }) : t('markDone', { title: task.title }),
                       remove: t('delete', { title: task.title }),
                     }} />
                 </Reanimated.View>
               );
             }) : (
               <EmptyDay title={t('noTasks')} body={t('createAction')} action={t('createOne')} onAction={() => { tap(); setShowForm(true); }} />
             )}
             <PressableScale onPress={() => { tap(); setShowForm(value => !value); }} style={sm.ctaWrap} accessibilityRole="button" accessibilityState={{ expanded: showForm }}>
               <LinearGradient colors={['#1D8E42', P.deep, P.forest]} locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={sm.cta}>
                 <View style={sm.ctaIcon}>{showForm ? <X size={19} color={P.forest} strokeWidth={2.6} /> : <Plus size={20} color={P.forest} strokeWidth={2.8} />}</View>
                 <Text style={sm.ctaText}>{showForm ? t('closeForm') : t('addTask')}</Text>
               </LinearGradient>
             </PressableScale>
             {showForm && (
               <Reanimated.View entering={reduced ? undefined : FORM_IN} style={pl.form}>
                 <Text style={pl.formTitle}>{t('newTaskTitle')}</Text>
                 <Text style={styles.formDate}>{t('scheduledFor', { date: scheduledDateLabel })}</Text>
                 <View style={styles.scheduleFields}>
                   <TouchableOpacity style={[styles.scheduleField, pl.field]} onPress={requestDate}>
                     <CalendarDays size={17} color={P.agri} />
                     <View><Text style={styles.scheduleFieldLabel}>{t('date')}</Text><Text style={styles.scheduleFieldValue}>{scheduledDateLabel}</Text></View>
                   </TouchableOpacity>
                   <TouchableOpacity style={[styles.scheduleField, pl.field]} onPress={requestTime}>
                     <Clock size={17} color={P.agri} />
                     <View><Text style={styles.scheduleFieldLabel}>{t('time')}</Text><Text style={styles.scheduleFieldValue}>{scheduledTimeLabel}</Text></View>
                   </TouchableOpacity>
                 </View>
                 {showDatePicker && Platform.OS !== 'web' && <DateTimePicker value={scheduledAt} mode="date" onChange={changeScheduledDate} />}
                 {showTimePicker && Platform.OS !== 'web' && <DateTimePicker value={scheduledAt} mode="time" onChange={changeScheduledTime} />}
                 <TextInput value={taskTitle} onChangeText={setTaskTitle} placeholder={t('taskPlaceholder')} style={[styles.input, pl.input]} placeholderTextColor="#8A9A90" />
                 <TextInput value={taskDetail} onChangeText={setTaskDetail} placeholder={t('detailPlaceholder')} style={[styles.input, pl.input]} placeholderTextColor="#8A9A90" multiline />
                 <PressableScale onPress={addTask} disabled={!taskTitle.trim() || savingTask} accessibilityRole="button" accessibilityState={{ disabled: !taskTitle.trim() || savingTask, busy: savingTask }}
                   style={[pl.save, (!taskTitle.trim() || savingTask) && { opacity: 0.5 }]}>
                   {savingTask ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Check size={17} color="#FFFFFF" strokeWidth={2.6} />}
                   <Text style={pl.saveText}>{savingTask ? t('savingTask') : t('saveTask')}</Text>
                 </PressableScale>
               </Reanimated.View>
             )}
             <TouchableOpacity style={pl.scanLink} onPress={() => router.push('/(app)/scan')}>
               <ScanLine size={16} color={P.agri} /><Text style={pl.scanLinkText}>{t('newScanTask')}</Text>
             </TouchableOpacity>
           </View>
        )}
      </ScrollView>

      {/* Selectores del Resumen: huerta, cultivo y periodo */}
      <Modal visible={picker !== null} transparent animationType={reduced ? 'fade' : 'slide'} onRequestClose={() => setPicker(null)} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={() => setPicker(null)} accessibilityLabel={t('close')} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }, tablet && { left: '20%', right: '20%' }]}>
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sectionTitle}>{picker === 'orchard' ? t('pickOrchard') : picker === 'crop' ? t('crop') : t('period')}</Text>
            <Pressable onPress={() => setPicker(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')} style={styles.closeRound}><X size={17} color="#64748B" /></Pressable>
          </View>
          <ScrollView style={{ maxHeight: 420 }}>
            {picker === 'orchard' && [{ id: 'all' as OrchardFilter, name: t('allOrchards'), ha: orchards.reduce((a, o) => a + (o.area_m2 || 0), 0) / 10000 },
              ...orchards.map(o => ({ id: o.id as OrchardFilter, name: o.nombre, ha: (o.area_m2 || 0) / 10000 })),
              { id: 'none' as OrchardFilter, name: t('noOrchardOpt'), ha: 0 }].map(o => (
              <PickRow key={o.id} on={orchardF === o.id} title={o.name} meta={o.ha > 0 ? `${o.ha.toFixed(2)} ha` : ''}
                onPress={() => { tap(); setOrchardF(o.id); setPicker(null); }} />
            ))}
            {picker === 'crop' && [null, ...cropOptions].map(c => (
              <PickRow key={c ?? 'all'} on={crop === c} title={c ? cropName(c) : t('allCrops')}
                meta={c ? (() => { const n = scoped.filter(r => r.crop === c).length; return n === 1 ? t('nScan1') : t('nScans', { count: n }); })() : ''}
                onPress={() => { tap(); setCrop(c); setPicker(null); }} />
            ))}
            {picker === 'period' && ([7, 30, 90, 180, 365, 'all'] as Period[]).map(pv => (
              <PickRow key={String(pv)} on={effPeriod === pv} title={pv === 'all' ? t('allTimeLong') : pv === 180 ? t('months', { count: 6 }) : pv === 365 ? t('year') : t('days', { count: pv })} meta=""
                onPress={() => { tap(); setPeriod(pv); setPicker(null); }} />
            ))}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
function PickRow({ on, title, meta, onPress }: { on: boolean; title: string; meta: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={({ pressed }) => [styles.pickRow, on && styles.pickRowOn, pressed && { opacity: 0.85 }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.pickTitle} numberOfLines={1}>{title}</Text>
        {meta ? <Text style={styles.muted}>{meta}</Text> : null}
      </View>
      {on && <Check size={18} color="#15803D" />}
    </Pressable>
  );
}
function Metric({ value, label }: { value: string; label: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.muted}>{label}</Text></View>; }
function Empty({ text }: { text: string }) { const t = useTranslations(translations); return <View style={styles.empty}><Text style={styles.emptyTitle}>{text}</Text><Text style={styles.muted}>{t('goScan')}</Text></View>; }
// Resumen (rediseño verde bosque + lima): estilos propios de la sección.
const sm = StyleSheet.create({
  note: { marginTop: 10, fontFamily: 'Poppins_400Regular', fontSize: 11.5, lineHeight: 16, color: '#65746D' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 16, rowGap: 4, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: '#102D22' },
  attention: { borderColor: '#F6DDD5' },
  retry: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 18, borderRadius: 22,
    backgroundColor: '#064B2C', borderWidth: 1, borderColor: 'rgba(185,246,47,0.5)',
  },
  retryText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: '#FFFFFF' },
  ctaWrap: { marginHorizontal: 16, marginTop: 18 },
  cta: {
    minHeight: 58, borderRadius: 29, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    borderWidth: 1.5, borderColor: 'rgba(185,246,47,0.7)',
    shadowColor: '#06301B', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  ctaIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#B9F62F' },
  ctaText: { fontFamily: 'Poppins_700Bold', fontSize: 16, color: '#FFFFFF', letterSpacing: -0.2 },
});

// Plan de trabajo: formulario y enlace (el resto vive en components/actividad/WorkPlanParts.tsx).
const pl = StyleSheet.create({
  form: {
    marginHorizontal: 16, marginTop: 12, padding: 16, gap: 10, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EDF1E6',
    shadowColor: '#1C3A26', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  formTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: '#102D22' },
  field: { backgroundColor: '#FAFBF5', borderColor: '#DCE8D2', borderRadius: 14 },
  input: { backgroundColor: '#FAFBF5', borderColor: '#DCE8D2', borderRadius: 14, color: '#102D22', fontSize: 13.5 },
  save: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: '#17843A' },
  saveText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: '#FFFFFF' },
  scanLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18, marginHorizontal: 20, paddingVertical: 6 },
  scanLinkText: { color: '#17843A', fontFamily: 'Poppins_600SemiBold', fontSize: 13 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' }, content: { paddingBottom: 120, backgroundColor: '#FFFFFF' }, contentTablet: { maxWidth: 1100, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 6, backgroundColor: '#FFFFFF' },
  title: { color: '#0F172A', fontFamily: 'Poppins_700Bold', fontSize: 28, lineHeight: 34, letterSpacing: -0.8 },
  subtitle: { color: '#64748B', fontFamily: 'Poppins_400Regular', fontSize: 13 },
  gear: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EDF0EE', shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  navigator: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, marginBottom: 14, padding: 4, borderRadius: 18, backgroundColor: '#F1F6F3', gap: 4 },
  navItem: { flex: 1, minHeight: 44, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 6 },
  navText: { color: '#334155', fontFamily: 'Poppins_600SemiBold', fontSize: 12, textAlign: 'center', flexShrink: 1 }, navTextActive: { color: '#fff' },
  quick: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, paddingVertical: 12, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EDF0EE', shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  quickItem: { flex: 1, alignItems: 'center', gap: 3, paddingHorizontal: 4 },
  quickSep: { width: 1, alignSelf: 'stretch', backgroundColor: '#EDF0EE' },
  quickValue: { color: '#0F172A', fontFamily: 'Poppins_700Bold', fontSize: 17, lineHeight: 22 },
  quickLabel: { color: '#64748B', fontFamily: 'Poppins_400Regular', fontSize: 11 },
  sources: { marginHorizontal: 20, marginTop: 8, color: '#65746D', fontFamily: 'Poppins_400Regular', fontSize: 11 },
  cards: { marginHorizontal: 16, marginTop: 14, gap: 14 },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendCol: { flex: 1, minWidth: 0, gap: 2, alignSelf: 'stretch', justifyContent: 'center' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingHorizontal: 6, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: '#F1F4F1' },
  legendRowOn: { backgroundColor: '#EEF8EA', borderBottomColor: 'transparent' },
  legendSwatch: { width: 11, height: 11, borderRadius: 6 },
  legendName: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: '#1F2D25' },
  legendCount: { fontFamily: 'Poppins_400Regular', fontSize: 10.5, color: '#6B7A72', marginTop: -2 },
  legendPct: { fontFamily: 'Poppins_700Bold', fontSize: 13, color: '#10231A', fontVariant: ['tabular-nums'] },
  backChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 2, height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: '#EEF8EA', marginBottom: 6 },
  backChipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#17843A' },
  colLegend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4, marginBottom: 6 },
  colLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%' },
  colLegendDot: { width: 10, height: 10, borderRadius: 3 },
  colLegendText: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: '#3B4A42', flexShrink: 1 },
  unitNote: { marginHorizontal: 4, fontFamily: 'Poppins_400Regular', fontSize: 11, lineHeight: 15, color: '#65746D' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 14 },
  filterPill: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#D6E6C6', backgroundColor: '#FCFCF6' },
  filterPillOn: { backgroundColor: '#E9FFB8', borderColor: '#B9F62F' },
  filterClear: { backgroundColor: 'transparent', borderColor: '#DCE3D8', borderStyle: 'dashed' },
  filterText: { flexShrink: 1, color: '#083D25', fontFamily: 'Poppins_600SemiBold', fontSize: 12.5 }, filterTextOn: { color: '#064B2C' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 18, marginTop: 20, marginBottom: 8 },
  sectionTitle: { color: '#0F172A', fontFamily: 'Poppins_700Bold', fontSize: 17, letterSpacing: -0.3 },
  seeDetail: { flexDirection: 'row', alignItems: 'center', gap: 2 }, seeDetailText: { color: '#15803D', fontFamily: 'Poppins_600SemiBold', fontSize: 13 },
  cropRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 16, marginBottom: 10, padding: 12, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EDF0EE', shadowColor: '#0f172a', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  cropRowOn: { borderColor: '#BEF264', backgroundColor: '#FBFEF5' },
  cropIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECF8EF' },
  cropEmoji: { fontSize: 26 },
  cropTop: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 8 },
  cropName: { color: '#0F172A', fontFamily: 'Poppins_600SemiBold', fontSize: 15 },
  cropHealthy: { color: '#15803D', fontFamily: 'Poppins_600SemiBold', fontSize: 12.5 },
  dist: { height: 9, borderRadius: 5, overflow: 'hidden', backgroundColor: '#EEF2F0' },
  distSeg: { position: 'absolute', top: 0, bottom: 0 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginHorizontal: 20, marginTop: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 }, legendDot: { width: 8, height: 8, borderRadius: 4 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 8, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#fff' },
  handle: { alignSelf: 'center', width: 38, height: 4.5, borderRadius: 3, backgroundColor: '#CBD5E1', marginBottom: 10 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  closeRound: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14 }, pickRowOn: { backgroundColor: '#F6FDE9' },
  pickTitle: { color: '#0F172A', fontFamily: 'Poppins_600SemiBold', fontSize: 14 },
  heading: { fontFamily: 'Poppins_600SemiBold', color: '#1F2937', fontSize: 21, marginHorizontal: 18, marginTop: 8 }, headingSmall: { fontFamily: 'Poppins_600SemiBold', color: '#263238', fontSize: 14 }, body: { fontFamily: 'Poppins_400Regular', color: '#52606D', fontSize: 12, lineHeight: 19 }, muted: { color: '#718096', fontFamily: 'Poppins_400Regular', fontSize: 11 }, chips: { paddingHorizontal: 18, gap: 8, paddingVertical: 14 }, chip: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff' }, chipText: { color: '#52606D', fontFamily: 'Poppins_600SemiBold', fontSize: 11 }, chipTextActive: { color: '#fff' },
  histSelector: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 12, minHeight: 50, paddingLeft: 8, paddingRight: 14, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#7895B2', shadowOpacity: 0.08, shadowRadius: 9, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  histSelectorIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECFDF5' },
  histSelectorText: { flex: 1, fontFamily: 'Poppins_600SemiBold', fontSize: 14.5, color: '#1F2937' },
  histSelectorCount: { minWidth: 30, height: 24, paddingHorizontal: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECFCCB' },
  histSelectorCountText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#3F6212' },
  placeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 10.5, color: '#0D756B', marginTop: 1 },
  typeTag: { fontFamily: 'Poppins_600SemiBold', fontSize: 9.5, color: '#0D756B', letterSpacing: 0.3, textTransform: 'uppercase' },
  walkIcon: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECFDF5' },
  histEmpty: { alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 6, padding: 20, borderRadius: 22, backgroundColor: '#fff' },
  histEmptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0FDF4' },
  subheading: { marginHorizontal: 18, marginTop: 20, marginBottom: 2, fontFamily: 'Poppins_600SemiBold', color: '#1F2937', fontSize: 17 },
  metrics: { flexDirection: 'row', marginHorizontal: 16, gap: 10 }, metric: { flex: 1, backgroundColor: '#fff', borderRadius: 15, padding: 14 }, metricValue: { color: '#14B8A6', fontFamily: 'Poppins_600SemiBold', fontSize: 20 }, card: { backgroundColor: '#fff', borderRadius: 18, margin: 16, marginBottom: 0, padding: 16, shadowColor: '#7895B2', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, cardTitle: { flexDirection: 'row', gap: 8, alignItems: 'center' }, cardCaption: { color: '#718096', fontFamily: 'Poppins_400Regular', fontSize: 11, marginTop: 5, marginBottom: 12 }, fruitChart: { borderTopWidth: 1, borderTopColor: '#E8EFF5', paddingTop: 11, marginTop: 3 }, fruitChartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, statusTrack: { height: 11, borderRadius: 8, overflow: 'hidden', backgroundColor: '#FBEDEA', flexDirection: 'row' }, statusHealthy: { height: '100%' }, statusNeedsReview: { height: '100%' }, chartLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }, legendHealthy: { color: '#3BAE72', fontFamily: 'Poppins_600SemiBold', fontSize: 10 }, legendReview: { color: '#B65B50', fontFamily: 'Poppins_400Regular', fontSize: 10 }, volumeChart: { height: 172, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', gap: 8, paddingTop: 16 }, volumeColumn: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' }, volumeValue: { color: '#374151', fontFamily: 'Poppins_600SemiBold', fontSize: 11, marginBottom: 5 }, volumeTrack: { height: 112, width: 27, borderRadius: 8, backgroundColor: '#EAF4FC', justifyContent: 'flex-end', overflow: 'hidden' }, volumeBar: { width: '100%', borderRadius: 8 }, volumeLabel: { color: '#52606D', fontFamily: 'Poppins_400Regular', fontSize: 9, marginTop: 7, maxWidth: 64 }, readingRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#E8EFF5' }, confidenceTrack: { height: 7, backgroundColor: '#EAF4FC', borderRadius: 5, overflow: 'hidden', marginTop: 6 }, confidenceFill: { height: '100%', borderRadius: 5 }, readingScore: { color: '#263238', fontFamily: 'Poppins_600SemiBold', fontSize: 12, width: 36, textAlign: 'right' }, readingAttention: { color: '#718096', fontFamily: 'Poppins_400Regular', fontSize: 9, width: 54, textAlign: 'right' },
  recommendation: { flexDirection: 'row', marginHorizontal: 16, marginTop: 10, padding: 16, borderRadius: 18, gap: 12 }, priorityBadge: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, priorityText: { color: '#fff', fontFamily: 'Poppins_600SemiBold', fontSize: 11 }, actionText: { marginTop: 7, fontFamily: 'Poppins_600SemiBold', fontSize: 11 }, primaryButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, margin: 16, borderRadius: 14, padding: 14 }, buttonText: { color: '#fff', fontFamily: 'Poppins_600SemiBold', fontSize: 13 }, scanRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 9, gap: 9, shadowColor: '#7895B2', shadowOpacity: 0.07, shadowRadius: 9, shadowOffset: { width: 0, height: 3 }, elevation: 2 }, scanImage: { width: 52, height: 52, borderRadius: 14 }, scanInfo: { flex: 1, minWidth: 0 }, scanDiagnosis: { fontFamily: 'Poppins_400Regular', fontSize: 10, marginTop: 1, marginBottom: 1 }, scanSparkline: { width: 46, height: 30, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 2 }, scanSparkBar: { width: 3, minHeight: 5, borderRadius: 2 }, scanScoreColumn: { width: 43, alignItems: 'flex-end' }, scanScoreValue: { color: '#263238', fontFamily: 'Poppins_600SemiBold', fontSize: 12 }, scanScoreCaption: { fontFamily: 'Poppins_600SemiBold', fontSize: 8, marginTop: 1 }, detail: { color: '#526B68', fontSize: 10, marginTop: 5, fontFamily: 'Poppins_400Regular' },
  planIntro: { marginHorizontal: 18, marginTop: 4 }, calendar: { margin: 16, marginBottom: 0, backgroundColor: '#fff', borderRadius: 18, padding: 13 }, calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, calendarMonth: { color: '#263238', fontFamily: 'Poppins_600SemiBold', fontSize: 13, textTransform: 'capitalize' }, week: { flexDirection: 'row', justifyContent: 'space-between' }, day: { width: 38, minHeight: 62, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, dayName: { color: '#718096', fontFamily: 'Poppins_600SemiBold', fontSize: 10, textTransform: 'uppercase' }, dayNumber: { color: '#374151', fontFamily: 'Poppins_600SemiBold', fontSize: 13, marginTop: 3 }, dayDot: { width: 4, height: 4, borderRadius: 2, marginTop: 3 }, dayTaskIcon: { marginTop: 2 }, selectedDate: { marginHorizontal: 18, marginTop: 13, color: '#374151', fontFamily: 'Poppins_600SemiBold', fontSize: 13, textTransform: 'capitalize' }, form: { backgroundColor: '#fff', margin: 16, padding: 14, borderRadius: 16, gap: 9 }, formDate: { color: '#52606D', fontFamily: 'Poppins_600SemiBold', fontSize: 11, textTransform: 'capitalize' }, scheduleFields: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, scheduleField: { flexGrow: 1, minWidth: 145, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: '#D8E3EA', borderRadius: 11, padding: 10 }, scheduleFieldLabel: { color: '#718096', fontFamily: 'Poppins_400Regular', fontSize: 9 }, scheduleFieldValue: { color: '#263238', fontFamily: 'Poppins_600SemiBold', fontSize: 11, textTransform: 'capitalize' }, input: { borderWidth: 1, borderColor: '#D8E3EA', borderRadius: 10, padding: 11, fontFamily: 'Poppins_400Regular', fontSize: 12 }, smallButton: { alignSelf: 'flex-end', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 }, task: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 15 }, taskDate: { color: '#426B67', fontFamily: 'Poppins_600SemiBold', fontSize: 10, marginTop: 3, marginBottom: 2 }, check: { width: 23, height: 23, borderRadius: 12, borderWidth: 1.5, borderColor: '#55D68B', alignItems: 'center', justifyContent: 'center' }, done: { textDecorationLine: 'line-through', color: '#94A3B8' }, emptyTasks: { marginHorizontal: 16, marginBottom: 8, padding: 20, alignItems: 'center', backgroundColor: '#EAF4FC', borderRadius: 15 }, scanLink: { flexDirection: 'row', alignItems: 'center', gap: 9, margin: 20 }, empty: { alignItems: 'center', padding: 50 }, emptyTitle: { color: '#263238', fontFamily: 'Poppins_600SemiBold', fontSize: 15, textAlign: 'center' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
});