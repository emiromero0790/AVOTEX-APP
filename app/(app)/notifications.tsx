import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import {
  Bell,
  ChevronLeft,
  CloudRain,
  Droplets,
  Gauge,
  Leaf,
  Satellite,
  ThermometerSun,
  Wind,
} from 'lucide-react-native';
import { useFonts, Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { auth } from '../../firebaseConfig';
import { TranslationResource, useLanguage, useTranslations } from '../../context/LanguageContext';
import { listSatelliteReports, SatelliteReport } from '../../services/reports';

const translations: TranslationResource = {
  title: { es: 'Reportes satelitales', en: 'Satellite reports' },
  eyebrow: { es: 'MONITOREO ORBITAL', en: 'ORBITAL MONITORING' },
  hero: { es: 'La salud de tu cultivo, vista desde el espacio', en: 'Your crop health, seen from space' },
  heroBody: { es: 'Consulta los indicadores más recientes detectados para tus cultivos.', en: 'Review the latest indicators detected for your crops.' },
  latest: { es: 'Último análisis', en: 'Latest analysis' },
  reports: { es: '{count} reportes', en: '{count} reports' },
  report: { es: 'Reporte satelital', en: 'Satellite report' },
  vegetation: { es: 'Índices de vegetación', en: 'Vegetation indices' },
  climate: { es: 'Condiciones ambientales', en: 'Environmental conditions' },
  emptyTitle: { es: 'Aún no hay reportes', en: 'No reports yet' },
  emptyBody: { es: 'Cuando se procese un análisis satelital, aparecerá aquí automáticamente.', en: 'When a satellite analysis is processed, it will appear here automatically.' },
  errorTitle: { es: 'No pudimos cargar los reportes', en: 'We could not load the reports' },
  retry: { es: 'Intentar de nuevo', en: 'Try again' },
  back: { es: 'Volver', en: 'Back' },
  ndvi: { es: 'Vigor vegetal', en: 'Plant vigor' },
  ndre: { es: 'Clorofila', en: 'Chlorophyll' },
  msavi: { es: 'Cobertura vegetal', en: 'Vegetation cover' },
  reci: { es: 'Actividad fotosintética', en: 'Photosynthetic activity' },
  ndmi: { es: 'Humedad vegetal', en: 'Vegetation moisture' },
  precipitation: { es: 'Precipitación', en: 'Precipitation' },
  humidity: { es: 'Humedad', en: 'Humidity' },
  clouds: { es: 'Cobertura de nubes', en: 'Cloud cover' },
  wind: { es: 'Viento', en: 'Wind' },
  temperature: { es: 'Temperatura', en: 'Temperature' },
};

type Metric = {
  label: string;
  value: string;
};

const formatNumber = (value: number | null, digits = 2) =>
  value === null || !Number.isFinite(value) ? '—' : value.toFixed(digits);

function MetricPill({ metric }: { metric: Metric }) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricLabel}>{metric.label}</Text>
      <Text style={styles.metricValue}>{metric.value}</Text>
    </View>
  );
}

function ReportCard({
  report,
  locale,
  index,
  t,
}: {
  report: SatelliteReport;
  locale: string;
  index: number;
  t: ReturnType<typeof useTranslations>;
}) {
  const vegetation: Metric[] = [
    { label: t('ndvi'), value: formatNumber(report.ndvi) },
    { label: t('ndre'), value: formatNumber(report.ndre) },
    { label: t('msavi'), value: formatNumber(report.msavi) },
    { label: t('reci'), value: formatNumber(report.reci) },
    { label: t('ndmi'), value: formatNumber(report.ndmi) },
  ];
  const climate: Metric[] = [
    { label: t('precipitation'), value: report.precipitacion === null ? '—' : `${formatNumber(report.precipitacion, 1)} mm` },
    { label: t('humidity'), value: report.humedad === null ? '—' : `${report.humedad}%` },
    { label: t('clouds'), value: report.cobertura_nubes === null ? '—' : `${report.cobertura_nubes}%` },
    { label: t('wind'), value: report.viento === null ? '—' : `${formatNumber(report.viento, 1)} m/s` },
    {
      label: t('temperature'),
      value: report.temp_min === null && report.temp_max === null
        ? '—'
        : `${report.temp_min === null ? '—' : formatNumber(report.temp_min, 1)}° / ${report.temp_max === null ? '—' : formatNumber(report.temp_max, 1)}°`,
    },
  ];

  return (
    <View style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <View style={styles.reportIcon}>
          <Satellite size={21} color="#176B55" />
        </View>
        <View style={styles.reportHeading}>
          <Text style={styles.reportTitle}>{index === 0 ? t('latest') : t('report')}</Text>
          <Text style={styles.reportDate}>
            {new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(report.created_at))}
          </Text>
        </View>
        {index === 0 && <View style={styles.liveDot} />}
      </View>

      <View style={styles.sectionTitleRow}>
        <Leaf size={16} color="#238466" />
        <Text style={styles.sectionTitle}>{t('vegetation')}</Text>
      </View>
      <View style={styles.metricsGrid}>
        {vegetation.map(metric => <MetricPill key={metric.label} metric={metric} />)}
      </View>

      <View style={styles.divider} />

      <View style={styles.sectionTitleRow}>
        <Gauge size={16} color="#4C7C91" />
        <Text style={styles.sectionTitle}>{t('climate')}</Text>
      </View>
      <View style={styles.climateGrid}>
        {climate.map((metric, metricIndex) => {
          const Icon = [CloudRain, Droplets, Gauge, Wind, ThermometerSun][metricIndex];
          return (
            <View key={metric.label} style={styles.climateItem}>
              <View style={styles.climateIcon}><Icon size={15} color="#527785" /></View>
              <View style={styles.climateCopy}>
                <Text style={styles.climateLabel}>{metric.label}</Text>
                <Text style={styles.climateValue}>{metric.value}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function NotificationsScreen() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const [reports, setReports] = useState<SatelliteReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold });

  const loadReports = useCallback(async (refresh = false) => {
    const email = auth.currentUser?.email;
    if (!email) {
      setReports([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      setReports(await listSatelliteReports(email));
    } catch (loadError: any) {
      setError(loadError?.message || t('errorTitle'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => {
    void loadReports();
  }, [loadReports]));

  if (!fontsLoaded) return null;

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, isTablet && styles.scrollTablet]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadReports(true)} tintColor="#176B55" />}
      >
        <View style={[styles.content, isTablet && styles.contentTablet]}>
          <View style={[styles.hero, isTablet && styles.heroTablet]}>
            <Image
              source={require('../../attached_assets/1783291144419_1789865003520.jpg')}
              style={styles.heroImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.18)', '#FFFFFF']}
              locations={[0, 0.52, 1]}
              style={styles.heroFade}
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('back')}
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <ChevronLeft size={23} color="#173E36" />
            </TouchableOpacity>
            <View style={styles.heroCopy}>
              <View style={styles.heroEyebrowRow}>
                <Satellite size={15} color="#176B55" />
                <Text style={styles.heroEyebrow}>{t('eyebrow')}</Text>
              </View>
              <Text style={styles.heroTitle}>{t('hero')}</Text>
              <Text style={styles.heroBody}>{t('heroBody')}</Text>
              <View style={styles.reportCount}>
                <Bell size={14} color="#176B55" />
                <Text style={styles.reportCountText}>{t('reports', { count: reports.length })}</Text>
              </View>
            </View>
          </View>

          <View style={styles.reportsArea}>
            {loading ? (
              <View style={styles.stateCard}>
                <ActivityIndicator size="large" color="#176B55" />
              </View>
            ) : error ? (
              <View style={styles.stateCard}>
                <View style={styles.stateIcon}><Satellite size={28} color="#176B55" /></View>
                <Text style={styles.stateTitle}>{t('errorTitle')}</Text>
                <Text style={styles.stateBody}>{error}</Text>
                <TouchableOpacity onPress={() => void loadReports()} style={styles.retryButton}>
                  <Text style={styles.retryText}>{t('retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : reports.length === 0 ? (
              <View style={styles.stateCard}>
                <View style={styles.stateIcon}><Satellite size={29} color="#176B55" /></View>
                <Text style={styles.stateTitle}>{t('emptyTitle')}</Text>
                <Text style={styles.stateBody}>{t('emptyBody')}</Text>
              </View>
            ) : (
              reports.map((report, index) => (
                <ReportCard key={report.id} report={report} locale={locale} index={index} t={t} />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { paddingBottom: 32 },
  scrollTablet: { alignItems: 'center', paddingBottom: 54 },
  content: { width: '100%' },
  contentTablet: { maxWidth: 920 },
  hero: { height: 430, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  heroTablet: { height: 500, marginTop: 18, borderRadius: 34 },
  heroImage: { position: 'absolute', top: 0, left: 0, right: 0, width: '100%', height: 330 },
  heroFade: { position: 'absolute', left: 0, right: 0, top: 145, height: 220 },
  backButton: {
    position: 'absolute', top: 52, left: 18, width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#0B2C24', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 10, elevation: 6,
  },
  heroCopy: { position: 'absolute', left: 24, right: 24, bottom: 4 },
  heroEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  heroEyebrow: { color: '#176B55', fontFamily: 'Poppins_700Bold', fontSize: 10, letterSpacing: 1.5 },
  heroTitle: { maxWidth: 590, marginTop: 8, color: '#11251F', fontFamily: 'Poppins_700Bold', fontSize: 29, lineHeight: 35, letterSpacing: -0.8 },
  heroBody: { maxWidth: 540, marginTop: 8, color: '#65766F', fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 19 },
  reportCount: { alignSelf: 'flex-start', marginTop: 13, paddingHorizontal: 11, minHeight: 30, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E7F4ED' },
  reportCountText: { color: '#176B55', fontFamily: 'Poppins_600SemiBold', fontSize: 10 },
  reportsArea: { paddingHorizontal: 18, paddingTop: 20, gap: 16 },
  reportCard: { padding: 18, borderRadius: 26, backgroundColor: '#F8FAF8', borderWidth: 1, borderColor: '#E5EBE7', shadowColor: '#23473B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.09, shadowRadius: 18, elevation: 4 },
  reportHeader: { flexDirection: 'row', alignItems: 'center' },
  reportIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E1F1E9' },
  reportHeading: { flex: 1, minWidth: 0, marginLeft: 11 },
  reportTitle: { color: '#172A23', fontFamily: 'Poppins_700Bold', fontSize: 15 },
  reportDate: { marginTop: 2, color: '#75847E', fontFamily: 'Poppins_400Regular', fontSize: 9.5 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#43C885', shadowColor: '#43C885', shadowOpacity: 0.5, shadowRadius: 5 },
  sectionTitleRow: { marginTop: 18, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { color: '#30473E', fontFamily: 'Poppins_600SemiBold', fontSize: 11 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricPill: { width: '31%', minWidth: 92, flexGrow: 1, paddingHorizontal: 10, paddingVertical: 11, borderRadius: 16, backgroundColor: '#E8F2EA' },
  metricLabel: { color: '#6B7C74', fontFamily: 'Poppins_400Regular', fontSize: 8, lineHeight: 11 },
  metricValue: { marginTop: 4, color: '#1A503F', fontFamily: 'Poppins_700Bold', fontSize: 17, lineHeight: 21 },
  divider: { height: 1, marginTop: 18, backgroundColor: '#E0E8E3' },
  climateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  climateItem: { width: '47%', flexGrow: 1, minHeight: 60, padding: 10, borderRadius: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF4F5' },
  climateIcon: { width: 31, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  climateCopy: { flex: 1, minWidth: 0, marginLeft: 8 },
  climateLabel: { color: '#718188', fontFamily: 'Poppins_400Regular', fontSize: 8, lineHeight: 11 },
  climateValue: { marginTop: 2, color: '#294955', fontFamily: 'Poppins_600SemiBold', fontSize: 11, lineHeight: 15 },
  stateCard: { minHeight: 240, padding: 28, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F9F6', borderWidth: 1, borderColor: '#E1EAE5' },
  stateIcon: { width: 60, height: 60, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: 14, backgroundColor: '#E1F1E9' },
  stateTitle: { color: '#173E36', fontFamily: 'Poppins_700Bold', fontSize: 18, textAlign: 'center' },
  stateBody: { maxWidth: 360, marginTop: 7, color: '#708078', fontFamily: 'Poppins_400Regular', fontSize: 11, lineHeight: 17, textAlign: 'center' },
  retryButton: { minHeight: 42, marginTop: 16, paddingHorizontal: 18, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#176B55' },
  retryText: { color: '#FFFFFF', fontFamily: 'Poppins_600SemiBold', fontSize: 11 },
});