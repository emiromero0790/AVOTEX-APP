import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#f2f8ec', '#faf5ee', '#eef7e6']} style={s.root}>

        <View style={s.fruitRow}>
          {['🥭', '🍋', '☕', '🫐', '🍓', '🥑'].map((e, i) => (
            <Text key={i} style={s.fruitEmoji}>{e}</Text>
          ))}
        </View>

        <Animated.View entering={FadeInDown.delay(100).duration(700)} style={s.center}>
          <Image
            source={require('../assets/images/AvotexNuevoLogo.png')}
            style={s.logo}
            resizeMode="contain"
          />

          <View style={s.badge}>
            <Text style={s.badgeText}>404</Text>
          </View>

          <Text style={s.title}>Página no encontrada</Text>
          <Text style={s.subtitle}>
            La ruta que buscas no existe.{'\n'}Regresa al inicio para continuar.
          </Text>

          <Animated.View entering={FadeInUp.delay(350).duration(600)}>
            <TouchableOpacity style={s.btn} onPress={() => router.replace('/')} activeOpacity={0.88}>
              <LinearGradient
                colors={['#42cc6a', '#27a849']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.btnGradient}
              >
                <Text style={s.btnText}>🌿 Ir al inicio</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        <View style={s.footer}>
          <Text style={s.footerText}>Limón · Mango · Café · Guayaba · Berries · Aguacate</Text>
        </View>
      </LinearGradient>
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', alignItems: 'center', padding: 28 },

  fruitRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginTop: 60,
  },
  fruitEmoji: { fontSize: 32 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },

  logo: { width: 260, height: 90, marginBottom: 24 },

  badge: {
    backgroundColor: '#e84c4c',
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 10,
    marginBottom: 18,
    shadowColor: '#c0392b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  badgeText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 38,
    color: '#fff',
    letterSpacing: 4,
  },

  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 24,
    color: '#2d6a1f',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: 'Poppins-Regular',
    fontSize: 15,
    color: '#6b8a5e',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },

  btn: {
    borderRadius: 50,
    overflow: 'hidden',
    shadowColor: '#27a849',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.38,
    shadowRadius: 12,
    elevation: 8,
  },
  btnGradient: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 50,
    alignItems: 'center',
  },
  btnText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 17,
    color: '#fff',
    letterSpacing: 0.3,
  },

  footer: { marginBottom: 30 },
  footerText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#9aba8a',
    textAlign: 'center',
    letterSpacing: 0.4,
  },
});
