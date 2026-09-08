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
import { BlurView } from 'expo-blur';
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
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useGuest } from '../../context/GuestContext';

const CONTACT_EMAIL = 'vexmxoficial@gmail.com';
const ERROR_DURATION_MS = 4000;

export default function Login() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { enterGuestMode } = useGuest();

  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [error, setError]           = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelProgress = useSharedValue(1);

  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (error) {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setError(''), ERROR_DURATION_MS);
    }
    return () => { if (errorTimerRef.current) clearTimeout(errorTimerRef.current); };
  }, [error]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: panelProgress.value * 28 }],
  }));
  const togglePanel = (open: boolean) => {
    setPanelOpen(open);
    panelProgress.value = withTiming(open ? 0 : 1, { duration: 420, easing: Easing.out(Easing.cubic) });
  };

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
                    <Text style={s.forgotErrorText}>{forgotError}</Text>
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

      <View style={s.photoBackdrop}>
        <Image source={require('../../attached_assets/marcoroosink-winegrower-490486_1788909125756.jpg')} style={s.backdropImage} />
        <LinearGradient colors={['rgba(16,36,28,0.12)', 'rgba(16,36,28,0.72)']} style={StyleSheet.absoluteFill} />
        <View style={s.brandMark}>
          <Image source={require('../../assets/images/AvotexNuevoLogo.png')} style={s.brandLogo} resizeMode="contain" />
        </View>
      </View>

      <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={20}>
        <Animated.View style={[s.glassPanel, panelStyle, isTablet && s.glassPanelTablet]}>
          <BlurView intensity={Platform.OS === 'web' ? 0 : 42} tint="light" style={StyleSheet.absoluteFill} />
          <View style={s.panelInner}>
            <View style={s.panelHandle} />
            <View style={s.panelHeader}>
              <Image source={require('../../assets/images/AvotexNuevoLogo.png')} style={s.panelLogo} resizeMode="contain" />
              {panelOpen && <TouchableOpacity onPress={() => togglePanel(false)} style={s.closePanel} accessibilityLabel="Cerrar inicio de sesión"><X size={20} color="#18352B" /></TouchableOpacity>}
            </View>
            {!panelOpen ? (
              <TouchableOpacity style={s.enterButton} onPress={() => togglePanel(true)} activeOpacity={0.86}>
                <Text style={s.enterButtonText}>Ingresar</Text><ChevronRight size={19} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.formContent}>
            <Text style={[s.title, isTablet && s.titleTablet]}>Bienvenido</Text>
            <Text style={[s.subtitle, isTablet && s.subtitleTablet]}>Conecta con tus cultivos inteligentes</Text>

            {error ? (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={[s.inputRow, isTablet && s.inputRowTablet]}>
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
            </View>

            <View style={[s.inputRow, isTablet && s.inputRowTablet]}>
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
            </View>

            <TouchableOpacity style={s.forgotBtn} onPress={openForgotModal}>
              <Text style={[s.forgotText, isTablet && s.forgotTextTablet]}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>

              <TouchableOpacity
                style={[s.loginBtn, loading && { opacity: 0.75 }]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.88}
              >
                <View style={[s.loginGradient, isTablet && s.loginGradientTablet]}>
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Text style={[s.loginText, isTablet && s.loginTextTablet]}>Iniciar Sesión</Text>
                      <ChevronRight color="#2F7D55" size={22} />
                    </>
                  )}
                </View>
              </TouchableOpacity>

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

            <View style={s.registerRow}>
              <Text style={[s.registerText, isTablet && s.registerTextTablet]}>
                Envía un correo a{' '}
              </Text>
              <TouchableOpacity onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}>
                <Text style={[s.registerEmail, s.registerEmailLink, isTablet && s.registerTextTablet]}>{CONTACT_EMAIL}</Text>
              </TouchableOpacity>
              <Text style={[s.registerText, isTablet && s.registerTextTablet]}>{' '}para registrarte.</Text>
            </View>
              </ScrollView>
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  photoBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#18352B' },
  backdropImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  brandMark: { position: 'absolute', top: 56, left: 22, right: 22, alignItems: 'center' },
  brandLogo: { width: 270, height: 96, tintColor: '#FFFFFF' },
  glassPanel: {
    position: 'absolute', left: 12, right: 12, bottom: 18, minHeight: 190,
    maxHeight: '88%', borderRadius: 30, overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)', backgroundColor: 'rgba(255,255,255,0.84)',
    shadowColor: '#10241C', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.24,
    shadowRadius: 24, elevation: 12,
  },
  glassPanelTablet: { left: '50%', right: undefined, width: 520, marginLeft: -260, bottom: 28 },
  panelInner: { padding: 18, flex: 1 },
  panelHandle: { width: 42, height: 4, borderRadius: 4, backgroundColor: 'rgba(24,53,43,0.24)', alignSelf: 'center', marginBottom: 10 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 64 },
  panelLogo: { width: 240, height: 72 },
  closePanel: { position: 'absolute', right: 0, top: 4, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(234,244,238,0.9)' },
  enterButton: { height: 52, borderRadius: 16, marginTop: 12, backgroundColor: '#2F7D55', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  enterButtonText: { fontFamily: 'Poppins-SemiBold', color: '#FFFFFF', fontSize: 16 },
  formContent: { paddingBottom: 26 },

  kav: {
    flex: 1,
    zIndex: 1,
  },

  logoArea: {
    alignItems: 'center',
    marginBottom: 18,
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

  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 22,
    shadowColor: '#1F5E41',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 26,
    elevation: 12,
    borderWidth: 1.5,
    borderColor: '#DDE9E1',
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
    color: '#18352B',
    textAlign: 'center',
    marginBottom: 4,
  },
  titleTablet: {
    fontSize: 36,
  },
  subtitle: {
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    color: '#6D7D74',
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
    borderColor: '#DDE9E1',
    borderRadius: 14,
    backgroundColor: '#F7FAF8',
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
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#2F7D55',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  loginGradient: {
    flexDirection: 'row',
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B8DCC7',
  },
  loginGradientTablet: {
    paddingVertical: 18,
  },
  loginText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 17,
    color: '#2F7D55',
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
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#DDE9E1',
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
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
