import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import Toast from 'react-native-toast-message';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LogBox } from 'react-native';
import { AccessibilityProvider } from '../context/AccessibilityContext';



LogBox.ignoreAllLogs(true);

const toastConfig = {
  avotexError: ({ props }: any) => (
    <LinearGradient
      colors={['#2CE85E', '#51E078']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.toastContainer}
    >
      <Image source={props.icon} style={styles.toastImage} />
      <Text style={styles.toastText}>{props.message}</Text>
    </LinearGradient>
  ),
};

export default function RootLayout() {
  // useFrameworkReady(); // Si no tienes este hook, puedes comentar o eliminar esta línea

  const [fontsLoaded] = useFonts({
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    // --- CAMBIO CLAVE: Envolvemos toda la aplicación con el AccessibilityProvider ---
    <AccessibilityProvider>
      <>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" options={{ presentation: 'modal' }} />
        </Stack>
        <StatusBar style="dark" />

        <Toast config={toastConfig} />
      </>
    </AccessibilityProvider>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    marginTop: 50, 
    marginHorizontal: 15,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 5,
    zIndex: 1000,
  },
  toastImage: {
    width: 40,
    height: 40,
    marginRight: 16,
  },
  toastText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    flexShrink: 1,
    fontFamily: 'Poppins-SemiBold',
  },
});