import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  Image, TouchableOpacity, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Poppins_400Regular, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { auth } from '../../firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import { supabase } from '../../supabaseConfig';
import { BarChart, PieChart, LineChart } from 'react-native-chart-kit';
import { PieChart as PieChartIcon, List } from 'lucide-react-native';
import { useAccessibility } from '../../context/AccessibilityContext';
import { useFocusEffect } from 'expo-router';

const avotexSanoImage    = require('../../assets/images/avotexSano.png');
const avotexEnfermoImage = require('../../assets/images/avotexEnfermo.png');

const FRUIT_REMOTE_IMAGES: Record<string, string> = {
  limon:    'https://cdn.aarp.net/content/dam/aarpe/es/home/cocina/dieta-y-nutricion/info-10-2013/fotos-limon-beneficios/_jcr_content/root/container_main/container_body_main/list_container_body2/container_body_cf/body_two_cf_listicle_ten/cfimage.coreimg.50.932.jpeg/content/dam/aarp/food/diet_nutrition/2017/12/1140-lime-juice-lemon-benefits-esp.jpg',
  mango:    'https://cdn.myikas.com/images/0fc5e2e6-3ea7-443f-a09e-daf74b83e708/8ff8ba6b-d866-4e48-88c7-44e07abc07e2/3840/mango.webp',
  guayaba:  'https://clickabasto.com/cdn/shop/products/IMG_1458_665x462.jpg?v=1655783207',
  granada:  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQoNOSa7eeyMktiOgpxYd8BV95f3PTgPnzHcg&s',
  cafe:     'https://cdn.alsuper.com/products/420910_p.webp',
};

const FRUIT_EMOJI: Record<string, string> = {
  aguacate: '🥑', mango: '🥭', limon: '🍋',
  guayaba: '🍈', granada: '🍎', cafe: '☕',
};

const CHART_COLORS = [
  '#ef4444', '#e67e22', '#f1c40f', '#9b59b6',
  '#3498db', '#1abc9c', '#e91e63', '#ff5722',
];

const norm = (s: string) =>
  (s ?? '').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

const getFruitImageSource = (fruto: string | undefined | null, healthy: boolean) => {
  const key = norm(fruto ?? '');
  if (!fruto || key === 'aguacate') {
    return healthy ? avotexSanoImage : avotexEnfermoImage;
  }
  const url = FRUIT_REMOTE_IMAGES[key] ?? null;
  if (url) return { uri: url };
  return healthy ? avotexSanoImage : avotexEnfermoImage;
};

const getFruitEmoji = (fruto: string | undefined | null) =>
  FRUIT_EMOJI[norm(fruto ?? '')] ?? '🍑';

const hexToRgba = (hex: string, opacity: number) => {
  if (hex.startsWith('rgba')) return hex;
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    let c: any = hex.substring(1).split('');
    if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    c = '0x' + c.join('');
    return `rgba(${[(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',')},${opacity})`;
  }
  return `rgba(102,187,106,${opacity})`;
};

const formatScanDate = (d: string) => {
  const date = new Date(d);
  return (
    date.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }) +
    ' ' + date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  );
};

const isHealthyLabel = (label: string) =>
  ['saludable', 'healthy', 'sano', 'fresh', 'fresco'].some(h => label.toLowerCase().includes(h));

// ── Types ─────────────────────────────────────────────────────────────────
interface Scan {
  id: number;
  created_at: string;
  user_id: string;
  user_email: string;
  label: string;
  score: number;
  fruto?: string;
}

// ── Component ─────────────────────────────────────────────────────────────
export default function ResultsScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const isTablet = screenWidth >= 768;
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold });
  const { isColorblindMode } = useAccessibility();

  const [user, setUser]           = useState<User | null>(null);
  const [scans, setScans]         = useState<Scan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeView, setActiveView]       = useState<'list' | 'charts'>('list');
  const [listFruitFilter, setListFruitFilter] = useState<string | null>(null);
  const [chartFruit, setChartFruit]       = useState<string | null>(null);

  const colors = useMemo(() => ({
    primary:        isColorblindMode ? '#0D47A1' : '#66bb6a',
    sano:           isColorblindMode ? '#42A5F5' : '#10b981',
    enfermo:        isColorblindMode ? '#0D47A1' : '#ef4444',
    toggleActive:   isColorblindMode ? '#0D47A1' : '#66bb6a',
    toggleInactive: isColorblindMode ? '#D1E7FD' : '#e8f5e9',
    white:          '#fff',
  }), [isColorblindMode]);

  const chartConfigBase = useMemo(() => ({
    backgroundGradientFromOpacity: 0,
    backgroundGradientToOpacity:   0,
    color: (opacity = 1) => `rgba(50,50,50,${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.7,
    propsForLabels: { fontFamily: 'Poppins_400Regular', fontSize: 10 },
    decimalPlaces: 0,
  }), []);

  const barChartConfig = useMemo(() => ({
    ...chartConfigBase,
    backgroundGradientFrom: '#fafafa',
    backgroundGradientTo:   '#fafafa',
    color: (opacity = 1) => `rgba(102,187,106,${opacity})`,
    labelColor: (opacity = 1) => `rgba(80,80,80,${opacity})`,
  }), [chartConfigBase]);

  // ── Auth ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return () => unsub();
  }, []);

  // ── Fetch — solo cuando la pantalla entra en foco ─────────────────────
  // No re-renderiza si no hubo cambios (compara length e id del más reciente).
  useFocusEffect(
    useCallback(() => {
      if (!user) { setIsLoading(false); return; }

      supabase
        .from('scans')
        .select('*')
        .eq('user_id', user.uid)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (!error && data) {
            setScans(prev => {
              // Solo actualiza el estado si realmente hay datos nuevos
              if (
                prev.length !== data.length ||
                prev[0]?.id !== data[0]?.id
              ) {
                return data;
              }
              return prev; // sin cambios → React no re-renderiza
            });
          }
          setIsLoading(false);
        });
    }, [user])
  );

  // ── Group by fruit ────────────────────────────────────────────────────
  const scansByFruit = useMemo<Record<string, Scan[]>>(() => {
    const g: Record<string, Scan[]> = {};
    scans.forEach(s => {
      const f = s.fruto ?? 'Aguacate';
      if (!g[f]) g[f] = [];
      g[f].push(s);
    });
    return g;
  }, [scans]);

  const allFruits = useMemo(() => Object.keys(scansByFruit).sort(), [scansByFruit]);

  // Auto-select first fruit when switching to charts
  useEffect(() => {
    if (activeView === 'charts' && !chartFruit && allFruits.length > 0) {
      setChartFruit(allFruits[0]);
    }
  }, [activeView, allFruits, chartFruit]);

  // ── Stats (all scans) ─────────────────────────────────────────────────
  const globalStats = useMemo(() => {
    const total   = scans.length;
    const healthy = scans.filter(s => isHealthyLabel(s.label)).length;
    const pct     = total > 0 ? (healthy / total) * 100 : 0;
    const counts: Record<string, number> = {};
    scans.forEach(s => { if (!isHealthyLabel(s.label)) counts[s.label] = (counts[s.label] || 0) + 1; });
    const most = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Ninguna';
    return { total, pct, most };
  }, [scans]);

  // ── Chart data for the selected fruit ─────────────────────────────────
  const selectedFruitScans = useMemo(
    () => (chartFruit ? scansByFruit[chartFruit] ?? [] : []),
    [chartFruit, scansByFruit]
  );

  const labelCounts = useMemo(() => {
    const c: Record<string, number> = {};
    selectedFruitScans.forEach(s => { c[s.label] = (c[s.label] || 0) + 1; });
    return c;
  }, [selectedFruitScans]);

  const pieData = useMemo(() =>
    Object.keys(labelCounts).map((label, i) => ({
      name: label,
      population: labelCounts[label],
      color: isHealthyLabel(label) ? colors.sano : CHART_COLORS[i % CHART_COLORS.length],
      legendFontColor: '#333',
      legendFontSize: 11,
    })), [labelCounts, colors.sano]);

  const barData = useMemo(() => ({
    labels: Object.keys(labelCounts).map(l => l.length > 10 ? l.substring(0, 10) + '…' : l),
    datasets: [{ data: Object.values(labelCounts).length ? Object.values(labelCounts) : [0] }],
  }), [labelCounts]);

  const lineData = useMemo(() => {
    const byDay: Record<string, Record<string, number>> = {};
    selectedFruitScans.forEach(s => {
      const day = new Date(s.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
      if (!byDay[day]) byDay[day] = {};
      byDay[day][s.label] = (byDay[day][s.label] || 0) + 1;
    });
    const labels = Object.keys(byDay).reverse();
    const diagnoses = Object.keys(labelCounts);
    const datasets = diagnoses.map((label, i) => {
      const base = isHealthyLabel(label) ? colors.sano : CHART_COLORS[i % CHART_COLORS.length];
      return {
        data: labels.map(day => byDay[day]?.[label] || 0),
        color: (opacity = 1) => hexToRgba(base, opacity),
        strokeWidth: 3,
      };
    });
    return { labels, datasets, legend: diagnoses };
  }, [selectedFruitScans, labelCounts, colors.sano]);

  const chartWidth = isTablet ? Math.min(screenWidth - 96, 680) : screenWidth - 52;

  if (!fontsLoaded) return <ActivityIndicator size="large" color="#66bb6a" style={{ flex: 1 }} />;

  // ── Sub-renderers ─────────────────────────────────────────────────────

  const renderListFilterChips = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginBottom: 12 }}
      contentContainerStyle={styles.chipRow}
    >
      <TouchableOpacity
        style={[styles.chip, !listFruitFilter && { backgroundColor: colors.toggleActive }]}
        onPress={() => setListFruitFilter(null)}
      >
        <Text style={[styles.chipText, !listFruitFilter && { color: '#fff' }]}>
          🌿 Todos ({scans.length})
        </Text>
      </TouchableOpacity>
      {allFruits.map(fruit => (
        <TouchableOpacity
          key={fruit}
          style={[
            styles.chip,
            listFruitFilter === fruit && { backgroundColor: colors.toggleActive },
          ]}
          onPress={() => setListFruitFilter(listFruitFilter === fruit ? null : fruit)}
        >
          <Text style={[styles.chipText, listFruitFilter === fruit && { color: '#fff' }]}>
            {getFruitEmoji(fruit)} {fruit} ({scansByFruit[fruit]?.length ?? 0})
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderChartFruitChips = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginBottom: 16 }}
      contentContainerStyle={styles.chipRow}
    >
      {allFruits.map(fruit => (
        <TouchableOpacity
          key={fruit}
          style={[
            styles.chip,
            chartFruit === fruit && { backgroundColor: colors.toggleActive },
          ]}
          onPress={() => setChartFruit(fruit)}
        >
          <Text style={[styles.chipText, chartFruit === fruit && { color: '#fff' }]}>
            {getFruitEmoji(fruit)} {fruit}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderList = () => {
    const toShow = listFruitFilter
      ? (scansByFruit[listFruitFilter] ?? [])
      : scans;

    if (toShow.length === 0)
      return (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Sin escaneos para esta fruta.</Text>
        </View>
      );

    return toShow.map(scan => {
      const healthy = isHealthyLabel(scan.label);
      const fruto   = scan.fruto ?? 'Aguacate';
      const imgSrc  = getFruitImageSource(fruto, healthy);

      return (
        <View key={scan.id} style={styles.scanCard}>
          <Image source={imgSrc} style={styles.scanImage} />
          <View style={styles.scanInfo}>
            <View style={styles.fruitBadge}>
              <Text style={styles.fruitBadgeText}>
                {getFruitEmoji(fruto)} {fruto}
              </Text>
            </View>
            <Text style={[
              styles.scanLabel,
              { backgroundColor: healthy ? colors.sano : colors.enfermo },
            ]}>
              {scan.label}
            </Text>
            <Text style={styles.scanScore}>
              Confianza: {(scan.score * 100).toFixed(1)}%
            </Text>
            <Text style={styles.scanDate}>{formatScanDate(scan.created_at)}</Text>
          </View>
        </View>
      );
    });
  };

  const renderCharts = () => {
    if (!chartFruit) return null;
    const fruitScans = scansByFruit[chartFruit] ?? [];

    if (fruitScans.length === 0)
      return (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Sin datos para {chartFruit}.</Text>
        </View>
      );

    return (
      <View>
        {/* ── Pie chart ─────────────────────────────────────────── */}
        <View style={styles.chartCard}>
          <View style={styles.chartCardHeader}>
            <Image
              source={getFruitImageSource(chartFruit, true)}
              style={styles.chartThumb}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.chartCardTitle}>
                {getFruitEmoji(chartFruit)} {chartFruit}
              </Text>
              <Text style={styles.chartCardSub}>
                Distribución · {fruitScans.length} escaneos
              </Text>
            </View>
          </View>
          {pieData.length > 0 && (
            <PieChart
              data={pieData}
              width={chartWidth}
              height={190}
              chartConfig={chartConfigBase}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="8"
              absolute
            />
          )}
        </View>

        {/* ── Bar chart ─────────────────────────────────────────── */}
        <View style={styles.chartCard}>
          <Text style={styles.chartCardTitle}>
            {getFruitEmoji(chartFruit)} {chartFruit} — Conteo por diagnóstico
          </Text>
          <BarChart
            data={barData}
            width={chartWidth}
            height={210}
            yAxisLabel=""
            yAxisSuffix=""
            chartConfig={barChartConfig}
            style={{ borderRadius: 12, marginTop: 10 }}
            fromZero
            showValuesOnTopOfBars
          />
        </View>

        {/* ── Line chart (only when there are multiple days) ───── */}
        {lineData.labels.length > 1 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartCardTitle}>
              {getFruitEmoji(chartFruit)} {chartFruit} — Tendencia temporal
            </Text>
            <LineChart
              data={lineData}
              width={chartWidth}
              height={210}
              chartConfig={chartConfigBase}
              bezier
              style={{ borderRadius: 12, marginTop: 10 }}
            />
          </View>
        )}
      </View>
    );
  };

  const renderContent = () => {
    if (isLoading)
      return <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />;

    if (scans.length === 0)
      return (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Aún no tienes escaneos.</Text>
          <Text style={styles.emptySubtext}>Ve a "Escanear" para empezar.</Text>
        </View>
      );

    if (activeView === 'list') {
      return (
        <>
          {allFruits.length > 1 && renderListFilterChips()}
          <Text style={styles.sectionTitle}>
            Mis Escaneos Recientes
            {listFruitFilter ? ` — ${getFruitEmoji(listFruitFilter)} ${listFruitFilter}` : ''}
          </Text>
          {renderList()}
        </>
      );
    }

    return (
      <>
        {allFruits.length > 1 && renderChartFruitChips()}
        <Text style={styles.sectionTitle}>
          Gráficas — {chartFruit ? `${getFruitEmoji(chartFruit)} ${chartFruit}` : ''}
        </Text>
        {renderCharts()}
      </>
    );
  };

  // ── Main JSX ──────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#a7f3d0', '#ecfdf5', '#ffffff']}
        locations={[0, 0.38, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={[styles.header, isTablet && styles.headerTablet]}>
        <Text style={[styles.title, { color: colors.primary }, isTablet && styles.titleTablet]}>
          Resultados
        </Text>
        <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]}>
          Historial de análisis
        </Text>

        <View style={[styles.toggleRow, { backgroundColor: colors.toggleInactive }]}>
          <TouchableOpacity
            style={[styles.toggleBtn, activeView === 'list' && { backgroundColor: colors.toggleActive }]}
            onPress={() => setActiveView('list')}
          >
            <List size={isTablet ? 24 : 20} color={activeView === 'list' ? '#fff' : colors.primary} />
            <Text style={[styles.toggleLabel, activeView === 'list' && { color: '#fff' }]}>Lista</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, activeView === 'charts' && { backgroundColor: colors.toggleActive }]}
            onPress={() => setActiveView('charts')}
          >
            <PieChartIcon size={isTablet ? 24 : 20} color={activeView === 'charts' ? '#fff' : colors.primary} />
            <Text style={[styles.toggleLabel, activeView === 'charts' && { color: '#fff' }]}>Gráficas</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
      >
        {/* Global stats pill */}
        {!isLoading && scans.length > 0 && (
          <View style={styles.statsCard}>
            <Text style={styles.statLine}>
              <Text style={styles.statNum}>{globalStats.total}</Text>
              <Text style={styles.statLabel}> escaneos  ·  </Text>
              <Text style={[styles.statNum, { color: colors.sano }]}>{globalStats.pct.toFixed(0)}%</Text>
              <Text style={[styles.statLabel, { color: colors.sano }]}> saludables  ·  </Text>
              <Text style={[styles.statNum, { color: colors.enfermo }]}>{globalStats.most}</Text>
              <Text style={[styles.statLabel, { color: colors.enfermo }]}> más frecuente</Text>
            </Text>
          </View>
        )}

        {renderContent()}
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },

  header:        { paddingTop: 60, paddingHorizontal: 24, marginBottom: 12, alignItems: 'center' },
  headerTablet:  { paddingTop: 80, paddingHorizontal: 40 },
  title:         { fontSize: 32, fontFamily: 'Poppins_600SemiBold' },
  titleTablet:   { fontSize: 40 },
  subtitle:      { fontSize: 15, fontFamily: 'Poppins_400Regular', color: '#666', marginBottom: 4 },
  subtitleTablet:{ fontSize: 19 },

  toggleRow:   { flexDirection: 'row', borderRadius: 30, marginTop: 14, padding: 4, gap: 4 },
  toggleBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 18, borderRadius: 24 },
  toggleLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: '#2e7d32' },

  scrollView:         { flex: 1 },
  scrollContent:      { paddingHorizontal: 24, paddingBottom: 120 },
  scrollContentTablet:{ paddingHorizontal: 48 },

  statsCard: {
    backgroundColor: '#fff', borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statLine:  { textAlign: 'center', flexWrap: 'wrap' },
  statNum:   { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: '#333' },
  statLabel: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: '#666' },

  chipRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  chip: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: '#e8f5e9', borderWidth: 1, borderColor: '#c8e6c9',
  },
  chipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#2e7d32' },

  sectionTitle: {
    fontFamily: 'Poppins_600SemiBold', fontSize: 18, color: '#2a2a2a',
    marginBottom: 14, marginTop: 4,
  },

  scanCard: {
    backgroundColor: '#fff', borderRadius: 16, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
    flexDirection: 'row', overflow: 'hidden',
  },
  scanImage: { width: 100, height: 110, resizeMode: 'cover' },
  scanInfo:  { flex: 1, padding: 12, justifyContent: 'center' },
  fruitBadge: {
    backgroundColor: '#f0fdf4', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: 'flex-start', marginBottom: 6,
    borderWidth: 1, borderColor: '#bbf7d0',
  },
  fruitBadgeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#166534' },
  scanLabel: {
    fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: '#fff',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    alignSelf: 'flex-start', overflow: 'hidden', marginBottom: 6,
  },
  scanScore: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: '#2a2a2a' },
  scanDate:  { fontFamily: 'Poppins_400Regular', fontSize: 11, color: '#999', marginTop: 4 },

  chartCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 4,
  },
  chartCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12,
  },
  chartThumb:     { width: 48, height: 48, borderRadius: 12, resizeMode: 'cover' },
  chartCardTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#1a1a1a' },
  chartCardSub:   { fontFamily: 'Poppins_400Regular', fontSize: 12, color: '#666', marginTop: 2 },

  emptyBox: {
    backgroundColor: '#fff', borderRadius: 16, padding: 30,
    alignItems: 'center', marginTop: 10,
  },
  emptyText:    { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#666' },
  emptySubtext: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: '#999', marginTop: 4 },
});