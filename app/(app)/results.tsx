import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Poppins_400Regular, Poppins_600SemiBold } from '@expo-google-fonts/poppins';

import { auth } from '../../firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import { supabase } from '../../supabaseConfig';
import { BarChart, PieChart, LineChart } from 'react-native-chart-kit';
import { PieChart as PieChartIcon, BarChart3, List, LineChart as LineChartIcon } from 'lucide-react-native';
import { useAccessibility } from '../../context/AccessibilityContext';

const avotexSanoImage = require('../../assets/images/avotexSano.png');
const avotexEnfermoImage = require('../../assets/images/avotexEnfermo.png');

interface Scan {
  id: number;
  created_at: string;
  user_id: string;
  user_email: string;
  label: string;
  score: number;
}

const formatScanDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) + ' ' + date.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const screenWidth = Dimensions.get('window').width;

export default function ResultsScreen() {
    const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold });
    const { isColorblindMode } = useAccessibility();

    const [user, setUser] = useState<User | null>(null);
    const [scans, setScans] = useState<Scan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeView, setActiveView] = useState<'list' | 'pie' | 'bar' | 'line'>('list');
    const [chartData, setChartData] = useState<{ pie: any[]; bar: any; line: any } | null>(null);
    const [stats, setStats] = useState({ totalScans: 0, healthyPercentage: 0, mostFrequentDisease: 'N/A' });

    const colors = useMemo(() => ({
        primary: isColorblindMode ? '#0D47A1' : '#66bb6a',
        background: isColorblindMode ? ['rgba(66, 165, 245, 0.15)', 'transparent'] : ['rgba(102, 187, 106, 0.1)', 'transparent'],
        textPrimary: '#333',
        textSecondary: '#666',
        white: '#fff',
        sano: isColorblindMode ? '#42A5F5' : '#2ecc71',
        enfermo: isColorblindMode ? '#0D47A1' : '#e74c3c',
        enfermoAlt1: isColorblindMode ? '#0D47A1' : '#e74c3c', // Rojo
        enfermoAlt2: isColorblindMode ? '#FFC107' : '#e67e22', // Amarillo/Naranja
        enfermoAlt3: isColorblindMode ? '#42A5F5' : '#f1c40f', // Azul Claro/Amarillo
        toggleActive: isColorblindMode ? '#0D47A1' : '#66bb6a',
        toggleInactive: '#e8f5e9',
    }), [isColorblindMode]);

    const chartConfigBase = useMemo(() => ({
        backgroundGradientFromOpacity: 0,
        backgroundGradientToOpacity: 0,
        color: (opacity = 1) => isColorblindMode ? `rgba(13, 71, 161, ${opacity})` : `rgba(50, 50, 50, ${opacity})`,
        strokeWidth: 2,
        barPercentage: 0.8,
        useShadowsForComsOnBar: false,
        propsForDots: { r: "6", strokeWidth: "2", stroke: colors.primary },
        propsForLabels: { fontFamily: 'Poppins_400Regular' }
    }), [isColorblindMode, colors.primary]);
    
    const barChartConfig = useMemo(() => ({
        ...chartConfigBase,
        backgroundGradientFrom: "#f4f4f4",
        backgroundGradientTo: "#f4f4f4",
        color: (opacity = 1) => isColorblindMode ? `rgba(66, 165, 245, ${opacity})` : `rgba(150, 150, 150, ${opacity})`,
        labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
        decimalPlaces: 0,
    }), [isColorblindMode, chartConfigBase]);


    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const fetchScans = async () => {
            if (!user) { setIsLoading(false); return; }
            setIsLoading(true);
            try {
                const { data, error } = await supabase.from('scans').select('*').eq('user_id', user.uid).order('created_at', { ascending: false });
                if (error) throw error;
                if (data) setScans(data);
            } catch (error) {
                console.error("Error al obtener escaneos:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchScans();
    }, [user]);

    useEffect(() => {
        if (scans.length > 0) {
            const counts: { [key: string]: number } = {};
            let healthyCount = 0;
            const scansByDay: { [key: string]: { [label: string]: number } } = {};

            scans.forEach(scan => {
                counts[scan.label] = (counts[scan.label] || 0) + 1;
                if (scan.label.toLowerCase().includes('saludable')) {
                    healthyCount++;
                }
                const date = new Date(scan.created_at).toLocaleDateString('es-MX', {day: '2-digit', month: 'short'});
                if (!scansByDay[date]) scansByDay[date] = {};
                scansByDay[date][scan.label] = (scansByDay[date][scan.label] || 0) + 1;
            });

            const totalScans = scans.length;
            const healthyPercentage = (healthyCount / totalScans) * 100;
            let mostFrequentDisease = 'N/A';
            let maxCount = 0;
            Object.keys(counts).forEach(label => {
                if (!label.toLowerCase().includes('saludable') && counts[label] > maxCount) {
                    maxCount = counts[label];
                    mostFrequentDisease = label;
                }
            });
            setStats({ totalScans, healthyPercentage, mostFrequentDisease });
            
            const DISEASE_COLORS = [colors.enfermoAlt1, colors.enfermoAlt2, colors.enfermoAlt3];
            const pieChartData = Object.keys(counts).map((label, index) => ({
                name: label,
                population: counts[label],
                color: label.toLowerCase().includes('saludable') ? colors.sano : DISEASE_COLORS[index % DISEASE_COLORS.length],
                legendFontColor: "#333",
                legendFontSize: 14,
            }));

            const barChartData = {
                labels: Object.keys(counts),
                datasets: [{ data: Object.values(counts) }]
            };

            const lineChartLabels = Object.keys(scansByDay).reverse();
            const allDiagnoses = Object.keys(counts);
            const lineChartDatasets = allDiagnoses.map((label, index) => ({
                data: lineChartLabels.map(day => scansByDay[day][label] || 0),
                color: (opacity = 1) => label.toLowerCase().includes('saludable') ? `${colors.sano.slice(0, -2)}${opacity})` : `${DISEASE_COLORS[index % DISEASE_COLORS.length].slice(0, -2)}${opacity})`,
                strokeWidth: 3,
            }));

            const lineChartData = {
                labels: lineChartLabels,
                datasets: lineChartDatasets,
                legend: allDiagnoses,
            };

            setChartData({ pie: pieChartData, bar: barChartData, line: lineChartData });
        }
    }, [scans, colors]);

    if (!fontsLoaded) {
        return <ActivityIndicator size="large" color="#66bb6a" style={{ flex: 1, justifyContent: 'center' }} />;
    }
 
    const renderContent = () => {
        if (isLoading) {
            return <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }}/>;
        }
        if (scans.length === 0) {
            return (
                <View style={styles.emptyStateContainer}>
                    <Text style={styles.emptyStateText}>Aún no tienes escaneos.</Text>
                    <Text style={styles.emptyStateSubtext}>Ve a la pestaña "Escanear" para empezar.</Text>
                </View>
            );
        }

        switch (activeView) {
            case 'line':
                return (
                    <View style={styles.chartContainer}>
                        <Text style={styles.chartTitle}>Tendencia de Diagnósticos por Día</Text>
                        {chartData?.line && (
                            <LineChart data={chartData.line} width={screenWidth - 48} height={250} chartConfig={chartConfigBase} bezier style={{ borderRadius: 16 }} />
                        )}
                    </View>
                );
            case 'pie':
                return (
                    <View style={styles.chartContainer}>
                        <Text style={styles.chartTitle}>Distribución de Diagnósticos</Text>
                        {chartData?.pie && <PieChart data={chartData.pie} width={screenWidth - 48} height={200} chartConfig={chartConfigBase} accessor="population" backgroundColor="transparent" paddingLeft="8" absolute />}
                    </View>
                );
            case 'bar':
                return (
                    <View style={styles.chartContainer}>
                        <Text style={styles.chartTitle}>Conteo de Diagnósticos</Text>
                        {chartData?.bar && <BarChart data={chartData.bar} width={screenWidth - 48} height={230} yAxisLabel="" yAxisSuffix="" chartConfig={barChartConfig} style={{ borderRadius: 16 }} fromZero />}
                    </View>
                );
            case 'list':
            default:
                return scans.map((scan) => (
                    <View key={scan.id} style={styles.scanCard}>
                        <Image source={scan.label.toLowerCase().includes('saludable') ? avotexSanoImage : avotexEnfermoImage} style={styles.scanImage} />
                        <View style={styles.scanInfo}>
                            <Text style={[styles.scanLabel, {backgroundColor: scan.label.toLowerCase().includes('saludable') ? colors.sano : colors.enfermo}]}>{scan.label}</Text>
                            <Text style={styles.scanScore}>Confianza: {(scan.score * 100).toFixed(1)}%</Text>
                            <Text style={styles.scanDate}>{formatScanDate(scan.created_at)}</Text>
                        </View>
                    </View>
                ));
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient colors={colors.background} style={styles.gradient} />
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.primary }]}>Resultados</Text>
                <Text style={styles.subtitle}>Historial de análisis</Text>

                <View style={[styles.toggleContainer, { backgroundColor: colors.toggleInactive }]}>
                    <TouchableOpacity onPress={() => setActiveView('list')} style={[styles.toggleButton, activeView === 'list' && { backgroundColor: colors.toggleActive }]}>
                        <List size={20} color={activeView === 'list' ? colors.white : colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setActiveView('pie')} style={[styles.toggleButton, activeView === 'pie' && { backgroundColor: colors.toggleActive }]}>
                        <PieChartIcon size={20} color={activeView === 'pie' ? colors.white : colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setActiveView('bar')} style={[styles.toggleButton, activeView === 'bar' && { backgroundColor: colors.toggleActive }]}>
                        <BarChart3 size={20} color={activeView === 'bar' ? colors.white : colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setActiveView('line')} style={[styles.toggleButton, activeView === 'line' && { backgroundColor: colors.toggleActive }]}>
                        <LineChartIcon size={20} color={activeView === 'line' ? colors.white : colors.primary} />
                    </TouchableOpacity>
                </View>
            </View>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
                {scans.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>Resumen General</Text>
                        <View style={styles.statsRow}>
                            <View style={[styles.statCard, {backgroundColor: '#e8f5e9'}]}>
                                <Text style={styles.statValue}>{stats.totalScans}</Text>
                                <Text style={styles.statLabel}>Escaneos Totales</Text>
                            </View>
                            <View style={[styles.statCard, {backgroundColor: '#fff3e0'}]}>
                                <Text style={styles.statValue}>{stats.healthyPercentage.toFixed(0)}%</Text>
                                <Text style={styles.statLabel}>Saludables</Text>
                            </View>
                        </View>
                        <View style={[styles.statCard, {backgroundColor: '#ffebee', marginBottom: 24 }]}>
                            <Text style={styles.statValue}>{stats.mostFrequentDisease}</Text>
                            <Text style={styles.statLabel}>Enfermedad más común</Text>
                        </View>
                    </>
                )}
                <Text style={styles.sectionTitle}>{activeView === 'list' ? 'Mis Escaneos Recientes' : 'Visualización de Datos'}</Text>
                {renderContent()}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f9f9f9' },
    gradient: { position: 'absolute', left: 0, right: 0, top: 0, height: 300 },
    header: { paddingTop: 60, paddingHorizontal: 24, marginBottom: 12 },
    title: { fontSize: 32, fontFamily: 'Poppins_600SemiBold' },
    subtitle: { fontSize: 16, fontFamily: 'Poppins_400Regular', color: '#666' },
    scrollView: { flex: 1 },
    scrollViewContent: { paddingHorizontal: 24, paddingBottom: 100 },
    sectionTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 20, color: '#2a2a2a', marginBottom: 16, marginTop: 16 },
    emptyStateContainer: { padding: 30, backgroundColor: '#fff', borderRadius: 16, alignItems: 'center', marginTop: 20 },
    emptyStateText: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: '#666' },
    emptyStateSubtext: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: '#999', marginTop: 4 },
    scanCard: { backgroundColor: '#ffffff', borderRadius: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 5, flexDirection: 'row', overflow: 'hidden' },
    scanImage: { width: 100, height: '100%', resizeMode: 'cover' },
    scanInfo: { flex: 1, padding: 12, justifyContent: 'center' },
    scanLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: '#fff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', overflow: 'hidden', marginBottom: 6 },
    sano: { backgroundColor: '#2ecc71' },
    enfermo: { backgroundColor: '#e74c3c' },
    scanScore: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: '#2a2a2a' },
    scanDate: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: '#999', marginTop: 6 },
    toggleContainer: { flexDirection: 'row', backgroundColor: '#e8f5e9', borderRadius: 25, marginTop: 20, alignSelf: 'center', padding: 4 },
    toggleButton: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20 },
    toggleButtonActive: { backgroundColor: '#66bb6a' },
    chartContainer: { alignItems: 'center', marginBottom: 24, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 5 },
    chartTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 18, color: '#333', marginTop: 8, marginBottom: 12 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    statCard: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, marginHorizontal: 4 },
    statValue: { fontFamily: 'Poppins_600SemiBold', fontSize: 24, color: '#333' },
    statLabel: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: '#555', marginTop: 4 },
});