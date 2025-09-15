import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { Calendar, CheckCircle, Plus, BrainCircuit, ShieldCheck, AlertTriangle, ShieldAlert, Trash2 } from 'lucide-react-native';

// --- Importaciones de Firebase y Supabase ---
import { auth } from '../../firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import { supabase } from '../../supabaseConfig';

// --- Interfaces para los datos ---
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
  const [user, setUser] = useState<User | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  // --- Estados de la Agenda ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDetail, setNewDetail] = useState('');
  const [showForm, setShowForm] = useState(false);
  
  // Obtener usuario actual
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

  // Obtener escaneos y tareas cuando el usuario se carga
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        const { data: scansData, error: scansError } = await supabase.from('scans').select('label, score').eq('user_id', user.uid);
        if (scansError) throw scansError;
        if (scansData) setScans(scansData);

        const { data: tasksData, error: tasksError } = await supabase.from('tasks').select('*').eq('user_id', user.uid).order('created_at', { ascending: false });
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

  // Motor de recomendaciones
  useEffect(() => {
    if (scans.length > 0) {
      const totalScans = scans.length;
      const enfermos = scans.filter(s => !s.label.toLowerCase().includes('saludable'));
      const enfermosCount = enfermos.length;
      const enfermosRatio = enfermosCount / totalScans;

      const newRecommendations: Recommendation[] = [];

      if (totalScans < 10) {
        newRecommendations.push({ id: 'rec1', text: `Has realizado ${totalScans} escaneos. ¡Sigue así! Se recomiendan al menos 20 para un análisis más preciso.`, type: 'info' });
      }

      if (enfermosRatio === 0) {
        newRecommendations.push({ id: 'rec2', text: '¡Excelente trabajo! Todos tus escaneos recientes indican una huerta saludable. No se requieren acciones correctivas.', type: 'positive' });
      } else if (enfermosRatio <= 0.20) {
        newRecommendations.push({ id: 'rec3', text: `Bajo riesgo detectado (${(enfermosRatio*100).toFixed(0)}% de escaneos no saludables). Considera tratamientos preventivos y monitoreo constante.`, type: 'warning' });
      } else if (enfermosRatio <= 0.50) {
        newRecommendations.push({ id: 'rec4', text: `Riesgo moderado (${(enfermosRatio*100).toFixed(0)}% de escaneos no saludables). Es momento de aplicar tratamientos específicos en las zonas afectadas.`, type: 'danger' });
      } else {
        newRecommendations.push({ id: 'rec5', text: `¡ALERTA ALTA! Más de la mitad de tus escaneos (${(enfermosRatio*100).toFixed(0)}%) muestran problemas. Se recomienda una acción correctiva general y consultar a un agrónomo.`, type: 'danger' });
      }
      
      const diseaseCounts: { [key: string]: number } = {};
      enfermos.forEach(scan => { diseaseCounts[scan.label] = (diseaseCounts[scan.label] || 0) + 1; });
      const commonDisease = Object.keys(diseaseCounts).sort((a, b) => diseaseCounts[b] - diseaseCounts[a])[0];

      if (commonDisease) {
          if (commonDisease.toLowerCase().includes('antracnosis')) {
            newRecommendations.push({ id: 'rec6', text: 'Se detecta una presencia notable de Antracnosis. Prioriza la poda sanitaria para mejorar la ventilación y considera fungicidas a base de cobre.', type: 'warning' });
          }
          if (commonDisease.toLowerCase().includes('roya')) {
            newRecommendations.push({ id: 'rec7', text: 'La Roya parece ser tu principal problema. Asegura un buen drenaje y aplica tratamientos con azufre o fungicidas específicos.', type: 'warning' });
          }
      }
      
      if (enfermosRatio > 0.1) {
        newRecommendations.push({ id: 'rec8', text: 'Recuerda desinfectar tus herramientas de poda entre cada árbol para evitar la propagación de enfermedades.', type: 'info' });
        newRecommendations.push({ id: 'rec9', text: 'Revisa el sistema de riego. El exceso de humedad en el follaje puede favorecer la aparición de hongos.', type: 'info' });
      }
      if (enfermosRatio === 0) {
        newRecommendations.push({ id: 'rec10', text: 'Tu manejo actual es muy bueno. Considera realizar un análisis de suelo para mantener los nutrientes en niveles óptimos.', type: 'positive'});
      } else {
        newRecommendations.push({ id: 'rec11', text: 'Documenta las zonas tratadas en tu agenda personal para un mejor seguimiento de la efectividad.', type: 'info'});
      }

      setRecommendations(newRecommendations);
    } else if (!isLoading) {
        setRecommendations([{ id: 'rec_initial', text: 'Realiza algunos escaneos en la pestaña "Escanear" para empezar a recibir recomendaciones personalizadas.', type: 'info' }]);
    }
  }, [scans, isLoading]);

  const toggleComplete = async (task: Task) => {
    try {
      const newCompletedStatus = !task.completed;
      const { error } = await supabase.from('tasks').update({ completed: newCompletedStatus }).eq('id', task.id);
      if (error) throw error;
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: newCompletedStatus } : t));
    } catch (error) {
      console.error("Error al actualizar tarea:", error);
    }
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
    } catch (error) {
      console.error("Error al añadir tarea:", error);
    }
  };

  const deleteTask = async (taskId: number) => {
    try {
        const { error } = await supabase.from('tasks').delete().eq('id', taskId);
        if (error) throw error;
        setTasks(tasks.filter(t => t.id !== taskId));
    } catch (error) {
        console.error("Error al eliminar tarea:", error);
    }
  };

  const getRecommendationIcon = (type: Recommendation['type']) => {
    switch (type) {
      case 'positive': return <ShieldCheck size={24} color="#27ae60" />;
      case 'info': return <BrainCircuit size={24} color="#2980b9" />;
      case 'warning': return <AlertTriangle size={24} color="#f39c12" />;
      case 'danger': return <ShieldAlert size={24} color="#c0392b" />;
      default: return null;
    }
  };

  return (
    // --- CAMBIO 1: Se usa 'contentContainerStyle' en lugar de 'style' ---
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <Stack.Screen options={{ title: 'Agenda y Recomendaciones' }} />
      <View style={styles.header}>
        <BrainCircuit size={32} color="#50c878" />
        <Text style={styles.title}>Recomendaciones por Avotex</Text>
        <Text style={styles.subtitle}>Análisis y acciones sugeridas basadas en tus escaneos</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#66bb6a" style={{ marginVertical: 40 }} />
      ) : (
        recommendations.map(rec => (
          <View key={rec.id} style={[styles.recCard, styles[`recCard_${rec.type}`]]}>
            {getRecommendationIcon(rec.type)}
            <Text style={styles.recText}>{rec.text}</Text>
          </View>
        ))
      )}

      <View style={styles.separator}>
        <Text style={styles.separatorText}>Mis Tareas Personales</Text>
      </View>
      
      <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(!showForm)}>
        <Plus size={20} color="#ffffff" />
        <Text style={styles.addButtonText}>{showForm ? 'Ocultar Formulario' : 'Agregar Tarea'}</Text>
      </TouchableOpacity>

      {showForm && (
        <View style={styles.form}>
          <TextInput style={styles.input} placeholder="Título de la tarea" value={newTitle} onChangeText={setNewTitle} />
          <TextInput style={styles.input} placeholder="Detalle (opcional)" value={newDetail} onChangeText={setNewDetail} />
          <TouchableOpacity style={styles.saveButton} onPress={addTask}>
            <Text style={styles.saveButtonText}>Guardar Tarea</Text>
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
                <CheckCircle size={28} color={task.completed ? '#50c878' : '#e0e0e0'} style={{marginRight: 15}}/>
                <View style={styles.taskTextContainer}>
                    <Text style={[styles.taskTitle, task.completed && styles.completedText]}>{task.title}</Text>
                    {task.detail ? (
                    <Text style={[styles.taskDetail, task.completed && styles.completedText]}>{task.detail}</Text>
                    ) : null}
                </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteTask(task.id)} style={styles.deleteButton}>
              <Trash2 size={22} color="#e74c3c" />
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // --- CAMBIO 2: Se crea 'scrollContainer' y se ajusta 'container' ---
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 120, // <-- LA LÍNEA MÁGICA: Añade espacio extra al final
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#66bb6a',
    marginTop: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  recCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  recCard_positive: { backgroundColor: '#e8f5e9', borderColor: '#27ae60' },
  recCard_info: { backgroundColor: '#eaf4fc', borderColor: '#2980b9' },
  recCard_warning: { backgroundColor: '#fef5e7', borderColor: '#f39c12' },
  recCard_danger: { backgroundColor: '#fbebed', borderColor: '#c0392b' },
  recText: {
    fontSize: 15,
    color: '#34495e',
    flex: 1,
    paddingLeft: 15,
    lineHeight: 22,
  },
  separator: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginTop: 30,
    marginBottom: 20,
    alignItems: 'center',
  },
  separatorText: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
    marginTop: -10,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#50c878',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 16,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  form: {
    marginBottom: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  saveButton: {
    backgroundColor: '#4fbcff',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  taskCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginBottom: 12,
  },
  completedCard: {
    backgroundColor: '#f0f0f0',
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
  taskTextContainer: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2a2a2a',
  },
  taskDetail: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#aaa',
  },
  deleteButton: {
    paddingLeft: 10,
  },
  noTasksText: {
    textAlign: 'center',
    color: '#999',
    marginVertical: 20,
    fontSize: 16,
  },
});