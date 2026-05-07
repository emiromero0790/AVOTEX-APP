import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Mail, Lock, Eye, EyeOff, ChevronRight, X, KeyRound, UserX } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  signInWithEmailAndPassword,
  updatePassword,
  signOut,
} from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeOutUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useGuest } from '../../context/GuestContext';

const CONTACT_EMAIL = 'vexmxoficial@gmail.com';
const ERROR_DURATION_MS = 4000;

const FRUIT_TAGS = [
  { name: 'Mango',   color: '#f9a825', thumb: require('../../assets/images/bg_mango.jpg') },
  { name: 'Limón',   color: '#7CB342', thumb: require('../../assets/images/bg_limon.png') },
  { name: 'Café',    color: '#6D4C41', thumb: require('../../assets/images/bg_cafe2.jpg') },
  { name: 'Guayaba', color: '#D81B60', thumb: require('../../assets/images/bg_guayaba.jpg') },
  { name: 'Berries', color: '#5E35B1', thumb: require('../../assets/images/bg_berries.jpg') },
  { name: 'Aguacate',color: '#2E7D32', thumb: require('../../assets/images/bg_aguacate.jpg') },
];

const BG_FRUITS = [
  { src: require('../../assets/images/bg_mango.jpg'),   style: { top: -40, left: -40, transform: [{ rotate: '15deg' }] } },
  { src: require('../../assets/images/bg_limon2.jpg'),  style: { top: -30, right: -40, transform: [{ rotate: '-12deg' }] } },
  { src: require('../../assets/images/bg_aguacate.jpg'),style: { top: '28%' as any, left: -50, transform: [{ rotate: '8deg' }] } },
  { src: require('../../assets/images/bg_guayaba.jpg'), style: { top: '30%' as any, right: -50, transform: [{ rotate: '-10deg' }] } },
  { src: require('../../assets/images/bg_berries.jpg'), style: { bottom: 20, left: -30, transform: [{ rotate: '-14deg' }] } },
  { src: require('../../assets/images/bg_frutos.jpg'),  style: { bottom: -15, right: -30, transform: [{ rotate: '20deg' }] } },
  { src: require('../../assets/images/bg_cafe2.jpg'),   style: { bottom: 180, right: 70, transform: [{ rotate: '-10deg' }] } },
];

const AnimatedTag = ({ tag, index }: { tag: typeof FRUIT_TAGS[0]; index: number }) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withDelay(
      index * 220,
      withRepeat(
        withSequence(
          withTiming(1.08, { duration: 850, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0,  { duration: 850, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false
      )
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[s.tag, { borderColor: tag.color + '66' }, animStyle]}>
      <Image source={tag.thumb} style={s.tagThumb} />
      <Text style={[s.tagText, { color: tag.color }]}>{tag.name}</Text>
    </Animated.View>
  );
};

export default function Login() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { enterGuestMode } = useGuest();

  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [error, setError]           = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]       = useState(false);

  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (error) {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setError(''), ERROR_DURATION_MS);
    }
    return () => { if (errorTimerRef.current) clearTimeout(errorTimerRef.current); };
  }, [error]);

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail]               = useState('');
  const [forgotOldPw, setForgotOldPw]               = useState('');
  const [forgotNewPw, setForgotNewPw]               = useState('');
  const [forgotConfirmPw, setForgotConfirmPw]       = useState('');
  const [forgotLoading, setForgotLoading]           = useState(false);
  const [forgotError, setForgotError]               = useState('');
  const [forgotSuccess, setForgotSuccess]           = useState(false);
  const [showOldPw, setShowOldPw]                   = useState(false);
  const [showNewPw, setShowNewPw]                   = useState(false);
  const [showConfirmPw, setShowConfirmPw]           = useState(false);

  const openForgotModal = () => {
    setForgotEmail(email);
    setForgotOldPw('');
    setForgotNewPw('');
    setForgotConfirmPw('');
    setForgotError('');
    setForgotSuccess(false);
    setShowForgotModal(true);
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotError('');
    setForgotSuccess(false);
  };

  const handleChangePassword = async () => {
    if (!forgotEmail || !forgotOldPw || !forgotNewPw || !forgotConfirmPw) {
      setForgotError('Por favor completa todos los campos.');
      return;
    }
    if (forgotNewPw !== forgotConfirmPw) {
      setForgotError('Las contraseñas nuevas no coinciden.');
      return;
    }
    if (forgotNewPw.length < 6) {
      setForgotError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (forgotNewPw === forgotOldPw) {
      setForgotError('La nueva contraseña debe ser diferente a la actual.');
      return;
    }
    setForgotLoading(true);
    setForgotError('');
    try {
      const credential = await signInWithEmailAndPassword(auth, forgotEmail, forgotOldPw);
      await updatePassword(credential.user, forgotNewPw);
      await signOut(auth);
      setForgotSuccess(true);
    } catch (err: any) {
      const code = err?.code ?? '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/user-not-found') {
        setForgotError('Correo o contraseña actual incorrectos.');
      } else if (code === 'auth/weak-password') {
        setForgotError('La contraseña nueva es demasiado débil.');
      } else {
        setForgotError('No se pudo cambiar la contraseña. Intenta de nuevo.');
      }
    } finally {
      setForgotLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Por favor ingresa tu correo y contraseña');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/(app)');
    } catch (err: any) {
      const code = err?.code ?? '';
      if (
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential'
      ) {
        setError('Correo o contraseña incorrectos');
      } else {
        setError('Error al iniciar sesión. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestAccess = () => {
    enterGuestMode();
    router.replace('/(app)');
  };

  const cardMaxWidth = isTablet ? 480 : undefined;

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#f0f8e8', '#faf6ee', '#eef7e4']}
        style={StyleSheet.absoluteFill}
      />

      {BG_FRUITS.map((f, i) => (
        <Image key={i} source={f.src} style={[s.fruitImg, f.style as any, isTablet && s.fruitImgTablet]} />
      ))}

      {/* Forgot password modal */}
      <Modal
        visible={showForgotModal}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <TouchableOpacity style={s.modalClose} onPress={closeForgotModal}>
              <X size={22} color="#94a3b8" />
            </TouchableOpacity>

            <View style={s.modalIconCircle}>
              <KeyRound size={26} color="#3aaa5c" />
            </View>

            {forgotSuccess ? (
              <>
                <Text style={s.modalTitle}>¡Contraseña actualizada!</Text>
                <Text style={s.modalSubtitle}>
                  Tu contraseña se cambió exitosamente. Inicia sesión con tu nueva contraseña.
                </Text>
                <TouchableOpacity style={s.modalPrimaryBtn} onPress={closeForgotModal}>
                  <LinearGradient colors={['#42cc6a', '#27a849']} style={s.modalPrimaryGrad}>
                    <Text style={s.modalPrimaryText}>Volver al inicio de sesión</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={s.modalTitle}>Cambiar contraseña</Text>
                <Text style={s.modalSubtitle}>
                  Ingresa tu correo, tu contraseña actual y la nueva contraseña.
                </Text>

                {forgotError ? (
                  <View style={s.forgotErrorBox}>
                    <Text style={s.forgotErrorText}>⚠️ {forgotError}</Text>
                  </View>
                ) : null}

                <View style={s.modalInputRow}>
                  <Mail color="#3aaa5c" size={18} style={s.modalInputIcon} />
                  <TextInput
                    style={s.modalInput}
                    placeholder="Correo electrónico"
                    value={forgotEmail}
                    onChangeText={(t) => { setForgotEmail(t); setForgotError(''); }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor="#a8c4a0"
                  />
                </View>

                <View style={s.modalInputRow}>
                  <Lock color="#3aaa5c" size={18} style={s.modalInputIcon} />
                  <TextInput
                    style={s.modalInput}
                    placeholder="Contraseña actual"
                    value={forgotOldPw}
                    onChangeText={(t) => { setForgotOldPw(t); setForgotError(''); }}
                    secureTextEntry={!showOldPw}
                    placeholderTextColor="#a8c4a0"
                  />
                  <TouchableOpacity onPress={() => setShowOldPw(!showOldPw)} style={s.modalEyeBtn}>
                    {showOldPw ? <Eye color="#7aad4c" size={18} /> : <EyeOff color="#7aad4c" size={18} />}
                  </TouchableOpacity>
                </View>

                <View style={s.modalInputRow}>
                  <Lock color="#3aaa5c" size={18} style={s.modalInputIcon} />
                  <TextInput
                    style={s.modalInput}
                    placeholder="Nueva contraseña"
                    value={forgotNewPw}
                    onChangeText={(t) => { setForgotNewPw(t); setForgotError(''); }}
                    secureTextEntry={!showNewPw}
                    placeholderTextColor="#a8c4a0"
                  />
                  <TouchableOpacity onPress={() => setShowNewPw(!showNewPw)} style={s.modalEyeBtn}>
                    {showNewPw ? <Eye color="#7aad4c" size={18} /> : <EyeOff color="#7aad4c" size={18} />}
                  </TouchableOpacity>
                </View>

                <View style={s.modalInputRow}>
                  <Lock color="#3aaa5c" size={18} style={s.modalInputIcon} />
                  <TextInput
                    style={s.modalInput}
                    placeholder="Repetir nueva contraseña"
                    value={forgotConfirmPw}
                    onChangeText={(t) => { setForgotConfirmPw(t); setForgotError(''); }}
                    secureTextEntry={!showConfirmPw}
                    placeholderTextColor="#a8c4a0"
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPw(!showConfirmPw)} style={s.modalEyeBtn}>
                    {showConfirmPw ? <Eye color="#7aad4c" size={18} /> : <EyeOff color="#7aad4c" size={18} />}
                  </TouchableOpacity>
                </View>

                <View style={s.modalBtnRow}>
                  <TouchableOpacity style={s.modalCancelBtn} onPress={closeForgotModal}>
                    <Text style={s.modalCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.modalPrimaryBtn, { flex: 1 }, forgotLoading && { opacity: 0.75 }]}
                    onPress={handleChangePassword}
                    disabled={forgotLoading}
                  >
                    <LinearGradient colors={['#42cc6a', '#27a849']} style={s.modalPrimaryGrad}>
                      {forgotLoading
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={s.modalPrimaryText}>Confirmar</Text>
                      }
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={[s.scrollContent, isTablet && s.scrollContentTablet]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo + tags */}
          <Animated.View entering={FadeInDown.delay(80).duration(700)} style={[s.logoArea, isTablet && s.logoAreaTablet]}>
            <Image
              source={require('../../assets/images/AvotexNuevoLogo.png')}
              style={[s.logo, isTablet && s.logoTablet]}
              resizeMode="contain"
            />

            <View style={s.tagsRow}>
              {FRUIT_TAGS.map((t, i) => (
                <AnimatedTag key={i} tag={t} index={i} />
              ))}
            </View>
          </Animated.View>

          {/* Card de login */}
          <Animated.View entering={FadeInDown.delay(260).duration(700)} style={[s.card, { maxWidth: cardMaxWidth }, isTablet && s.cardTablet]}>
            <Text style={[s.title, isTablet && s.titleTablet]}>Bienvenido</Text>
            <Text style={[s.subtitle, isTablet && s.subtitleTablet]}>Conecta con tus cultivos inteligentes</Text>

            {error ? (
              <Animated.View
                entering={FadeInUp.duration(400)}
                exiting={FadeOutUp.duration(300)}
                style={s.errorBox}
              >
                <Text style={s.errorText}>⚠️ {error}</Text>
              </Animated.View>
            ) : null}

            <Animated.View entering={FadeInUp.delay(360).duration(600)} style={[s.inputRow, isTablet && s.inputRowTablet]}>
              <Mail color="#3aaa5c" size={20} style={s.inputIcon} />
              <TextInput
                style={[s.input, isTablet && s.inputTablet]}
                placeholder="Correo electrónico"
                value={email}
                onChangeText={(t) => { setEmail(t); setError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#a8c4a0"
              />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(470).duration(600)} style={[s.inputRow, isTablet && s.inputRowTablet]}>
              <Lock color="#3aaa5c" size={20} style={s.inputIcon} />
              <TextInput
                style={[s.input, isTablet && s.inputTablet]}
                placeholder="Contraseña"
                value={password}
                onChangeText={(t) => { setPassword(t); setError(''); }}
                secureTextEntry={!showPassword}
                placeholderTextColor="#a8c4a0"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
                {showPassword ? <Eye color="#7aad4c" size={20} /> : <EyeOff color="#7aad4c" size={20} />}
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity style={s.forgotBtn} onPress={openForgotModal}>
              <Text style={[s.forgotText, isTablet && s.forgotTextTablet]}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>

            <Animated.View entering={FadeInUp.delay(570).duration(600)}>
              <TouchableOpacity
                style={[s.loginBtn, loading && { opacity: 0.75 }]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={['#42cc6a', '#27a849']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[s.loginGradient, isTablet && s.loginGradientTablet]}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Text style={[s.loginText, isTablet && s.loginTextTablet]}>Iniciar Sesión</Text>
                      <ChevronRight color="#fff" size={22} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Guest mode button */}
            <Animated.View entering={FadeInUp.delay(650).duration(600)}>
              <TouchableOpacity
                style={[s.guestBtn, isTablet && s.guestBtnTablet]}
                onPress={handleGuestAccess}
                activeOpacity={0.82}
              >
                <UserX color="#64748b" size={isTablet ? 20 : 17} />
                <Text style={[s.guestBtnText, isTablet && s.guestBtnTextTablet]}>
                  Empezar prueba gratuita
                </Text>
              </TouchableOpacity>
            </Animated.View>

            <View style={s.registerRow}>
              <Text style={[s.registerText, isTablet && s.registerTextTablet]}>
                Envía un correo a{' '}
              </Text>
              <TouchableOpacity onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}>
                <Text style={[s.registerEmail, s.registerEmailLink, isTablet && s.registerTextTablet]}>{CONTACT_EMAIL}</Text>
              </TouchableOpacity>
              <Text style={[s.registerText, isTablet && s.registerTextTablet]}>{' '}para registrarte.</Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const PHOTO = 180;

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f0f8e8',
  },

  fruitImg: {
    position: 'absolute',
    width: PHOTO,
    height: PHOTO,
    borderRadius: 22,
    opacity: 0.9,
    zIndex: 0,
  },
  fruitImgTablet: {
    width: 220,
    height: 220,
    opacity: 0.6,
  },

  kav: {
    flex: 1,
    zIndex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  scrollContentTablet: {
    paddingHorizontal: 60,
    paddingVertical: 40,
  },

  logoArea: {
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  logoAreaTablet: {
    marginBottom: 24,
  },
  logo: {
    width: '82%',
    height: 140,
  },
  logoTablet: {
    width: '60%',
    height: 180,
  },

  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderRadius: 22,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1.5,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  tagThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#e8f5e8',
  },
  tagText: {
    fontSize: 11,
    fontFamily: 'Poppins-SemiBold',
    letterSpacing: 0.2,
  },

  card: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderRadius: 30,
    padding: 22,
    shadowColor: '#1a4a10',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.13,
    shadowRadius: 26,
    elevation: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(58,170,92,0.18)',
    zIndex: 2,
    alignSelf: 'center',
  },
  cardTablet: {
    padding: 32,
    borderRadius: 36,
  },

  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    color: '#2bc45b',
    textAlign: 'center',
    marginBottom: 4,
  },
  titleTablet: {
    fontSize: 36,
  },
  subtitle: {
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    color: '#4d7040',
    textAlign: 'center',
    marginBottom: 18,
  },
  subtitleTablet: {
    fontSize: 16,
    marginBottom: 24,
  },

  errorBox: {
    backgroundColor: 'rgba(253, 232, 232, 0.9)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#e84c4c',
  },
  errorText: {
    color: '#c0392b',
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    textAlign: 'center',
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#b8ddb0',
    borderRadius: 16,
    backgroundColor: 'rgba(244,250,240,0.85)',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  inputRowTablet: {
    borderRadius: 20,
    marginBottom: 16,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontFamily: 'Poppins-Regular',
    fontSize: 15,
    color: '#1a2e0a',
    height: 48,
  },
  inputTablet: {
    fontSize: 17,
    height: 56,
  },
  eyeBtn: { paddingLeft: 8, paddingRight: 2 },

  forgotBtn: { alignSelf: 'flex-end', marginBottom: 16 },
  forgotText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 13,
    color: '#3aaa5c',
  },
  forgotTextTablet: {
    fontSize: 15,
  },

  loginBtn: {
    borderRadius: 50,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#27a849',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.38,
    shadowRadius: 12,
    elevation: 8,
  },
  loginGradient: {
    flexDirection: 'row',
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderRadius: 50,
  },
  loginGradientTablet: {
    paddingVertical: 18,
  },
  loginText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 17,
    color: '#fff',
    letterSpacing: 0.3,
  },
  loginTextTablet: {
    fontSize: 20,
  },

  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginBottom: 8,
    backgroundColor: 'rgba(248,250,252,0.85)',
  },
  guestBtnTablet: {
    paddingVertical: 16,
    marginBottom: 10,
  },
  guestBtnText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 13,
    color: '#64748b',
  },
  guestBtnTextTablet: {
    fontSize: 15,
  },
  guestNote: {
    fontFamily: 'Poppins-Regular',
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 16,
    paddingHorizontal: 8,
  },
  guestNoteTablet: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 18,
  },

  registerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  registerText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    color: '#5a7a50',
    textAlign: 'center',
    lineHeight: 20,
  },
  registerTextTablet: {
    fontSize: 15,
    lineHeight: 24,
  },
  registerEmail: {
    fontFamily: 'Poppins-SemiBold',
    color: '#2d8a3e',
    fontSize: 13,
    lineHeight: 20,
  },
  registerEmailLink: {
    textDecorationLine: 'underline',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 22,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 24,
    shadowColor: '#1a4a10',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 14,
  },
  modalClose: {
    alignSelf: 'flex-end',
    padding: 4,
    marginBottom: 4,
  },
  modalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#edf7ed',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    color: '#2bc45b',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    color: '#4d7040',
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 20,
  },
  forgotErrorBox: {
    backgroundColor: 'rgba(253, 232, 232, 0.9)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#e84c4c',
  },
  forgotErrorText: {
    color: '#c0392b',
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    textAlign: 'center',
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#b8ddb0',
    borderRadius: 14,
    backgroundColor: 'rgba(244,250,240,0.85)',
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  modalInputIcon: { marginRight: 8 },
  modalInput: {
    flex: 1,
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#1a2e0a',
    height: 44,
  },
  modalEyeBtn: { paddingLeft: 6 },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  modalCancelBtn: {
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    paddingVertical: 12,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    color: '#64748b',
  },
  modalPrimaryBtn: {
    borderRadius: 50,
    overflow: 'hidden',
  },
  modalPrimaryGrad: {
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 50,
  },
  modalPrimaryText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    color: '#fff',
  },
});
