

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MapViewComponent({ location, errorMsg }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>🗺️ El mapa solo está disponible en la app móvil.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 200,
    marginHorizontal: 24,
    marginVertical: 24,
    borderRadius: 24,
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