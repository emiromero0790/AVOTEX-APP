import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, useWindowDimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { CheckCircle, Plus, BrainCircuit, ShieldCheck, AlertTriangle, ShieldAlert, Trash2, ChevronLeft, ChevronRight, Camera, PieChart, List, CalendarDays } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '../../firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import { supabase } from '../../supabaseConfig';
import { useAccessibility } from '../../context/AccessibilityContext';

interface Scan {
  id?: number;
  label: string;
  score: number;
}

interface Recommendation {
  id: string;
  text: string;
  type: 'positive' | 'info' | 'warning' | 'danger';
}

type Task = {
  id: number;
  title: string;
  detail: string;
  completed: boolean;
  user_id: string;
};

export default function AgendaScreen() {
  const { isColorblindMode } = useAccessibility();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const scrollRef = useRef<ScrollView>(null);

  const [user, setUser] = useState<User | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDetail, setNewDetail] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());

  const colors = useMemo(() => ({
     primary: isColorblindMode ? '#145DA0' : '#0F766E',
     accent: isColorblindMode ? '#3B82C4' : '#16877E',
     saveButton: isColorblindMode ? '#1976D2' : '#0F766E',
    deleteButton: isColorblindMode ? '#0D47A1' : '#e74c3c',
    textPrimary: '#1a2e0a',
    textSecondary: '#666',
    white: '#ffffff',
     positive: { bg: isColorblindMode ? '#E3F2FD' : '#E5F2EF', border: isColorblindMode ? '#42A5F5' : '#16877E' },
    info: { bg: isColorblindMode ? '#FFF8E1' : '#eaf4fc', border: isColorblindMode ? '#FFC107' : '#2980b9' },
     warning: { bg: isColorblindMode ? '#FFF8E1' : '#FFF4E1', border: isColorblindMode ? '#F57F17' : '#C78335' },
     danger: { bg: isColorblindMode ? '#E3F2FD' : '#FBEDEA', border: isColorblindMode ? '#0D47A1' : '#C75C4B' },
  }), [isColorblindMode]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setTasks([]);
        setScans([]);
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const { data: scansData, error: scansError } = await supabase
          .from('scans').select('label, score').eq('user_id', user.uid);
        if (scansError) throw scansError;
        if (scansData) setScans(scansData);

        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks').select('*').eq('user_id', user.uid).order('created_at', { ascending: false });
        if (tasksError) throw tasksError;
        if (tasksData) setTasks(tasksData);
      } catch (error) {
        console.error("Error al obtener datos:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    if (scans.length > 0) {
      const totalScans = scans.length;
      const enfermos = scans.filter(s => !s.label.toLowerCase().includes('saludable'));
      const enfermosCount = enfermos.length;
      const enfermosRatio = enfermosCount / totalScans;
      const newRecs: Recommendation[] = [];

      if (totalScans < 10) {
        newRecs.push({ id: 'rec1', text: `Has realizado ${totalScans} escaneos. ¡Sigue así! Se recomiendan al menos 20 para un análisis más preciso.`, type: 'info' });
      }
      if (enfermosRatio === 0) {
        newRecs.push({ id: 'rec2', text: '¡Excelente trabajo! Todos tus escaneos indican cultivos saludables. No se requieren acciones correctivas.', type: 'positive' });
      } else if (enfermosRatio <= 0.20) {
        newRecs.push({ id: 'rec3', text: `Bajo riesgo detectado (${(enfermosRatio * 100).toFixed(0)}% de escaneos no saludables). Considera tratamientos preventivos.`, type: 'warning' });
      } else if (enfermosRatio <= 0.50) {
        newRecs.push({ id: 'rec4', text: `Riesgo moderado (${(enfermosRatio * 100).toFixed(0)}% no saludables). Aplica tratamientos en las zonas afectadas.`, type: 'danger' });
      } else {
        newRecs.push({ id: 'rec5', text: `¡ALERTA ALTA! Más del 50% (${(enfermosRatio * 100).toFixed(0)}%) de tus escaneos muestran problemas. Consulta a un agrónomo.`, type: 'danger' });
      }

      const diseaseCounts: { [key: string]: number } = {};
      enfermos.forEach(scan => { diseaseCounts[scan.label] = (diseaseCounts[scan.label] || 0) + 1; });
      const commonDisease = Object.keys(diseaseCounts).sort((a, b) => diseaseCounts[b] - diseaseCounts[a])[0];

      if (commonDisease) {
        if (commonDisease.toLowerCase().includes('antracnosis')) {
          newRecs.push({ id: 'rec6', text: 'Presencia de Antracnosis detectada. Prioriza la poda sanitaria y considera fungicidas a base de cobre.', type: 'warning' });
        }
        if (commonDisease.toLowerCase().includes('roya')) {
          newRecs.push({ id: 'rec7', text: 'La Roya parece ser el principal problema. Mejora el drenaje y aplica tratamientos con azufre.', type: 'warning' });
        }
      }

      if (enfermosRatio > 0.1) {
        newRecs.push({ id: 'rec8', text: 'Desinfecta tus herramientas de poda entre cada planta para evitar propagación de enfermedades.', type: 'info' });
        newRecs.push({ id: 'rec9', text: 'Revisa el sistema de riego. El exceso de humedad favorece la aparición de hongos.', type: 'info' });
      }
      if (enfermosRatio === 0) {
        newRecs.push({ id: 'rec10', text: 'Tu manejo es muy bueno. Considera un análisis de suelo para mantener nutrientes óptimos.', type: 'positive' });
      } else {
        newRecs.push({ id: 'rec11', text: 'Documenta las zonas tratadas para un mejor seguimiento de la efectividad de los tratamientos.', type: 'info' });
      }
      setRecommendations(newRecs);
    } else if (!isLoading) {
      setRecommendations([{ id: 'rec_initial', text: 'Realiza algunos escaneos en la pestaña "Escanear" para recibir recomendaciones personalizadas.', type: 'info' }]);
    }
  }, [scans, isLoading]);

  const toggleComplete = async (task: Task) => {
    try {
      const newStatus = !task.completed;
      const { error } = await supabase.from('tasks').update({ completed: newStatus }).eq('id', task.id);
      if (error) throw error;
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: newStatus } : t));
    } catch (error) { console.error("Error al actualizar tarea:", error); }
  };

  const addTask = async () => {
    if (!newTitle.trim() || !user) return;
    const newTask = { title: newTitle, detail: newDetail, user_id: user.uid, completed: false };
    try {
      const { data, error } = await supabase.from('tasks').insert(newTask).select();
      if (error) throw error;
      if (data) setTasks([data[0], ...tasks]);
      setNewTitle('');
      setNewDetail('');
      setShowForm(false);
    } catch (error) { console.error("Error al añadir tarea:", error); }
  };

  const deleteTask = async (taskId: number) => {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
      setTasks(tasks.filter(t => t.id !== taskId));
    } catch (error) { console.error("Error al eliminar tarea:", error); }
  };

  const getRecommendationIcon = (type: Recommendation['type']) => {
    const iconColor = colors[type].border;
    switch (type) {
      case 'positive': return <ShieldCheck size={24} color={iconColor} />;
      case 'info': return <BrainCircuit size={24} color={iconColor} />;
      case 'warning': return <AlertTriangle size={24} color={iconColor} />;
      case 'danger': return <ShieldAlert size={24} color={iconColor} />;
      default: return null;
    }
  };

  const calendarWeek = useMemo(() => {
    const start = new Date(calendarDate);
    start.setDate(calendarDate.getDate() - calendarDate.getDay());
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [calendarDate]);
  const isSelectedDay = (date: Date) => date.toDateString() === calendarDate.toDateString();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
    >
      {/* Fondo degradado compartido */}
      <View style={StyleSheet.absoluteFillObject} />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContainer}
        style={{ backgroundColor: 'transparent' }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Stack.Screen options={{ title: 'Agenda y Recomendaciones' }} />

        <View style={[styles.activityHeader, isTablet && styles.activityHeaderTablet]}>
          <Text style={[styles.activityTitle, isTablet && styles.activityTitleTablet]}>Actividad</Text>
          <Text style={[styles.activitySubtitle, isTablet && styles.activitySubtitleTablet]}>Historial de análisis</Text>
        </View>

        <View
          style={[
            styles.activityToggle,
            isTablet && styles.activityToggleTablet,
            { backgroundColor: isColorblindMode ? '#E4F0FA' : '#E1F2EF' },
          ]}
        >
          <TouchableOpacity
            style={styles.activityToggleBtn}
            onPress={() => router.replace({ pathname: '/(app)/results', params: { view: 'charts' } })}
          >
            <PieChart size={isTablet ? 24 : 20} color={colors.primary} />
            <Text style={[styles.activityToggleText, { color: colors.primary }]}>Gráficas</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.activityToggleBtn}
            onPress={() => router.replace({ pathname: '/(app)/results', params: { view: 'list' } })}
          >
            <List size={isTablet ? 24 : 20} color={colors.primary} />
            <Text style={[styles.activityToggleText, { color: colors.primary }]}>Lista</Text>
          </TouchableOpacity>
          <View style={[styles.activityToggleBtn, { backgroundColor: colors.primary }]}>
            <CalendarDays size={isTablet ? 24 : 20} color="#FFFFFF" />
            <Text style={[styles.activityToggleText, styles.activityToggleTextActive]}>Agenda</Text>
          </View>
        </View>

        <View style={styles.headerGradient}>
          <BrainCircuit size={32} color={colors.primary} />
          <Text style={[styles.title, { color: colors.primary }]}>Recomendaciones</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Análisis y acciones sugeridas basadas en tus escaneos
          </Text>
        </View>

        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity accessibilityLabel="Semana anterior" onPress={() => setCalendarDate(current => new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7))}><ChevronLeft size={20} color="#EFFF63" /></TouchableOpacity>
            <Text style={styles.calendarMonth}>{calendarDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</Text>
            <TouchableOpacity accessibilityLabel="Semana siguiente" onPress={() => setCalendarDate(current => new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7))}><ChevronRight size={20} color="#EFFF63" /></TouchableOpacity>
          </View>
          <View style={styles.calendarWeek}>
            {calendarWeek.map((date, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.calendarDay, isSelectedDay(date) && styles.calendarToday]}
                onPress={() => setCalendarDate(date)}
                activeOpacity={0.85}
              >
                <Text style={[styles.calendarNumber, isSelectedDay(date) && styles.calendarTodayText]}>{date.getDate()}</Text>
                <Text style={[styles.calendarDayName, isSelectedDay(date) && styles.calendarTodayText]}>
                  {date.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.separator}>
          <Text style={styles.separatorText}>Mis Tareas Personales</Text>
        </View>

        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.accent }]}
          onPress={() => setShowForm(!showForm)}
        >
          <Plus size={20} color={colors.white} />
          <Text style={styles.addButtonText}>{showForm ? 'Ocultar Formulario' : 'Agregar Tarea'}</Text>
        </TouchableOpacity>

        {showForm && (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Título de la tarea"
              value={newTitle}
              onChangeText={setNewTitle}
              onFocus={() => setTimeout(() => scrollRef.current?.scrollTo({ y: 480, animated: true }), 180)}
              placeholderTextColor="#aaa"
              returnKeyType="next"
            />
            <TextInput
              style={styles.input}
              placeholder="Detalle (opcional)"
              value={newDetail}
              onChangeText={setNewDetail}
              onFocus={() => setTimeout(() => scrollRef.current?.scrollTo({ y: 540, animated: true }), 180)}
              placeholderTextColor="#aaa"
              returnKeyType="done"
            />
            <TouchableOpacity onPress={addTask}>
              <View style={styles.saveButtonGradient}>
                <Text style={styles.saveButtonText}>Guardar Tarea</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {tasks.length === 0 && !isLoading && !showForm && (
          <Text style={styles.noTasksText}>No tienes tareas programadas. ¡Añade una!</Text>
        )}

        {tasks.map((task, index) => {
          const darkTask = index % 3 === 2;
          const taskBackground = index % 3 === 0 ? '#F1FF72' : index % 3 === 1 ? '#E8E5FF' : '#1D1D20';
          return (
          <View key={task.id} style={[styles.taskCard, { backgroundColor: taskBackground }, task.completed && styles.completedCard]}>
            <View style={styles.taskContent}>
              <TouchableOpacity style={styles.taskTouchableArea} onPress={() => toggleComplete(task)}>
                <CheckCircle
                  size={24}
                  color={task.completed ? colors.accent : darkTask ? '#FFFFFF' : '#29282E'}
                  style={{ marginRight: 12 }}
                />
                <View style={styles.taskTextContainer}>
                  <Text style={[styles.taskTitle, darkTask && styles.taskTextDark, task.completed && styles.completedText]}>{task.title}</Text>
                  {task.detail ? (
                    <Text style={[styles.taskDetail, darkTask && styles.taskDetailDark, task.completed && styles.completedText]}>{task.detail}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteTask(task.id)} style={styles.deleteBtn}>
                <Trash2 size={19} color={darkTask ? '#FFFFFF' : colors.deleteButton} />
              </TouchableOpacity>
            </View>
          </View>
          );
        })}

        <TouchableOpacity style={styles.scanCta} onPress={() => router.push('/scan')} activeOpacity={0.88}>
          <View style={styles.scanCtaIcon}><Camera size={38} color="#0F766E" /></View>
          <View style={styles.scanCtaCopy}><Text style={styles.scanCtaTitle}>Escanea tus cultivos</Text><Text style={styles.scanCtaText}>Recibe recomendaciones claras para decidir qué hacer hoy.</Text></View>
          <ChevronRight size={22} color="#0F766E" />
        </TouchableOpacity>

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 40 }} />
        ) : (
          recommendations.map(rec => (
            <View
              key={rec.id}
              style={[styles.recCard, { backgroundColor: colors[rec.type].bg, borderColor: colors[rec.type].border }]}
            >
              {getRecommendationIcon(rec.type)}
              <Text style={styles.recText}>{rec.text}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingHorizontal: 22,
    paddingBottom: 120,
  },
  activityHeader: {
    paddingTop: 54,
    paddingHorizontal: 2,
    alignItems: 'flex-start',
  },
  activityHeaderTablet: {
    paddingTop: 80,
    paddingHorizontal: 18,
  },
  activityTitle: {
    color: '#0F766E',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 32,
  },
  activityTitleTablet: {
    fontSize: 40,
  },
  activitySubtitle: {
    color: '#66807D',
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    marginBottom: 4,
  },
  activitySubtitleTablet: {
    fontSize: 19,
  },
  activityToggle: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    marginTop: 14,
    marginHorizontal: 2,
    marginBottom: 12,
    borderRadius: 16,
  },
  activityToggleTablet: {
    marginHorizontal: 18,
  },
  activityToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderRadius: 24,
  },
  activityToggleText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  activityToggleTextActive: {
    color: '#FFFFFF',
  },
  headerGradient: {
    alignItems: 'flex-start',
    paddingTop: 22,
    paddingBottom: 28,
    paddingHorizontal: 20,
    marginHorizontal: -20,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginTop: 10,
    textAlign: 'left',
    fontFamily: 'System',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'left',
    marginTop: 6,
    lineHeight: 20,
  },
  recCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  recText: {
    fontSize: 14,
    color: '#34495e',
    flex: 1,
    paddingLeft: 14,
    lineHeight: 20,
  },
  separator: {
    borderTopWidth: 1,
    borderTopColor: '#DDE5E2',
    marginTop: 10,
    marginBottom: 16,
    alignItems: 'center',
  },
  separatorText: {
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    color: '#0F766E',
    fontSize: 14,
    fontWeight: '700',
    marginTop: -11,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignSelf: 'flex-start',
    marginBottom: 16,
    gap: 8,
    shadowColor: '#2d6a1f',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  form: {
    marginBottom: 20,
    backgroundColor: '#EAF4F2',
    borderRadius: 18,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#C6DFDA',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#C6DFDA',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#1a2e0a',
  },
  saveButtonGradient: {
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B8DCC7',
  },
  saveButtonText: {
    color: '#0F766E',
    fontSize: 15,
    fontWeight: '600',
  },
  taskCard: {
    minHeight: 84,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginBottom: 10,
    shadowColor: '#29272F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 9,
    elevation: 4,
  },
  completedCard: {
    backgroundColor: '#f0f0f0',
    borderColor: '#e0e0e0',
  },
  taskContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskTouchableArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskTextContainer: { flex: 1 },
  taskTitle: {
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    color: '#1D1C20',
  },
  taskDetail: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    color: '#5F5C64',
    marginTop: 4,
  },
  taskTextDark: { color: '#FFFFFF' },
  taskDetailDark: { color: '#BDBAC4' },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#aaa',
  },
  deleteBtn: { paddingLeft: 10 },
  noTasksText: {
    textAlign: 'center',
    color: '#999',
    marginVertical: 20,
    fontSize: 15,
  },
  calendarCard: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    backgroundColor: '#1C1C1F',
    borderRadius: 22,
    padding: 14,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 },
  calendarMonth: {
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  calendarWeek: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  calendarDay: {
    flex: 1,
    minHeight: 57,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  calendarToday: { backgroundColor: '#EFFF63' },
  calendarNumber: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: '#171719',
  },
  calendarTodayText: { color: '#171719' },
  calendarDayName: {
    color: '#6F6C74',
    fontFamily: 'Poppins_400Regular',
    fontSize: 8,
    textTransform: 'capitalize',
    marginTop: -1,
  },
  scanCta: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#EAF7F3', borderRadius: 22, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: '#B9DED5' },
  scanCtaIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#D2EFE8', alignItems: 'center', justifyContent: 'center' },
  scanCtaCopy: { flex: 1 },
  scanCtaTitle: { fontSize: 16, fontWeight: '700', color: '#104D49' },
  scanCtaText: { fontSize: 12, color: '#55716D', lineHeight: 18, marginTop: 3 },
});