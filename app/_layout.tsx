import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useFonts, Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import Toast from 'react-native-toast-message';
import { View, Text, Image, StyleSheet } from 'react-native';

// --- NUEVO: Configuración del Toast personalizado ---
const toastConfig = {
  avotexError: ({ props }: any) => (
    // Cambiamos el View por LinearGradient
    <LinearGradient
      colors={['#2CE85E', '#51E078']} // Un degradado de un verde medio a uno más oscuro
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.toastContainer} // Le aplicamos los mismos estilos del contenedor
    >
      <Image source={props.icon} style={styles.toastImage} />
      <Text style={styles.toastText}>{props.message}</Text>
    </LinearGradient>
  ),
};

export default function RootLayout() {
  useFrameworkReady();

  const [fontsLoaded] = useFonts({
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style="light" />

      {/* --- NUEVO: Componente Toast añadido al final --- */}
      <Toast config={toastConfig} />
    </>
  );
}

// --- NUEVO: Estilos para el Toast ---
const styles = StyleSheet.create({
  toastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20, // Aumentado para más espacio interior
    borderRadius: 20, // Ligeramente más redondeado para la nueva escala
    marginTop: 50, 
    marginHorizontal: 15, // Reducido para que el modal sea más ancho
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 5,
    zIndex: 1000,
  },
  toastImage: {
    width: 40, // Icono más grande
    height: 40, // Icono más grande
    marginRight: 16, // Más separación para el nuevo tamaño
  },
  toastText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16, // Tamaño de fuente explícitamente más grande
    flexShrink: 1,
    fontFamily: 'Poppins-SemiBold',
  },
});