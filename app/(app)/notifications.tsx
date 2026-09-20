import React, { useCallback, useState } from 'react';
import {
  ImageBackground,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Activity,
  CloudRain,
  Droplets,
  Gauge,
  Leaf,
  Satellite,
  ThermometerSun,
  Wind,
  ChevronLeft,
  RefreshCw,
} from 'lucide-react-native';
import { useFonts, Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { auth } from '../../firebaseConfig';
import { TranslationResource, useLanguage, useTranslations } from '../../context/LanguageContext';
import { listSatelliteReports, SatelliteReport } from '../../services/reports';

const translations: TranslationResource = {
  title: { es: 'Reportes satelitales', en: 'Satellite reports' },
  hero: { es: 'Lectura del campo', en: 'Field reading' },
  heroBody: { es: 'La salud de tu cultivo, vista desde el espacio.', en: 'Your crop health, seen from space.' },
  latest: { es: 'Último análisis', en: 'Latest analysis' },
  reports: { es: '{count} reportes', en: '{count} reports' },
  report: { es: 'Reporte satelital', en: 'Satellite report' },
  vegetation: { es: 'Estado del cultivo', en: 'Crop condition' },
  climate: { es: 'Variables ambientales', en: 'Environmental variables' },
  emptyTitle: { es: 'Aún no hay reportes', en: 'No reports yet' },
  emptyBody: { es: 'Cuando se procese un análisis satelital, aparecerá aquí automáticamente.', en: 'When a satellite analysis is processed, it will appear here automatically.' },
  errorTitle: { es: 'No pudimos cargar los reportes', en: 'We could not load the reports' },
  retry: { es: 'Intentar de nuevo', en: 'Try again' },
  back: { es: 'Volver', en: 'Back' },
  ndvi: { es: 'NDVI', en: 'NDVI' },
  ndre: { es: 'NDRE', en: 'NDRE' },
  msavi: { es: 'MSAVI', en: 'MSAVI' },
  reci: { es: 'RECI', en: 'RECI' },
  ndmi: { es: 'NDMI', en: 'NDMI' },
  precipitation: { es: 'Precipitación', en: 'Precipitation' },
  humidity: { es: 'Humedad', en: 'Humidity' },
  clouds: { es: 'Cobertura de nubes', en: 'Cloud cover' },
  wind: { es: 'Viento', en: 'Wind' },
  tempMax: { es: 'Temp. máxima', en: 'Max. temperature' },
  tempMin: { es: 'Temp. mínima', en: 'Min. temperature' },
  dashboard: { es: 'DATOS SATELITALES', en: 'SATELLITE DATA' },
  active: { es: 'ACTIVO', en: 'LIVE' },
};

type Metric = { label: string; raw: number | null; value: string; min: number; max: number };
const formatNumber = (value: number | null, digits = 2) =>
  value === null || !Number.isFinite(value) ? '—' : value.toFixed(digits);

function RangeGauge({ value, min, max }: { value: number | null; min: number; max: number }) {
  const progress = value === null || !Number.isFinite(value) ? null : Math.max(0, Math.min(1, (value - min) / (max - min)));
  return (
    <View style={styles.gaugeWrap}>
      <View style={styles.gaugeTrack}>
        <View style={[styles.gaugeSegment, styles.gaugeGreen]} />
        <View style={[styles.gaugeSegment, styles.gaugeYellow]} />
        <View style={[styles.gaugeSegment, styles.gaugeOrange]} />
        <View style={[styles.gaugeSegment, styles.gaugeRed]} />
        {progress !== null && <View style={[styles.gaugeMarker, { left: `${progress * 100}%` }]} />}
      </View>
      <View style={styles.gaugeBounds}><Text style={styles.gaugeBoundText}>{min}</Text><Text style={styles.gaugeBoundText}>{max}</Text></View>
    </View>
  );
}

function MetricCell({ metric, index }: { metric: Metric; index: number }) {
  return (
    <View style={[styles.metricCell, index === 0 && styles.metricCellFeatured]}>
      <Text style={styles.metricLabel}>{metric.label}</Text>
      <Text style={styles.metricValue}>{metric.value}</Text>
      <RangeGauge value={metric.raw} min={metric.min} max={metric.max} />
    </View>
  );
}

function ReportCard({
  report, locale, index, t,
}: { report: SatelliteReport; locale: string; index: number; t: ReturnType<typeof useTranslations> }) {
  const vegetation: Metric[] = [
    { label: t('ndvi'), raw: report.ndvi, value: formatNumber(report.ndvi), min: 0, max: 1 },
    { label: t('ndre'), raw: report.ndre, value: formatNumber(report.ndre), min: 0, max: 1 },
    { label: t('msavi'), raw: report.msavi, value: formatNumber(report.msavi), min: 0, max: 1 },
    { label: t('reci'), raw: report.reci, value: formatNumber(report.reci), min: 0, max: 10 },
    { label: t('ndmi'), raw: report.ndmi, value: formatNumber(report.ndmi), min: -1, max: 1 },
  ];
  const climate: Metric[] = [
    { label: t('precipitation'), raw: report.precipitacion, value: report.precipitacion === null ? '—' : `${formatNumber(report.precipitacion, 1)} mm`, min: 0, max: 100 },
    { label: t('humidity'), raw: report.humedad, value: report.humedad === null ? '—' : `${report.humedad}%`, min: 0, max: 100 },
    { label: t('clouds'), raw: report.cobertura_nubes, value: report.cobertura_nubes === null ? '—' : `${report.cobertura_nubes}%`, min: 0, max: 100 },
    { label: t('wind'), raw: report.viento, value: report.viento === null ? '—' : `${formatNumber(report.viento, 1)} m/s`, min: 0, max: 20 },
    { label: t('tempMax'), raw: report.temp_max, value: report.temp_max === null ? '—' : `${formatNumber(report.temp_max, 1)}°`, min: -10, max: 45 },
    { label: t('tempMin'), raw: report.temp_min, value: report.temp_min === null ? '—' : `${formatNumber(report.temp_min, 1)}°`, min: -10, max: 45 },
  ];
  const climateIcons = [CloudRain, Droplets, Gauge, Wind, ThermometerSun, ThermometerSun];
  return (
    <View style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <View style={styles.reportIcon}><Satellite size={19} color="#D8F36B" /></View>
        <View style={styles.reportHeading}>
          <Text style={styles.reportTitle}>{index === 0 ? t('latest') : t('report')}</Text>
          <Text style={styles.reportDate}>{new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(report.created_at))}</Text>
        </View>
        {index === 0 && <View style={styles.liveBadge}><Activity size={11} color="#D8F36B" /><Text style={styles.liveText}>{t('active')}</Text></View>}
      </View>
      <View style={styles.sectionTitleRow}><Leaf size={14} color="#D8F36B" /><Text style={styles.sectionTitle}>{t('vegetation')}</Text><View style={styles.sectionLine} /></View>
      <View style={styles.metricsGrid}>{vegetation.map((metric, i) => <MetricCell key={metric.label} metric={metric} index={i} />)}</View>
      <View style={styles.divider} />
      <View style={styles.sectionTitleRow}><Gauge size={14} color="#B8D1C5" /><Text style={styles.sectionTitle}>{t('climate')}</Text><View style={styles.sectionLine} /></View>
      <View style={styles.climateGrid}>
        {climate.map((metric, i) => {
          const Icon = climateIcons[i];
          return <View key={metric.label} style={styles.climateItem}><View style={styles.climateIcon}><Icon size={14} color="#D8F36B" /></View><View style={styles.climateCopy}><Text style={styles.climateLabel}>{metric.label}</Text><Text style={styles.climateValue}>{metric.value}</Text><RangeGauge value={metric.raw} min={metric.min} max={metric.max} /></View></View>;
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
  const insets = useSafeAreaInsets();
  const [reports, setReports] = useState<SatelliteReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold });

  const loadReports = useCallback(async (refresh = false) => {
    const email = auth.currentUser?.email;
    if (!email) { setReports([]); setLoading(false); setRefreshing(false); return; }
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try { setReports(await listSatelliteReports(email)); }
    catch (loadError: any) { setError(loadError?.message || t('errorTitle')); }
    finally { setLoading(false); setRefreshing(false); }
  }, [t]);

  useFocusEffect(useCallback(() => { void loadReports(); }, [loadReports]));
  if (!fontsLoaded) return null;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ImageBackground source={require('../../attached_assets/StockCake-Mosaico_agrícola_aéreo-1123280-standard_1789866363248.jpg')} style={StyleSheet.absoluteFill} resizeMode="cover">
        <View style={styles.mapTint} />
        <LinearGradient colors={['rgba(8,31,24,0.84)', 'rgba(11,43,30,0.46)', 'rgba(8,30,24,0.92)']} style={StyleSheet.absoluteFill} />
      </ImageBackground>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(34, insets.bottom + 20) }, isTablet && styles.scrollTablet]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadReports(true)} tintColor="#D8F36B" />}>
        <View style={[styles.content, isTablet && styles.contentTablet]}>
          <View style={[styles.topbar, { height: insets.top + 54, paddingTop: insets.top + 8 }]}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('back')} onPress={() => router.back()} style={styles.backButton}><ChevronLeft size={21} color="#ECF5D9" /></TouchableOpacity>
            <View style={styles.brand}><Satellite size={18} color="#D8F36B" /><Text style={styles.brandText}>AVOTEX / {t('dashboard')}</Text></View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('retry')} onPress={() => void loadReports(true)} style={styles.refreshButton}><RefreshCw size={16} color="#D8F36B" /></TouchableOpacity>
          </View>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>{t('hero')}</Text>
            <Text style={styles.heroBody}>{t('heroBody')}</Text>
            <View style={styles.heroMeta}><Text style={styles.metaStrong}>{reports.length.toString().padStart(2, '0')}</Text><Text style={styles.metaLabel}>{t('reports', { count: reports.length }).replace(reports.length.toString(), '').trim().toUpperCase()}</Text><View style={styles.metaRule} /><Text style={styles.metaLabel}>NDVI / NDRE / NDMI</Text></View>
          </View>
          <View style={styles.reportsArea}>
            {loading ? <View style={styles.stateCard}><View style={styles.skeletonTitle} /><View style={styles.skeletonRow}><View style={styles.skeletonCell} /><View style={styles.skeletonCell} /><View style={styles.skeletonCell} /></View><View style={styles.skeletonRow}><View style={styles.skeletonCell} /><View style={styles.skeletonCell} /></View></View>
              : error ? <View style={styles.stateCard}><View style={styles.stateIcon}><Satellite size={25} color="#D8F36B" /></View><Text style={styles.stateTitle}>{t('errorTitle')}</Text><Text style={styles.stateBody}>{error}</Text><TouchableOpacity onPress={() => void loadReports()} style={styles.retryButton}><Text style={styles.retryText}>{t('retry')}</Text></TouchableOpacity></View>
              : reports.length === 0 ? <View style={styles.stateCard}><View style={styles.stateIcon}><Satellite size={25} color="#D8F36B" /></View><Text style={styles.stateTitle}>{t('emptyTitle')}</Text><Text style={styles.stateBody}>{t('emptyBody')}</Text></View>
              : reports.map((report, index) => <ReportCard key={report.id} report={report} locale={locale} index={index} t={t} />)}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#102D24' },
  mapTint: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(23,65,31,0.18)' },
  scroll: { paddingBottom: 34 },
  scrollTablet: { alignItems: 'center' },
  content: { width: '100%', maxWidth: 920 },
  contentTablet: { paddingHorizontal: 18 },
  topbar: { paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,28,22,0.72)', borderWidth: 1, borderColor: 'rgba(216,243,107,0.25)' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  brandText: { color: '#D8F36B', fontFamily: 'Poppins_700Bold', fontSize: 9, letterSpacing: 1.25 },
  refreshButton: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,28,22,0.72)', borderWidth: 1, borderColor: 'rgba(216,243,107,0.25)' },
  hero: { paddingHorizontal: 22, paddingTop: 34, paddingBottom: 28 },
  heroTitle: { color: '#F4F7E8', fontFamily: 'Poppins_700Bold', fontSize: 32, lineHeight: 38, letterSpacing: -1 },
  heroBody: { maxWidth: 330, marginTop: 8, color: '#C0D0BD', fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 18 },
  heroMeta: { marginTop: 23, flexDirection: 'row', alignItems: 'center', gap: 9 },
  metaStrong: { color: '#D8F36B', fontFamily: 'Poppins_700Bold', fontSize: 23 },
  metaLabel: { color: '#C0D0BD', fontFamily: 'Poppins_600SemiBold', fontSize: 8, letterSpacing: 1 },
  metaRule: { width: 1, height: 18, backgroundColor: 'rgba(216,243,107,0.42)', marginHorizontal: 3 },
  reportsArea: { paddingHorizontal: 14, gap: 13 },
  reportCard: { padding: 16, borderRadius: 18, backgroundColor: 'rgba(8,31,25,0.84)', borderWidth: 1, borderColor: 'rgba(206,232,171,0.28)' },
  reportHeader: { flexDirection: 'row', alignItems: 'center' },
  reportIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(216,243,107,0.15)', borderWidth: 1, borderColor: 'rgba(216,243,107,0.28)' },
  reportHeading: { flex: 1, marginLeft: 10 },
  reportTitle: { color: '#F2F6E5', fontFamily: 'Poppins_700Bold', fontSize: 14 },
  reportDate: { marginTop: 2, color: '#A9BCAE', fontFamily: 'Poppins_400Regular', fontSize: 9 },
  liveBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(216,243,107,0.13)' },
  liveText: { color: '#D8F36B', fontFamily: 'Poppins_700Bold', fontSize: 8, letterSpacing: 1 },
  sectionTitleRow: { marginTop: 18, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { color: '#D4E2D0', fontFamily: 'Poppins_600SemiBold', fontSize: 10, letterSpacing: .4 },
  sectionLine: { flex: 1, height: 1, backgroundColor: 'rgba(194,224,169,0.18)' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  metricCell: { width: '31%', flexGrow: 1, minWidth: 86, padding: 10, borderRadius: 11, backgroundColor: 'rgba(159,197,109,0.16)', borderWidth: 1, borderColor: 'rgba(210,237,156,0.12)' },
  metricCellFeatured: { backgroundColor: 'rgba(216,243,107,0.28)', borderColor: 'rgba(216,243,107,0.4)' },
  metricLabel: { color: '#AFC3AB', fontFamily: 'Poppins_400Regular', fontSize: 8, lineHeight: 11 },
  metricValue: { marginTop: 4, color: '#F1F6DC', fontFamily: 'Poppins_700Bold', fontSize: 17, lineHeight: 20 },
  gaugeWrap: { marginTop: 8 },
  gaugeTrack: { height: 5, borderRadius: 4, overflow: 'visible', flexDirection: 'row', position: 'relative', backgroundColor: '#506B47' },
  gaugeSegment: { flex: 1, height: 5 },
  gaugeGreen: { backgroundColor: '#29C56A', borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
  gaugeYellow: { backgroundColor: '#D7D547' },
  gaugeOrange: { backgroundColor: '#F08A32' },
  gaugeRed: { backgroundColor: '#D84A3E', borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  gaugeMarker: { position: 'absolute', top: -3, width: 2, height: 11, marginLeft: -1, borderRadius: 2, backgroundColor: '#F8FFE4', shadowColor: '#F8FFE4', shadowOpacity: 0.8, shadowRadius: 3 },
  gaugeBounds: { marginTop: 3, flexDirection: 'row', justifyContent: 'space-between' },
  gaugeBoundText: { color: '#8EA48F', fontFamily: 'Poppins_400Regular', fontSize: 7 },
  divider: { height: 1, marginTop: 17, backgroundColor: 'rgba(194,224,169,0.18)' },
  climateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  climateItem: { width: '47%', flexGrow: 1, minHeight: 55, padding: 9, borderRadius: 11, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(43,82,67,0.64)', borderWidth: 1, borderColor: 'rgba(194,224,169,0.13)' },
  climateIcon: { width: 29, height: 29, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(216,243,107,0.13)' },
  climateCopy: { flex: 1, marginLeft: 8 },
  climateLabel: { color: '#9FB4A8', fontFamily: 'Poppins_400Regular', fontSize: 8 },
  climateValue: { marginTop: 2, color: '#E6F0DA', fontFamily: 'Poppins_600SemiBold', fontSize: 11 },
  stateCard: { minHeight: 220, padding: 28, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,31,25,0.86)', borderWidth: 1, borderColor: 'rgba(206,232,171,0.28)' },
  stateIcon: { width: 58, height: 58, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 13, backgroundColor: 'rgba(216,243,107,0.16)' },
  stateTitle: { color: '#F2F6E5', fontFamily: 'Poppins_700Bold', fontSize: 17, textAlign: 'center' },
  stateBody: { maxWidth: 350, marginTop: 7, color: '#AFC3AB', fontFamily: 'Poppins_400Regular', fontSize: 11, lineHeight: 17, textAlign: 'center' },
  retryButton: { minHeight: 40, marginTop: 16, paddingHorizontal: 18, borderRadius: 11, justifyContent: 'center', backgroundColor: '#D8F36B' },
  retryText: { color: '#173525', fontFamily: 'Poppins_700Bold', fontSize: 11 },
  skeletonTitle: { width: 145, height: 16, borderRadius: 5, backgroundColor: 'rgba(216,243,107,0.2)', marginBottom: 20 },
  skeletonRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  skeletonCell: { flex: 1, height: 58, borderRadius: 10, backgroundColor: 'rgba(194,224,169,0.13)' },
});