import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { signInWithEmailAndPassword } from "firebase/auth";
import Toast from 'react-native-toast-message';
import { auth } from "../firebaseConfig";
import { Stack, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { User, Lock, ChevronRight, Eye, EyeOff, Mail } from 'lucide-react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate
} from 'react-native-reanimated';
import { useState, useEffect } from 'react';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

// --- COMPONENTE DE HOJA ANIMADA (VERSIÓN CORREGIDA Y MEJORADA) ---
const AnimatedLeaf = () => {
  const initialX = useSharedValue(Math.random() * width);
  const initialY = useSharedValue(Math.random() * height);
  const size = useSharedValue(20 + Math.random() * 20);
  const progress = useSharedValue(Math.random()); // Inicia en un punto aleatorio de la animación

  // --- CORRECCIÓN: Calculamos los valores aleatorios UNA SOLA VEZ aquí ---
  // Estos valores definen a dónde se moverá la hoja y cuánto rotará.
  const xEnd = Math.random() * 40 - 20; // Movimiento horizontal entre -20 y +20
  const yEnd = Math.random() * 40 - 20; // Movimiento vertical entre -20 y +20
  const rotationEnd = Math.random() * 360;

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { 
        duration: 4000 + Math.random() * 3000, // Duración más lenta y aleatoria
        easing: Easing.inOut(Easing.ease),
      }),
      -1, // Repetir infinitamente
      true // Animación de ida y vuelta (yoyo)
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    // Usamos los valores fijos para un movimiento suave y predecible
    const translateX = interpolate(progress.value, [0, 1], [0, xEnd]);
    const translateY = interpolate(progress.value, [0, 1], [0, yEnd]);
    const rotate = interpolate(progress.value, [0, 1], [0, rotationEnd]);
    
    // --- MEJORA: Añadimos una animación de opacidad para un efecto más suave ---
    const opacity = interpolate(progress.value, [0, 0.5, 1], [0.5, 1, 0.5]);

    return {
      position: 'absolute',
      left: initialX.value,
      top: initialY.value,
      fontSize: size.value,
      opacity: opacity, 
      transform: [ 
        { translateX }, 
        { translateY }, 
        { rotate: `${rotate}deg` } 
      ],
    };
  });

  return ( <Animated.Text style={animatedStyle}>🍃</Animated.Text> );
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const rotation = useSharedValue(0);

  useEffect(() => {
    if (loading) {
      rotation.value = withRepeat(withTiming(360, { duration: 2000 }), -1);
    } else {
      rotation.value = 0;
    }
  }, [loading]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const handleLogin = async () => {
    if (!email || !password) {
      Toast.show({
        type: 'avotexError',
        props: {
          message: 'Por favor ingresa tu correo y contraseña',
          icon: require('../assets/images/avotexError.png'),
        },
        position: 'top',
        visibilityTime: 3000,
      });
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace("/(app)");
    } catch (error) {
      console.log(error);
      Toast.show({
        type: 'avotexError',
        props: {
          message: 'Correo o contraseña incorrectos',
          icon: require('../assets/images/avotexError.png'),
        },
        position: 'top',
        visibilityTime: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailPress = () => {
    Linking.openURL('mailto:vexmxoficial@gmail.com');
  };

  return (
    <>
      <LinearGradient
        colors={['#E8F5E9', '#C8E6C9', '#A5D6A7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.decoration} pointerEvents="none">
        {Array.from({ length: 40 }).map((_, i) => (
          <AnimatedLeaf key={i} />
        ))}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/images/AvotexLogo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Animated.View entering={FadeInDown.delay(300).duration(800)} style={styles.loginBox}>
          <BlurView intensity={20} tint="light" style={styles.blurContainer}>
            <Text style={styles.title}>Bienvenido</Text>
            <Text style={styles.subtitle}>Conecta con tus cultivos inteligentes</Text>

            <Animated.View entering={FadeInUp.delay(400).duration(600)} style={styles.inputContainer}>
              <User size={20} color="#4CAF50" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Correo electrónico" placeholderTextColor="#7D7D7D" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(600).duration(600)} style={styles.inputContainer}>
              <Lock size={20} color="#4CAF50" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Contraseña" placeholderTextColor="#7D7D7D" value={password} onChangeText={setPassword} secureTextEntry={!isPasswordVisible} />
              <TouchableOpacity style={styles.eyeIconContainer} onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
                {isPasswordVisible ? (<EyeOff size={20} color="#4CAF50" />) : (<Eye size={20} color="#4CAF50" />)}
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={handleLogin}>
              <Text style={styles.buttonText}>Iniciar Sesión</Text>
              <ChevronRight color="#ffffff" size={20} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactContainer} onPress={handleEmailPress}>
              <Mail size={22} color="#388E3C" style={styles.contactIcon} />
              <View>
                <Text style={styles.contactText}>¿Necesitas una cuenta?</Text>
                <Text style={styles.contactEmail}>vexmxoficial@gmail.com</Text>
              </View>
            </TouchableOpacity>
          </BlurView>
        </Animated.View>
      </KeyboardAvoidingView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <Animated.Text style={[styles.avocadoEmojiSpinner, animatedStyle]}>🥑</Animated.Text>
          <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 10 }} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  decoration: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    zIndex: 0,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  contactContainer: {
    flexDirection: 'row', 
    alignItems: 'center',
    justifyContent: 'center', 
    marginTop: 30, 
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#A5D6A7', 
    backgroundColor: 'rgba(255, 255, 255, 0.5)', 
  },
  contactIcon: {
    marginRight: 12, 
  },
  contactText: {
    color: '#555',
    fontSize: 15,
  },
  contactEmail: {
    color: '#2BC45B', 
    fontSize: 15,
    fontWeight: '600', 
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  logo: {
    width: 160,
    height: 160,
  },
  loginBox: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  blurContainer: {
    padding: 28,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2BC45B',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: '#4E4E4E',
    marginBottom: 30,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F8E9',
    borderRadius: 5,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 55,
    fontSize: 16,
    color: '#333',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: '#2BC45B',
    fontSize: 14,
    fontWeight: '500',
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#2BC45B',
    borderRadius: 16,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  avocadoEmojiSpinner: {
    fontSize: 50,
  },
  eyeIconContainer: {
    padding: 8, 
  },
});