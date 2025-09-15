// archivo: (app)/mapping.tsx

import React, { useState, useEffect } from 'react';
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


const AnimatedCell = ({ color }) => {
  const isWarning = color === '#F44336';
  const isReady = color === '#FFC107';
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (isWarning) {
      opacity.value = withRepeat(withTiming(0.3, { duration: 500 }), -1, true);
    }
  }, [isWarning]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: isWarning ? opacity.value : 1,
    };
  });

  return (
    <View style={{ position: 'relative' }}>
      <Animated.View style={[styles.cell, { backgroundColor: color }, animatedStyle]} />
      {isReady && <Text style={styles.emojiOverlay}>🥑</Text>}
    </View>
  );
};

// --- Datos para el Mapa de Calor (Grid) ---
const sampleHealthMap = [
  '#4CAF50', '#4CAF50', '#FFC107', '#4CAF50',
  '#FFC107', '#4CAF50', '#F44336', '#4CAF50',
  '#4CAF50', '#4CAF50', '#FFC107', '#4CAF50',
  '#4CAF50', '#F44336', '#4CAF50', '#4CAF50',
];

export default function Mapping() {
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [polygonOffset, setPolygonOffset] = useState(0.001);

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
        <Text style={styles.title}>Mapeo de Cultivo</Text>

        <View style={styles.subTitleContainer}>
          <Image 
            source={require('../../assets/images/avotexMapa.png')} 
            style={styles.subTitleIcon}
          />
          <Text style={styles.subTitle}>Ubicación Geográfica</Text>
        </View>

        <PolygonSlider 
            offset={polygonOffset} 
            onOffsetChange={setPolygonOffset} 
        />

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Obteniendo tu ubicación...</Text>
          </View>
        ) : (
           <PolygonMap 
            location={userLocation} 
            errorMsg={errorMsg} 
            offset={polygonOffset} 
          />
        )}

        <Text style={[styles.subTitle, { marginTop: 30 }]}>Estado de la Huerta por Zonas</Text>
        <View style={styles.dataGridContainer}>
          <View style={styles.grid}>
            {sampleHealthMap.map((color, index) => (
              <AnimatedCell key={index} color={color} />
            ))}
          </View>
        </View>

        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Leyenda</Text>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.legendText}>Saludable</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FFC107' }]} />
            <Text style={styles.legendText}>Listo para cosecha</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F44336' }]} />
            <Text style={styles.legendText}>Alerta</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingBottom: 40,
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#66bb6a',
    marginTop: 10,
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
  subTitleIcon: {
    width: 32,
    height: 32, 
    marginRight: 10,
  },
  subTitle: {
    fontSize: 20,
    color: '#666',
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
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 20,
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
  legend: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 20,
  },
  legendTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3b1260',
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  legendText: {
    fontSize: 16,
    color: '#000000',
  },
});