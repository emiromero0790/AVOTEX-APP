import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function PolygonMap() {
  return (
    <View style={styles.mapContainer}>
      <Text style={styles.text}>🗺️ El mapa de polígonos solo está disponible en la app móvil.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: 300,
    borderRadius: 16,
    backgroundColor: '#e9e9e9',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    color: '#666',
    textAlign: 'center',
    fontFamily: 'sans-serif',
  }
});