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

  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (error) {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setError(''), ERROR_DURATION_MS);
    }
    return () => { if (errorTimerRef.current) clearTimeout(errorTimerRef.current); };
  }, [error]);

  const togglePanel = (open: boolean) => setPanelOpen(open);

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
              <KeyRound size={26} color="#0F766E" />
            </View>

            {forgotSuccess ? (
              <>
                <Text style={s.modalTitle}>¡Contraseña actualizada!</Text>
                <Text style={s.modalSubtitle}>
                  Tu contraseña se cambió exitosamente. Inicia sesión con tu nueva contraseña.
                </Text>
                <TouchableOpacity style={s.modalPrimaryBtn} onPress={closeForgotModal}>
                  <LinearGradient colors={['#159A8C', '#0F766E']} style={s.modalPrimaryGrad}>
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
                  <Mail color="#0F766E" size={18} style={s.modalInputIcon} />
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
                  <Lock color="#0F766E" size={18} style={s.modalInputIcon} />
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
                  <Lock color="#0F766E" size={18} style={s.modalInputIcon} />
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
                  <Lock color="#0F766E" size={18} style={s.modalInputIcon} />
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
                    <LinearGradient colors={['#159A8C', '#0F766E']} style={s.modalPrimaryGrad}>
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

      <View style={[s.photoBackdrop, panelOpen && s.photoBackdropDim]}>
        <Image source={require('../../assets/images/marcoroosink-winegrower-490486.jpg')} style={s.backdropImage} />
        <LinearGradient colors={panelOpen
          ? ['rgba(5,18,19,0.68)', 'rgba(5,18,19,0.88)']
          : ['rgba(5,18,19,0.18)', 'rgba(5,18,19,0.68)']} style={StyleSheet.absoluteFill} />
        <View style={s.brandMark}>
          <Image source={require('../../assets/images/AvotexNuevoLogo.png')} style={s.brandLogo} resizeMode="contain" />
        </View>
      </View>

      <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={20}>
        {!panelOpen ? (
          <View style={s.coverContent}>
            <View style={s.coverCopy}>
              <Text style={s.coverEyebrow}>AVOTEX · INTELIGENCIA PARA EL CAMPO</Text>
              <Text style={[s.coverTitle, isTablet && s.coverTitleTablet]}>Lee tu viñedo. Decide con certeza.</Text>
              <Text style={s.coverSubtitle}>Cada hoja cuenta una historia. Nosotros te ayudamos a verla.</Text>
            </View>
            <View style={[s.coverActions, isTablet && s.coverActionsTablet]}>
              <TouchableOpacity style={s.coverGuestButton} onPress={handleGuestAccess} activeOpacity={0.86}>
                <UserX color="#E6F4F0" size={18} />
                <Text style={s.coverGuestText}>Entrar como invitado</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.coverLoginButton} onPress={() => togglePanel(true)} activeOpacity={0.86}>
                <Text style={s.coverLoginText}>Iniciar sesión</Text>
                <ChevronRight size={20} color="#0B3E3A" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={s.formScreen}>
            <TouchableOpacity onPress={() => togglePanel(false)} style={s.backButton} accessibilityLabel="Volver a la portada">
              <X size={21} color="#E6F4F0" />
              <Text style={s.backText}>Volver</Text>
            </TouchableOpacity>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.formContent, isTablet && s.formContentTablet]}>
            <Text style={[s.title, isTablet && s.titleTablet]}>Bienvenido</Text>
            <Text style={[s.subtitle, isTablet && s.subtitleTablet]}>Conecta con tus cultivos inteligentes</Text>

            {error ? (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={[s.inputRow, isTablet && s.inputRowTablet]}>
              <Mail color="#0F766E" size={20} style={s.inputIcon} />
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
              <Lock color="#0F766E" size={20} style={s.inputIcon} />
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
                      <ChevronRight color="#0F766E" size={22} />
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
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#071D1D',
  },
  photoBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#18352B' },
  photoBackdropDim: { backgroundColor: '#061A1A' },
  backdropImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  brandMark: { position: 'absolute', top: 54, left: 22, right: 22, alignItems: 'center' },
  brandLogo: { width: 190, height: 68, tintColor: '#FFFFFF', opacity: 0.94 },
  coverContent: {
    flex: 1, justifyContent: 'flex-end', paddingHorizontal: 24, paddingBottom: 42,
  },
  coverCopy: { maxWidth: 620, marginBottom: 28 },
  coverEyebrow: {
    color: '#9AD8CE', fontFamily: 'Poppins-SemiBold', fontSize: 11,
    letterSpacing: 1.5, marginBottom: 12,
  },
  coverTitle: {
    color: '#F5FBF8', fontFamily: 'Poppins-Bold', fontSize: 36,
    lineHeight: 43, letterSpacing: -0.5,
  },
  coverTitleTablet: { fontSize: 52, lineHeight: 60 },
  coverSubtitle: {
    color: '#D4E9E4', fontFamily: 'Poppins-Regular', fontSize: 15,
    lineHeight: 23, marginTop: 12, maxWidth: 390,
  },
  coverActions: { gap: 11, width: '100%', maxWidth: 440 },
  coverActionsTablet: { flexDirection: 'row', maxWidth: 620 },
  coverGuestButton: {
    minHeight: 54, borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(230,244,240,0.65)', backgroundColor: 'rgba(8,35,34,0.42)',
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9,
    paddingHorizontal: 18,
  },
  coverGuestText: { color: '#E6F4F0', fontFamily: 'Poppins-SemiBold', fontSize: 15 },
  coverLoginButton: {
    minHeight: 54, borderRadius: 16, backgroundColor: '#9DDED2',
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
    paddingHorizontal: 22,
  },
  coverLoginText: { color: '#0B3E3A', fontFamily: 'Poppins-SemiBold', fontSize: 15 },
  formScreen: {
    flex: 1, paddingTop: Platform.OS === 'ios' ? 54 : 30,
    paddingHorizontal: 24,
  },
  backButton: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 8, paddingHorizontal: 2,
  },
  backText: { color: '#E6F4F0', fontFamily: 'Poppins-SemiBold', fontSize: 14 },
  formContentTablet: { alignSelf: 'center', width: '100%', maxWidth: 520 },
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
  enterButton: { height: 56, borderRadius: 17, marginTop: 12, backgroundColor: '#0F766E', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
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
    borderColor: '#CFE2DE',
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
    color: '#F3FAF7',
    textAlign: 'center',
    marginBottom: 4,
  },
  titleTablet: {
    fontSize: 36,
  },
  subtitle: {
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    color: '#C2D9D4',
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
    borderColor: 'rgba(206,238,231,0.45)',
    borderRadius: 14,
    backgroundColor: 'rgba(11,43,42,0.72)',
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
    color: '#F3FAF7',
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
    color: '#9DDED2',
  },
  forgotTextTablet: {
    fontSize: 15,
  },

  loginBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#0F766E',
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
    color: '#0F766E',
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
    borderColor: '#CFE2DE',
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
    color: '#C2D9D4',
    textAlign: 'center',
    lineHeight: 20,
  },
  registerTextTablet: {
    fontSize: 15,
    lineHeight: 24,
  },
  registerEmail: {
    fontFamily: 'Poppins-SemiBold',
    color: '#0F766E',
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
    color: '#0F766E',
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
    borderColor: '#CFE2DE',
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
