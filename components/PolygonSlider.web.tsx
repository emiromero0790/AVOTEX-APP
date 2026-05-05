// archivo: components/PolygonSlider.web.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Este es el componente que se mostrará en el navegador
export default function PolygonSlider({ offset, onOffsetChange }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        El control para ajustar el tamaño del polígono solo está disponible en la app móvil.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  text: {
    color: '#666',
    textAlign: 'center',
    fontFamily: 'sans-serif',
  }
});