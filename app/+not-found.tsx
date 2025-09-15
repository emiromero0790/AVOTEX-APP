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
} from 'react-native';
import { signInWithEmailAndPassword } from "firebase/auth";
import Toast from 'react-native-toast-message';
import { auth } from "../firebaseConfig";
import { Linking } from 'react-native';
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
} from 'react-native-reanimated';
import { useState, useEffect } from 'react';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

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
    router.replace("/(app)"); // Si el login es exitoso
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
      {/* <Stack.Screen options={{ title: 'Iniciar Sesión', headerShown: false }} /> */}
      
      <LinearGradient
        colors={['#E8F5E9', '#C8E6C9', '#A5D6A7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        {/* LOGO */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/images/AvotexLogo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* LOGIN BOX */}
        <Animated.View entering={FadeInDown.delay(300).duration(800)} style={styles.loginBox}>
          <BlurView intensity={20} tint="light" style={styles.blurContainer}>
            <Text style={styles.title}>Bienvenido</Text>
            <Text style={styles.subtitle}>Conecta con tus cultivos inteligentes</Text>

            <Animated.View entering={FadeInUp.delay(400).duration(600)} style={styles.inputContainer}>
              <User size={20} color="#4CAF50" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Correo electrónico"
                placeholderTextColor="#7D7D7D"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(600).duration(600)} style={styles.inputContainer}>
              <Lock size={20} color="#4CAF50" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Contraseña"
                placeholderTextColor="#7D7D7D"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!isPasswordVisible} 
              />
              {/* Botón para cambiar la visibilidad */}
              <TouchableOpacity
                style={styles.eyeIconContainer}
                onPress={() => setIsPasswordVisible(!isPasswordVisible)} 
              >
                {isPasswordVisible ? (
                  <EyeOff size={20} color="#4CAF50" />
                ) : (
                  <Eye size={20} color="#4CAF50" />
                )}
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

      {/* LOADING SPINNER */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <Animated.Text style={[styles.avocadoEmojiSpinner, animatedStyle]}>
            🥑
          </Animated.Text>
          <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 10 }} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({

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

  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
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
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2E7D32', 
    marginTop: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
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
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  registerText: {
    color: '#555',
    fontSize: 15,
  },
  registerLink: {
    color: '#2BC45B',
    fontSize: 15,
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




