// archivo: components/PolygonSlider.native.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';

// Este componente recibe el valor actual (offset) y la función para cambiarlo (onOffsetChange)
export default function PolygonSlider({ offset, onOffsetChange }) {
  return (
    <View style={styles.sliderContainer}>
      <Text style={styles.sliderLabel}>Tamaño de la zona:</Text>
      <Slider
        style={{ width: '100%', height: 40 }}
        minimumValue={0.0005}
        maximumValue={0.005}
        step={0.0001}
        value={offset}
        onValueChange={onOffsetChange} // Llama a la función del componente padre
        minimumTrackTintColor="#4CAF50"
        maximumTrackTintColor="#d3d3d3"
        thumbTintColor="#2e8b57"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sliderContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 15,
    marginBottom: 20,
  },
  sliderLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 5,
  },
});