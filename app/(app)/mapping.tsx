import React, { useState, useEffect, useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
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

const AnimatedCell = ({ color }) => {
  const isWarning = color === '#F44336' || color === '#0D47A1';
  const isReady = color === '#FFC107';
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
  const [isLoading, setIsLoading] = useState(true);
  const [polygonOffset, setPolygonOffset] = useState(0.001);

  const colors = useMemo(() => ({
    title: isColorblindMode ? '#0D47A1' : '#66bb6a',
    subtitle: '#666',
    legendTitle: isColorblindMode ? '#0D47A1' : '#2d5016',
    legendText: '#000000',
    healthy: isColorblindMode ? '#42A5F5' : '#4CAF50',
    ready: '#FFC107',
    alert: isColorblindMode ? '#0D47A1' : '#F44336',
  }), [isColorblindMode]);
  
  const healthMapData = useMemo(() => ([
    colors.healthy, colors.healthy, colors.ready, colors.healthy,
    colors.ready, colors.healthy, colors.alert, colors.healthy,
    colors.healthy, colors.healthy, colors.ready, colors.healthy,
    colors.healthy, colors.alert, colors.healthy, colors.healthy,
  ]), [colors]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('El permiso para acceder a la ubicación fue denegado.');
        setIsLoading(false);
        return;
      }
      try {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation(location);
      } catch (error) {
        setErrorMsg('No se pudo obtener la ubicación.');
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={true}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.title }]}>Mapeo de Cultivo</Text>

        {/* <View style={styles.subTitleContainer}>
          <Text style={[styles.subTitle, { color: colors.subtitle }]}>Ubicación Geográfica</Text>
        </View> */}

        <PolygonSlider 
            offset={polygonOffset} 
            onOffsetChange={setPolygonOffset} 
        />

        {isLoading ? (
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

        <Text style={[styles.subTitle, { marginTop: 30, color: colors.subtitle }]}>Estado de la Huerta por Zonas</Text>
        <View style={styles.dataGridContainer}>
          <View style={styles.grid}>
            {healthMapData.map((color, index) => (
              <AnimatedCell key={index} color={color} />
            ))}
          </View>
          
          <Image 
            source={require('../../assets/images/avotexMapa.png')} 
            style={styles.avocadoMascot}
            resizeMode="contain"
          />
        </View>


        <View style={styles.legend}>
          <Text style={[styles.legendTitle, { color: '#05ab52' }]}>Leyenda</Text>
          <View style={styles.legendGrid}>
            <View style={[styles.legendCard, { borderLeftColor: colors.healthy }]}>
              <View style={[styles.legendIconCircle, { backgroundColor: colors.healthy + '20' }]}>
                <View style={[styles.legendDot, { backgroundColor: colors.healthy }]} />
              </View>
              <View style={styles.legendCardContent}>
                <Text style={styles.legendCardTitle}>Saludable</Text>
                <Text style={styles.legendCardDescription}>Plantas en óptimas condiciones</Text>
              </View>
            </View>

            <View style={[styles.legendCard, { borderLeftColor: colors.ready }]}>
              <View style={[styles.legendIconCircle, { backgroundColor: colors.ready + '20' }]}>
                <View style={[styles.legendDot, { backgroundColor: colors.ready }]} />
              </View>
              <View style={styles.legendCardContent}>
                <Text style={styles.legendCardTitle}>Listo para cosecha</Text>
                <Text style={styles.legendCardDescription}>Frutos maduros listos</Text>
              </View>
            </View>

            <View style={[styles.legendCard, { borderLeftColor: colors.alert }]}>
              <View style={[styles.legendIconCircle, { backgroundColor: colors.alert + '20' }]}>
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
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingBottom: 120,
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  subTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center', 
    marginTop: 24,
    marginBottom: 12,
  },
  subTitleIcon: { // Este estilo era el que estaba mal aplicado a tu aguacate
    width: 32,
    height: 32, 
    marginRight: 10,
  },
  subTitle: {
    fontSize: 20,
  },
  loadingContainer: {
    height: 300,
    borderRadius: 16,
    backgroundColor: '#e9e9e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontWeight: '500',
  },
  dataGridContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    flexDirection: 'row', 
    justifyContent: 'space-around', 
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
  avocadoMascot: {
    marginLeft: -20,
    width: 140,
    height: 140,
  },
  legend: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  legendTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  legendGrid: {
    gap: 16,
  },
  legendCard: {
    backgroundColor: '#fafafa',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  legendIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  legendDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  legendCardContent: {
    flex: 1,
  },
  legendCardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  legendCardDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  legendText: {
    fontSize: 16,
  },
});