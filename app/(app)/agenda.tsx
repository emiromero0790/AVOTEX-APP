import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { Calendar, CheckCircle, Plus, BrainCircuit, ShieldCheck, AlertTriangle, ShieldAlert, Trash2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '../../firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import { supabase } from '../../supabaseConfig';
import { useAccessibility } from '../../context/AccessibilityContext';

interface Scan {
  id: number;
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

  const [user, setUser] = useState<User | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDetail, setNewDetail] = useState('');
  const [showForm, setShowForm] = useState(false);

  const colors = useMemo(() => ({
    primary: isColorblindMode ? '#0D47A1' : '#3aaa5c',
    accent: isColorblindMode ? '#42A5F5' : '#4fc46a',
    saveButton: isColorblindMode ? '#1976D2' : '#3aaa5c',
    deleteButton: isColorblindMode ? '#0D47A1' : '#e74c3c',
    textPrimary: '#1a2e0a',
    textSecondary: '#666',
    white: '#ffffff',
    positive: { bg: isColorblindMode ? '#E3F2FD' : '#e8f7ec', border: isColorblindMode ? '#42A5F5' : '#27ae60' },
    info: { bg: isColorblindMode ? '#FFF8E1' : '#eaf4fc', border: isColorblindMode ? '#FFC107' : '#2980b9' },
    warning: { bg: isColorblindMode ? '#FFF8E1' : '#fef9e7', border: isColorblindMode ? '#F57F17' : '#f39c12' },
    danger: { bg: isColorblindMode ? '#E3F2FD' : '#fdf0f0', border: isColorblindMode ? '#0D47A1' : '#c0392b' },
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

  return (
    <View style={{ flex: 1 }}>
      {/* Fondo degradado compartido */}
      <LinearGradient
        colors={['#a7f3d0', '#ecfdf5', '#ffff']}
        locations={[0, 0.38, 1]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        style={{ backgroundColor: 'transparent' }}
      >
        <Stack.Screen options={{ title: 'Agenda y Recomendaciones' }} />

        <View style={styles.headerGradient}>
          <BrainCircuit size={32} color={colors.primary} />
          <Text style={[styles.title, { color: colors.primary }]}>Recomendaciones</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Análisis y acciones sugeridas basadas en tus escaneos
          </Text>
        </View>

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
              placeholderTextColor="#aaa"
            />
            <TextInput
              style={styles.input}
              placeholder="Detalle (opcional)"
              value={newDetail}
              onChangeText={setNewDetail}
              placeholderTextColor="#aaa"
            />
            <TouchableOpacity onPress={addTask}>
              <LinearGradient
                colors={['#4fc46a', '#2da84a']}
                style={styles.saveButtonGradient}
              >
                <Text style={styles.saveButtonText}>Guardar Tarea</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {tasks.length === 0 && !isLoading && !showForm && (
          <Text style={styles.noTasksText}>No tienes tareas programadas. ¡Añade una!</Text>
        )}

        {tasks.map(task => (
          <View key={task.id} style={[styles.taskCard, task.completed && styles.completedCard]}>
            <View style={styles.taskContent}>
              <TouchableOpacity style={styles.taskTouchableArea} onPress={() => toggleComplete(task)}>
                <CheckCircle
                  size={28}
                  color={task.completed ? colors.accent : '#ccc'}
                  style={{ marginRight: 14 }}
                />
                <View style={styles.taskTextContainer}>
                  <Text style={[styles.taskTitle, task.completed && styles.completedText]}>{task.title}</Text>
                  {task.detail ? (
                    <Text style={[styles.taskDetail, task.completed && styles.completedText]}>{task.detail}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteTask(task.id)} style={styles.deleteBtn}>
                <Trash2 size={22} color={colors.deleteButton} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  headerGradient: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 28,
    paddingHorizontal: 20,
    marginHorizontal: -20,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginTop: 10,
    textAlign: 'center',
    fontFamily: 'System',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
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
    borderTopColor: '#d4ecc8',
    marginTop: 28,
    marginBottom: 20,
    alignItems: 'center',
  },
  separatorText: {
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    color: '#7aad4c',
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
    backgroundColor: 'rgba(240, 247, 236, 0.85)',
    borderRadius: 18,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#c8dfc0',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#c8dfc0',
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
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  taskCard: {
    backgroundColor: 'rgba(245, 253, 240, 0.9)',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#d4ecc8',
    shadowColor: '#2d6a1f',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
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
    fontSize: 17,
    fontWeight: '600',
    color: '#1a2e0a',
  },
  taskDetail: {
    fontSize: 13,
    color: '#6b8a5e',
    marginTop: 4,
  },
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
});