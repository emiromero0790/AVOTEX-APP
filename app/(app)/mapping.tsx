import React, { useState, useEffect, useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet, ActivityIndicator, Image, Switch } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import PolygonSlider from '../../components/PolygonSlider';
import PolygonMap from '../../components/PolygonMap';
import * as Location from 'expo-location';
import { useAccessibility } from '../../context/AccessibilityContext';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, MapPinOff, FlaskConical } from 'lucide-react-native';

const AnimatedCell = ({ color }: { color: string }) => {
  const isWarning = color === '#F44336' || color === '#e84c4c' || color === '#0D47A1';
  const isReady = color === '#FFC107' || color === '#f9a825';
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (isWarning) {
      opacity.value = withRepeat(withTiming(0.3, { duration: 500 }), -1, true);
    }
  }, [isWarning, color]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: isWarning ? opacity.value : 1,
  }));

  return (
    <View style={{ position: 'relative' }}>
      <Animated.View style={[styles.cell, { backgroundColor: color }, animatedStyle]} />
      {isReady && <Text style={styles.emojiOverlay}>🥑</Text>}
    </View>
  );
};

export default function Mapping() {
  const { isColorblindMode } = useAccessibility();

  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [polygonOffset, setPolygonOffset] = useState(0.001);
  const [locationEnabled, setLocationEnabled] = useState(false);

  const colors = useMemo(() => ({
    title: isColorblindMode ? '#0D47A1' : '#66bb6a',
    subtitle: '#666',
    healthy: isColorblindMode ? '#42A5F5' : '#3aaa5c',
    ready: '#f9a825',
    alert: isColorblindMode ? '#0D47A1' : '#e84c4c',
  }), [isColorblindMode]);

  const healthMapData = useMemo(() => ([
    colors.healthy, colors.healthy, colors.ready, colors.healthy,
    colors.ready, colors.healthy, colors.alert, colors.healthy,
    colors.healthy, colors.healthy, colors.ready, colors.healthy,
    colors.healthy, colors.alert, colors.healthy, colors.healthy,
  ]), [colors]);

  const requestAndSetLocation = async () => {
    setIsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('El permiso para acceder a la ubicación fue denegado.');
        setLocationEnabled(false);
        setIsLoading(false);
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation(location);
      setErrorMsg(null);
    } catch (error) {
      setErrorMsg('No se pudo obtener la ubicación.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationToggle = async (value: boolean) => {
    setLocationEnabled(value);
    if (value) {
      await requestAndSetLocation();
    } else {
      setUserLocation(null);
      setErrorMsg(null);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={['#a7f3d0', '#ecfdf5', '#ffff']}
        locations={[0, 0.38, 1]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={true}
        style={{ backgroundColor: 'transparent' }}
      >
        <View style={styles.headerGradient}>
          <Text style={[styles.title, { color: colors.title }]}>Mapeo de Cultivo</Text>
        </View>

        <View style={styles.container}>

          {/* Location toggle */}
          <View style={styles.locationToggleCard}>
            <View style={styles.locationToggleLeft}>
              {locationEnabled
                ? <MapPin size={18} color="#0f766e" />
                : <MapPinOff size={18} color="#94a3b8" />
              }
              <View style={{ marginLeft: 10 }}>
                <Text style={[styles.locationToggleTitle, { color: locationEnabled ? '#0f766e' : '#64748b' }]}>
                  Ubicación
                </Text>
                <Text style={styles.locationToggleSub}>
                  {locationEnabled ? 'Activa — solo mientras usas la app' : 'Desactivada'}
                </Text>
              </View>
            </View>
            <Switch
              value={locationEnabled}
              onValueChange={handleLocationToggle}
              trackColor={{ false: '#e2e8f0', true: '#a7f3d0' }}
              thumbColor={locationEnabled ? '#0f766e' : '#94a3b8'}
            />
          </View>

          <PolygonSlider
            offset={polygonOffset}
            onOffsetChange={setPolygonOffset}
          />

          {!locationEnabled ? (
            <View style={styles.locationOffContainer}>
              <MapPinOff size={32} color="#94a3b8" />
              <Text style={styles.locationOffTitle}>Ubicación desactivada</Text>
              <Text style={styles.locationOffSub}>
                Activa la ubicación para ver el mapa de tu cultivo en tiempo real
              </Text>
            </View>
          ) : isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.healthy} />
              <Text style={styles.loadingText}>Obteniendo tu ubicación...</Text>
            </View>
          ) : (
            <PolygonMap
              location={userLocation}
              errorMsg={errorMsg}
              offset={polygonOffset}
            />
          )}

          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.subTitle, { color: colors.subtitle }]}>
              Estado del Cultivo por Zonas
            </Text>
            <View style={styles.simulationBadge}>
              <FlaskConical size={12} color="#92400e" />
              <Text style={styles.simulationBadgeText}>Simulación</Text>
            </View>
          </View>

          <View style={styles.simulationNotice}>
            <Text style={styles.simulationNoticeText}>
             Esta visualización es una <Text style={styles.simulationNoticeBold}>simulación demostrativa</Text>. Los datos mostrados son de ejemplo y no reflejan el estado real de un cultivo.
            </Text>
          </View>

          <View style={styles.dataGridContainer}>
            <View style={styles.grid}>
              {healthMapData.map((color, index) => (
                <AnimatedCell key={index} color={color} />
              ))}
            </View>
            <Image
              source={require('../../assets/images/avotexMapa.png')}
              style={styles.mascot}
              resizeMode="contain"
            />
          </View>

          <View style={styles.legend}>
            <Text style={[styles.legendTitle, { color: colors.healthy }]}>Leyenda</Text>
            <View style={styles.legendGrid}>
              <View style={[styles.legendCard, { borderLeftColor: colors.healthy }]}>
                <View style={[styles.legendIconCircle, { backgroundColor: colors.healthy + '25' }]}>
                  <View style={[styles.legendDot, { backgroundColor: colors.healthy }]} />
                </View>
                <View style={styles.legendCardContent}>
                  <Text style={styles.legendCardTitle}>Saludable</Text>
                  <Text style={styles.legendCardDescription}>Plantas en óptimas condiciones</Text>
                </View>
              </View>

              <View style={[styles.legendCard, { borderLeftColor: colors.ready }]}>
                <View style={[styles.legendIconCircle, { backgroundColor: colors.ready + '25' }]}>
                  <View style={[styles.legendDot, { backgroundColor: colors.ready }]} />
                </View>
                <View style={styles.legendCardContent}>
                  <Text style={styles.legendCardTitle}>Listo para cosecha</Text>
                  <Text style={styles.legendCardDescription}>Frutos maduros listos</Text>
                </View>
              </View>

              <View style={[styles.legendCard, { borderLeftColor: colors.alert }]}>
                <View style={[styles.legendIconCircle, { backgroundColor: colors.alert + '25' }]}>
                  <View style={[styles.legendDot, { backgroundColor: colors.alert }]} />
                </View>
                <View style={styles.legendCardContent}>
                  <Text style={styles.legendCardTitle}>Alerta</Text>
                  <Text style={styles.legendCardDescription}>Requiere atención inmediata</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { paddingBottom: 180 },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    padding: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    letterSpacing: 0.2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 28,
    marginBottom: 10,
  },
  subTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  simulationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  simulationBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400e',
  },
  simulationNotice: {
    backgroundColor: 'rgba(254, 243, 199, 0.85)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  simulationNoticeText: {
    fontSize: 12,
    color: '#78350f',
    lineHeight: 18,
  },
  simulationNoticeBold: {
    fontWeight: '700',
  },

  locationToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#0f766e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.12)',
  },
  locationToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationToggleTitle: {
    fontWeight: '600',
    fontSize: 14,
  },
  locationToggleSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },

  locationOffContainer: {
    height: 240,
    borderRadius: 16,
    backgroundColor: 'rgba(238, 247, 232, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d4ecc8',
    gap: 10,
    paddingHorizontal: 30,
  },
  locationOffTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 4,
  },
  locationOffSub: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 19,
  },

  loadingContainer: {
    height: 300,
    borderRadius: 16,
    backgroundColor: 'rgba(238, 247, 232, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#6b8a5e',
    fontWeight: '500',
  },
  dataGridContainer: {
    backgroundColor: 'rgba(240, 247, 236, 0.85)',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: '#d4ecc8',
  },
  grid: {
    width: 200,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  cell: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  emojiOverlay: {
    position: 'absolute',
    top: -8,
    right: -8,
    fontSize: 18,
  },
  mascot: {
    marginLeft: -20,
    width: 140,
    height: 140,
  },
  legend: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#2d6a1f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e8f7ec',
  },
  legendTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 18,
    letterSpacing: 0.3,
  },
  legendGrid: { gap: 14 },
  legendCard: {
    backgroundColor: 'rgba(250, 255, 247, 0.9)',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },
  legendIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  legendDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  legendCardContent: { flex: 1 },
  legendCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a2e0a',
    marginBottom: 3,
  },
  legendCardDescription: {
    fontSize: 13,
    color: '#6b8a5e',
    lineHeight: 18,
  },
});
