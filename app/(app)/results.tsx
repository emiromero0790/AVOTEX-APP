import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  Image, TouchableOpacity, useWindowDimensions,
} from 'react-native';
import { useFonts, Poppins_400Regular, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { auth } from '../../firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import { supabase } from '../../supabaseConfig';
import { PieChart as PieChartIcon, List, CalendarDays } from 'lucide-react-native';
import { useAccessibility } from '../../context/AccessibilityContext';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

const avotexSanoImage    = require('../../assets/images/avotexSano.png');
const avotexEnfermoImage = require('../../assets/images/avotexEnfermo.png');

const FRUIT_REMOTE_IMAGES: Record<string, string> = {
  limon:    'https://cdn.aarp.net/content/dam/aarpe/es/home/cocina/dieta-y-nutricion/info-10-2013/fotos-limon-beneficios/_jcr_content/root/container_main/container_body_main/list_container_body2/container_body_cf/body_two_cf_listicle_ten/cfimage.coreimg.50.932.jpeg/content/dam/aarp/food/diet_nutrition/2017/12/1140-lime-juice-lemon-benefits-esp.jpg',
  mango:    'https://cdn.myikas.com/images/0fc5e2e6-3ea7-443f-a09e-daf74b83e708/8ff8ba6b-d866-4e48-88c7-44e07abc07e2/3840/mango.webp',
  guayaba:  'https://clickabasto.com/cdn/shop/products/IMG_1458_665x462.jpg?v=1655783207',
  granada:  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQoNOSa7eeyMktiOgpxYd8BV95f3PTgPnzHcg&s',
  cafe:     'https://cdn.alsuper.com/products/420910_p.webp',
};


const CHART_COLORS = [
  '#9B8AFB', '#F3A6C8', '#F6D365', '#75C9C3',
  '#B8A7E8', '#F2B5A7', '#A9D8B8', '#C8B6E8',
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

const getFruitEmoji = (_fruto: string | undefined | null) => '';

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
  const { view } = useLocalSearchParams<{ view?: string }>();

  const [user, setUser]           = useState<User | null>(null);
  const [scans, setScans]         = useState<Scan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeView, setActiveView]       = useState<'list' | 'charts'>('charts');
  const [listFruitFilter, setListFruitFilter] = useState<string | null>(null);
  const [chartFruit, setChartFruit]       = useState<string | null>(null);

  const colors = useMemo(() => ({
    primary:        isColorblindMode ? '#145DA0' : '#0F766E',
    sano:           isColorblindMode ? '#3B82C4' : '#16877E',
    enfermo:        isColorblindMode ? '#145DA0' : '#C75C4B',
    toggleActive:   isColorblindMode ? '#145DA0' : '#0F766E',
    toggleInactive: isColorblindMode ? '#E4F0FA' : '#E1F2EF',
    white:          '#fff',
  }), [isColorblindMode]);

  // ── Auth ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (view === 'list' || view === 'charts') setActiveView(view);
  }, [view]);

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

  const fruitRanking = useMemo(() => allFruits
    .map(fruit => ({ fruit, count: scansByFruit[fruit]?.length ?? 0 }))
    .sort((a, b) => b.count - a.count), [allFruits, scansByFruit]);

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

  const maxLabelCount = Math.max(1, ...Object.values(labelCounts));
  const maxDailyCount = Math.max(
    1,
    ...lineData.datasets.flatMap(dataset => dataset.data),
  );

  if (!fontsLoaded) return <ActivityIndicator size="large" color="#0F766E" style={{ flex: 1 }} />;

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
          Todos ({scans.length})
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

    return toShow.map((scan, index) => {
      const healthy = isHealthyLabel(scan.label);
      const fruto   = scan.fruto ?? 'Aguacate';
      const imgSrc  = getFruitImageSource(fruto, healthy);

      return (
        <View key={`${scan.id ?? 'scan'}-${scan.created_at}-${scan.user_id}-${index}`} style={styles.scanCard}>
          <Image source={imgSrc} style={styles.scanImage} />
          <View style={styles.scanInfo}>
            <Text style={styles.fruitName}>{fruto}</Text>
            <Text style={[styles.scanLabel, { color: healthy ? colors.sano : colors.enfermo }]} numberOfLines={1}>
              {scan.label}
            </Text>
            <Text style={styles.scanDate}>{formatScanDate(scan.created_at)}</Text>
          </View>
          <View style={styles.scanSparkline}>
            {[0.62, 0.8, 0.7, 0.92, 0.76, 1].map((factor, barIndex) => (
              <View
                key={barIndex}
                style={[
                  styles.scanSparkBar,
                  {
                    height: Math.max(5, Math.min(28, scan.score * factor * 28)),
                    backgroundColor: healthy ? '#8B5CF6' : '#E66A7A',
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.scanScoreColumn}>
            <Text style={styles.scanScoreValue}>{(scan.score * 100).toFixed(1)}%</Text>
            <Text style={[styles.scanScoreCaption, { color: healthy ? colors.sano : colors.enfermo }]}>score</Text>
          </View>
        </View>
      );
    });
  };

  const renderCharts = () => {
    if (!chartFruit) return null;
    const fruitScans = scansByFruit[chartFruit] ?? [];
    const confidenceSeries = [...fruitScans].slice(0, 12).reverse();
    const averageConfidence = fruitScans.length
      ? fruitScans.reduce((sum, scan) => sum + scan.score, 0) / fruitScans.length
      : 0;

    if (fruitScans.length === 0)
      return (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Sin datos para {chartFruit}.</Text>
        </View>
      );

    return (
      <View>
        {/* ── Dark confidence chart ─────────────────────────────── */}
        <View style={styles.darkChartCard}>
          <View style={styles.darkChartHeader}>
            <View>
              <Text style={styles.darkChartEyebrow}>CONFIANZA</Text>
              <Text style={styles.darkChartTitle}>{chartFruit} · evolución</Text>
            </View>
            <View style={styles.darkChartValuePill}>
              <Text style={styles.darkChartValue}>{(averageConfidence * 100).toFixed(1)}%</Text>
            </View>
          </View>
          <View style={styles.darkChartControls}>
            <View style={styles.darkChartControlActive}><Text style={styles.darkChartControlActiveText}>Historial</Text></View>
            <Text style={styles.darkChartControlText}>{confidenceSeries.length} análisis</Text>
          </View>
          <View style={styles.marketChart}>
            {[0, 1, 2, 3].map(line => <View key={line} style={[styles.marketGridLine, { top: `${line * 30 + 7}%` }]} />)}
            <View style={styles.marketColumns}>
              {confidenceSeries.map((scan, index) => {
                const value = Math.max(0.08, Math.min(1, scan.score));
                const barHeight = 22 + value * 82;
                const healthy = isHealthyLabel(scan.label);
                return (
                  <View key={`${scan.id}-${index}`} style={styles.marketColumn}>
                    <View style={[styles.marketWick, { height: barHeight + 18 }]} />
                    <View
                      style={[
                        styles.marketCandle,
                        {
                          height: barHeight,
                          backgroundColor: healthy ? '#C8FF28' : '#8B36F4',
                        },
                      ]}
                    />
                  </View>
                );
              })}
            </View>
            <View style={styles.marketAverageLine} />
            <View style={styles.marketAverageLabel}>
              <Text style={styles.marketAverageText}>{(averageConfidence * 100).toFixed(0)}</Text>
            </View>
          </View>
          <View style={styles.darkChartLegend}>
            <View style={styles.darkLegendItem}><View style={[styles.darkLegendDot, { backgroundColor: '#C8FF28' }]} /><Text style={styles.darkLegendText}>Saludable</Text></View>
            <View style={styles.darkLegendItem}><View style={[styles.darkLegendDot, { backgroundColor: '#8B36F4' }]} /><Text style={styles.darkLegendText}>Con hallazgos</Text></View>
          </View>
        </View>

        {/* ── Dark diagnosis chart ──────────────────────────────── */}
        <View style={styles.darkChartCard}>
          <View style={styles.darkChartHeader}>
            <View>
              <Text style={styles.darkChartEyebrow}>DIAGNÓSTICOS</Text>
              <Text style={styles.darkChartTitle}>Distribución actual</Text>
            </View>
            <Text style={styles.darkChartTotal}>{fruitScans.length}</Text>
          </View>
          <View style={styles.darkDiagnosisBars}>
            {Object.entries(labelCounts).map(([label, count], index) => (
              <View key={label} style={styles.darkDiagnosisRow}>
                <View style={styles.darkDiagnosisLabels}>
                  <Text style={styles.darkDiagnosisLabel} numberOfLines={1}>{label}</Text>
                  <Text style={styles.darkDiagnosisValue}>{count}</Text>
                </View>
                <View style={styles.darkDiagnosisTrack}>
                  <View style={[styles.darkDiagnosisFill, {
                    width: `${Math.max(8, (count / maxLabelCount) * 100)}%`,
                    backgroundColor: isHealthyLabel(label) ? '#C8FF28' : CHART_COLORS[index % CHART_COLORS.length],
                  }]} />
                </View>
              </View>
            ))}
          </View>
        </View>

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
            <View style={styles.webDistribution}>
              {pieData.map(item => {
                const percentage = Math.round((item.population / fruitScans.length) * 100);
                return (
                  <View key={item.name} style={styles.webDistributionRow}>
                    <View style={[styles.webLegendDot, { backgroundColor: item.color }]} />
                    <View style={styles.webDistributionInfo}>
                      <View style={styles.webDistributionLabels}>
                        <Text style={styles.webChartLabel}>{item.name}</Text>
                        <Text style={styles.webChartValue}>{item.population} · {percentage}%</Text>
                      </View>
                      <View style={styles.webTrack}>
                        <View
                          style={[
                            styles.webTrackFill,
                            { width: `${percentage}%`, backgroundColor: item.color },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Bar chart ─────────────────────────────────────────── */}
        <View style={styles.chartCard}>
          <Text style={styles.chartCardTitle}>
            {getFruitEmoji(chartFruit)} {chartFruit} — Conteo por diagnóstico
          </Text>
          <View style={styles.webBars}>
              {Object.entries(labelCounts).map(([label, count], index) => (
                <View key={label} style={styles.webBarRow}>
                  <Text style={styles.webBarLabel} numberOfLines={1}>{label}</Text>
                  <View style={styles.webBarTrack}>
                    <View
                      style={[
                        styles.webBarFill,
                        {
                          width: `${Math.max(6, (count / maxLabelCount) * 100)}%`,
                          backgroundColor: isHealthyLabel(label)
                            ? colors.sano
                            : CHART_COLORS[index % CHART_COLORS.length],
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.webBarValue}>{count}</Text>
                </View>
              ))}
          </View>
        </View>

        {/* ── Line chart (only when there are multiple days) ───── */}
        {lineData.labels.length > 1 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartCardTitle}>
              {getFruitEmoji(chartFruit)} {chartFruit} — Tendencia temporal
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.webTimeline}>
                  {lineData.labels.map((day, dayIndex) => (
                    <View key={`${day}-${dayIndex}`} style={styles.webTimelineDay}>
                      <View style={styles.webTimelinePlot}>
                        {lineData.datasets.map((dataset, datasetIndex) => {
                          const value = dataset.data[dayIndex] ?? 0;
                          return (
                            <View
                              key={`${day}-${lineData.legend[datasetIndex]}`}
                              style={[
                                styles.webTimelineColumn,
                                {
                                  height: Math.max(5, (value / maxDailyCount) * 112),
                                  backgroundColor: dataset.color(1),
                                },
                              ]}
                            />
                          );
                        })}
                      </View>
                      <Text style={styles.webTimelineLabel}>{day}</Text>
                    </View>
                  ))}
                </View>
            </ScrollView>
          </View>
        )}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Frutos más escaneados</Text>
          <Text style={styles.summarySubtitle}>Distribución de tus análisis registrados</Text>
          {fruitRanking.map(({ fruit, count }, index) => {
            const percentage = Math.round((count / Math.max(1, scans.length)) * 100);
            return (
              <View key={fruit} style={styles.summaryRow}>
                <Image source={getFruitImageSource(fruit, true)} style={styles.summaryImage} />
                <View style={styles.summaryInfo}>
                  <View style={styles.summaryLabels}>
                    <Text style={styles.summaryFruit}>{fruit}</Text>
                    <Text style={styles.summaryCount}>{count} · {percentage}%</Text>
                  </View>
                  <View style={styles.summaryTrack}>
                    <View style={[styles.summaryFill, {
                      width: `${Math.max(5, percentage)}%`,
                      backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                    }]} />
                  </View>
                </View>
              </View>
            );
          })}
        </View>
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
      <View style={StyleSheet.absoluteFillObject} />

      {/* Header */}
      <View style={[styles.header, isTablet && styles.headerTablet]}>
        <Text style={[styles.title, { color: colors.primary }, isTablet && styles.titleTablet]}>
          Actividad
        </Text>
        <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]}>
          Historial de análisis
        </Text>

        <View style={[styles.toggleRow, { backgroundColor: colors.toggleInactive }]}>
          <TouchableOpacity
            style={[styles.toggleBtn, activeView === 'charts' && { backgroundColor: colors.toggleActive }]}
            onPress={() => setActiveView('charts')}
          >
            <PieChartIcon size={isTablet ? 24 : 20} color={activeView === 'charts' ? '#fff' : colors.primary} />
            <Text style={[styles.toggleLabel, activeView === 'charts' && { color: '#fff' }]}>Gráficas</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, activeView === 'list' && { backgroundColor: colors.toggleActive }]}
            onPress={() => setActiveView('list')}
          >
            <List size={isTablet ? 24 : 20} color={activeView === 'list' ? '#fff' : colors.primary} />
            <Text style={[styles.toggleLabel, activeView === 'list' && { color: '#fff' }]}>Lista</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toggleBtn}
            onPress={() => router.push('/(app)/agenda')}
          >
            <CalendarDays size={isTablet ? 24 : 20} color={colors.primary} />
            <Text style={styles.toggleLabel}>Agenda</Text>
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
  container: { flex: 1, backgroundColor: '#F5F8F7' },

  header:        { paddingTop: 54, paddingHorizontal: 24, marginBottom: 12, alignItems: 'flex-start' },
  headerTablet:  { paddingTop: 80, paddingHorizontal: 40 },
   title:         { fontSize: 32, fontFamily: 'Poppins_600SemiBold', color: '#123B3A' },
  titleTablet:   { fontSize: 40 },
  subtitle:      { fontSize: 15, fontFamily: 'Poppins_400Regular', color: '#66807D', marginBottom: 4 },
  subtitleTablet:{ fontSize: 19 },

  toggleRow:   { flexDirection: 'row', borderRadius: 16, marginTop: 14, padding: 4, gap: 4, alignSelf: 'stretch' },
  toggleBtn:   { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 5, borderRadius: 24 },
  toggleLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#2e7d32' },

  scrollView:         { flex: 1 },
  scrollContent:      { paddingHorizontal: 24, paddingBottom: 120 },
  scrollContentTablet:{ paddingHorizontal: 48 },

  statsCard: {
    backgroundColor: '#E7F2EF', borderRadius: 18,
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
    backgroundColor: '#E8F3F1', borderWidth: 1, borderColor: '#C5DFDA',
  },
  chipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#2e7d32' },

  sectionTitle: {
    fontFamily: 'Poppins_600SemiBold', fontSize: 18, color: '#163F3D',
    marginBottom: 14, marginTop: 4,
  },

  scanCard: {
    minHeight: 82, backgroundColor: '#FFFFFF', borderRadius: 18, marginBottom: 10,
    paddingHorizontal: 10, paddingVertical: 9,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
    flexDirection: 'row', alignItems: 'center',
  },
  scanImage: { width: 52, height: 52, borderRadius: 14, resizeMode: 'cover', marginRight: 10 },
  scanInfo:  { flex: 1, minWidth: 0, justifyContent: 'center' },
  fruitName: {
    fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: '#17151C',
  },
  scanLabel: {
    fontFamily: 'Poppins_400Regular', fontSize: 10.5, marginTop: 1,
  },
  scanDate:  { fontFamily: 'Poppins_400Regular', fontSize: 8.5, color: '#A19DA6', marginTop: 2 },
  scanSparkline: {
    width: 55, height: 30, marginHorizontal: 8,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 2,
  },
  scanSparkBar: { width: 3, minHeight: 5, borderRadius: 2 },
  scanScoreColumn: { width: 57, alignItems: 'flex-end', justifyContent: 'center' },
  scanScoreValue: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#17151C' },
  scanScoreCaption: { fontFamily: 'Poppins_600SemiBold', fontSize: 9, marginTop: 1 },

  darkChartCard: {
    backgroundColor: '#101016', borderRadius: 20, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#24232E',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 14, elevation: 7,
  },
  darkChartHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  darkChartEyebrow: {
    fontFamily: 'Poppins_600SemiBold', fontSize: 9, letterSpacing: 1.2, color: '#858391',
  },
  darkChartTitle: {
    fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: '#FFFFFF', marginTop: 2,
  },
  darkChartValuePill: {
    backgroundColor: '#C8FF28', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5,
  },
  darkChartValue: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: '#14180A' },
  darkChartControls: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 13, marginBottom: 5,
  },
  darkChartControlActive: {
    borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#272630',
  },
  darkChartControlActiveText: { fontFamily: 'Poppins_600SemiBold', fontSize: 9, color: '#FFFFFF' },
  darkChartControlText: { fontFamily: 'Poppins_400Regular', fontSize: 9, color: '#777581' },
  marketChart: {
    height: 170, position: 'relative', overflow: 'hidden',
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#282631',
  },
  marketGridLine: {
    position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#292732',
  },
  marketColumns: {
    ...StyleSheet.absoluteFill, flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'space-around', paddingHorizontal: 8, paddingBottom: 13, paddingTop: 10,
  },
  marketColumn: {
    flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', position: 'relative',
  },
  marketWick: {
    position: 'absolute', bottom: 5, width: 1, maxHeight: 135, backgroundColor: '#777581',
  },
  marketCandle: { width: 10, minHeight: 12, borderRadius: 1 },
  marketAverageLine: {
    position: 'absolute', left: 0, right: 0, top: '34%', height: 1,
    borderStyle: 'dashed', borderWidth: 1, borderColor: '#BBB9C4',
  },
  marketAverageLabel: {
    position: 'absolute', right: 0, top: '28%', paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: 5, backgroundColor: '#C8FF28',
  },
  marketAverageText: { fontFamily: 'Poppins_600SemiBold', fontSize: 8, color: '#11140A' },
  darkChartLegend: { flexDirection: 'row', gap: 16, marginTop: 11 },
  darkLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  darkLegendDot: { width: 7, height: 7, borderRadius: 4 },
  darkLegendText: { fontFamily: 'Poppins_400Regular', fontSize: 9, color: '#A8A6B0' },
  darkChartTotal: { fontFamily: 'Poppins_600SemiBold', fontSize: 25, color: '#C8FF28' },
  darkDiagnosisBars: { gap: 14, marginTop: 18 },
  darkDiagnosisRow: { gap: 6 },
  darkDiagnosisLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  darkDiagnosisLabel: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 11, color: '#D5D3DC' },
  darkDiagnosisValue: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: '#FFFFFF' },
  darkDiagnosisTrack: { height: 9, borderRadius: 5, backgroundColor: '#292832', overflow: 'hidden' },
  darkDiagnosisFill: { height: '100%', borderRadius: 5 },

  chartCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 4,
  },
  chartCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12,
  },
  chartThumb:     { width: 48, height: 48, borderRadius: 12, resizeMode: 'cover' },
  chartCardTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#1a1a1a' },
  chartCardSub:   { fontFamily: 'Poppins_400Regular', fontSize: 12, color: '#666', marginTop: 2 },
  webDistribution: { gap: 14, marginTop: 4 },
  webDistributionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  webLegendDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  webDistributionInfo: { flex: 1, gap: 6 },
  webDistributionLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  webChartLabel: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 12, color: '#284542' },
  webChartValue: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#163F3D' },
  webTrack: { height: 8, borderRadius: 4, backgroundColor: '#E7EFED', overflow: 'hidden' },
  webTrackFill: { height: '100%', borderRadius: 4 },
  webBars: { gap: 13, marginTop: 18 },
  webBarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  webBarLabel: { width: 112, fontFamily: 'Poppins_400Regular', fontSize: 11, color: '#516A67' },
  webBarTrack: { flex: 1, height: 18, borderRadius: 9, backgroundColor: '#E7EFED', overflow: 'hidden' },
  webBarFill: { height: '100%', borderRadius: 9 },
  webBarValue: { width: 24, textAlign: 'right', fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#163F3D' },
  webTimeline: { minWidth: '100%', height: 155, flexDirection: 'row', alignItems: 'flex-end', gap: 18, paddingTop: 12 },
  webTimelineDay: { minWidth: 58, alignItems: 'center', gap: 8 },
  webTimelinePlot: { height: 112, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  webTimelineColumn: { width: 9, minHeight: 5, borderRadius: 5 },
  webTimelineLabel: { fontFamily: 'Poppins_400Regular', fontSize: 10, color: '#66807D' },
  summaryCard: { backgroundColor: '#FFF9F0', borderRadius: 20, padding: 18, marginBottom: 22, borderWidth: 1, borderColor: '#F1DEC6' },
  summaryTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 17, color: '#433B53' },
  summarySubtitle: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: '#887A7A', marginTop: 3, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 11 },
  summaryImage: { width: 42, height: 42, borderRadius: 12, resizeMode: 'cover' },
  summaryInfo: { flex: 1 },
  summaryLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryFruit: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: '#433B53' },
  summaryCount: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#766A78' },
  summaryTrack: { height: 9, borderRadius: 6, backgroundColor: '#F1E8E5', overflow: 'hidden' },
  summaryFill: { height: '100%', borderRadius: 6 },

  emptyBox: {
    backgroundColor: '#fff', borderRadius: 20, padding: 30,
    alignItems: 'center', marginTop: 10,
  },
  emptyText:    { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#666' },
  emptySubtext: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: '#999', marginTop: 4 },
});