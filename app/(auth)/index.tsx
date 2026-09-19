import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ImageBackground,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Linking,
  Animated,
  Easing,
} from 'react-native';
import { router } from 'expo-router';
import { Mail, Lock, Eye, EyeOff, ChevronRight, X, UserX } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { useGuest } from '../../context/GuestContext';
import { TranslationResource, useTranslations } from '../../context/LanguageContext';

const REGISTER_URL = 'https://vex-mx.com/avotex.html';
const ERROR_DURATION_MS = 4000;

const translations: TranslationResource = {
  eyebrow: { es: 'AVOTEX · INTELIGENCIA PARA EL CAMPO', en: 'AVOTEX · INTELLIGENCE FOR THE FIELD' },
  coverTitle: { es: 'Lee tu viñedo. Decide con certeza.', en: 'Read your vineyard. Decide with confidence.' },
  coverSubtitle: { es: 'Cada hoja cuenta una historia. Nosotros te ayudamos a verla.', en: 'Every leaf tells a story. We help you see it.' },
  signIn: { es: 'Iniciar sesión', en: 'Sign in' },
  guestAccess: { es: 'Entrar como invitado', en: 'Continue as guest' },
  backToCover: { es: 'Volver a la portada', en: 'Back to welcome screen' },
  back: { es: 'Volver', en: 'Back' },
  welcome: { es: 'Bienvenido', en: 'Welcome' },
  smartCrops: { es: 'Conecta con tus cultivos inteligentes', en: 'Connect with your smart crops' },
  emailPlaceholder: { es: 'Correo electrónico', en: 'Email address' },
  passwordPlaceholder: { es: 'Contraseña', en: 'Password' },
  emailLabel: { es: 'Correo electrónico', en: 'Email address' },
  passwordLabel: { es: 'Contraseña', en: 'Password' },
  showPassword: { es: 'Mostrar contraseña', en: 'Show password' },
  hidePassword: { es: 'Ocultar contraseña', en: 'Hide password' },
  startSession: { es: 'Iniciar Sesión', en: 'Sign In' },
  freeTrial: { es: 'Empezar prueba gratuita', en: 'Start free trial' },
  contactBefore: { es: 'Entra a', en: 'Go to' },
  contactAfter: { es: 'para registrarte.', en: 'to register.' },
  missingCredentials: { es: 'Por favor ingresa tu correo y contraseña', en: 'Please enter your email and password' },
  invalidCredentials: { es: 'Correo o contraseña incorrectos', en: 'Incorrect email or password' },
  signInError: { es: 'Error al iniciar sesión. Intenta de nuevo.', en: 'Unable to sign in. Please try again.' },
};

export default function Login() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { enterGuestMode, exitGuestMode } = useGuest();
  const t = useTranslations(translations);

  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [error, setError]           = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eyebrowEntrance = useRef(new Animated.Value(0)).current;
  const titleWordEntrances = useRef(
    Array.from({ length: 10 }, () => new Animated.Value(0)),
  ).current;
  const subtitleEntrance = useRef(new Animated.Value(0)).current;
  const coverTitle = t('coverTitle');
  const coverTitleWords = coverTitle.split(/\s+/);

  const playCoverEntrance = () => {
    eyebrowEntrance.setValue(0);
    titleWordEntrances.forEach((value) => value.setValue(0));
    subtitleEntrance.setValue(0);

    Animated.sequence([
      Animated.delay(180),
      Animated.timing(eyebrowEntrance, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.stagger(
        82,
        titleWordEntrances.slice(0, coverTitleWords.length).map((value) =>
          Animated.timing(value, {
            toValue: 1,
            duration: 520,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ),
      ),
      Animated.timing(subtitleEntrance, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  useEffect(() => {
    if (error) {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setError(''), ERROR_DURATION_MS);
    }
    return () => { if (errorTimerRef.current) clearTimeout(errorTimerRef.current); };
  }, [error]);

  useEffect(() => {
    playCoverEntrance();
  }, [coverTitle]);

  const togglePanel = (open: boolean) => {
    setPanelOpen(open);
    if (!open) {
      requestAnimationFrame(playCoverEntrance);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError(t('missingCredentials'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await exitGuestMode();
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/(app)');
    } catch (err: any) {
      const code = err?.code ?? '';
      if (
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential'
      ) {
        setError(t('invalidCredentials'));
      } else {
        setError(t('signInError'));
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
    <ImageBackground
      source={require('../../assets/images/marcoroosink-winegrower-490486.jpg')}
      style={s.root}
      imageStyle={s.backdropImage}
      resizeMode="cover"
    >

      <LinearGradient
        pointerEvents="none"
        colors={panelOpen
          ? ['rgba(5,18,19,0.68)', 'rgba(5,18,19,0.88)']
          : ['rgba(5,18,19,0.18)', 'rgba(5,18,19,0.68)']}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
      >
        {!panelOpen ? (
          <View style={s.coverContent}>
            <View style={s.coverCopy}>
              <Image
                source={require('../../assets/images/AvotexNuevoLogo.png')}
                style={[s.brandLogo, isTablet && s.brandLogoTablet]}
                resizeMode="contain"
              />
              <Animated.Text
                style={[
                  s.coverEyebrow,
                  {
                    opacity: eyebrowEntrance,
                    transform: [{
                      translateY: eyebrowEntrance.interpolate({
                        inputRange: [0, 1],
                        outputRange: [10, 0],
                      }),
                    }],
                  },
                ]}
              >
                {t('eyebrow')}
              </Animated.Text>
              <View
                style={[s.coverTitleSequence, isTablet && s.coverTitleSequenceTablet]}
                accessibilityRole="header"
                accessibilityLabel={coverTitle}
              >
                {coverTitleWords.map((word, index) => {
                  const entrance = titleWordEntrances[index];
                  return (
                    <Animated.Text
                      key={`${word}-${index}`}
                      accessible={false}
                      style={[
                        s.coverTitleWord,
                        isTablet && s.coverTitleWordTablet,
                        {
                          opacity: entrance,
                          transform: [
                            {
                              translateY: entrance.interpolate({
                                inputRange: [0, 1],
                                outputRange: [22, 0],
                              }),
                            },
                            {
                              scale: entrance.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.96, 1],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      {word}
                    </Animated.Text>
                  );
                })}
              </View>
              <Animated.Text
                style={[
                  s.coverSubtitle,
                  {
                    opacity: subtitleEntrance,
                    transform: [{
                      translateY: subtitleEntrance.interpolate({
                        inputRange: [0, 1],
                        outputRange: [14, 0],
                      }),
                    }],
                  },
                ]}
              >
                {t('coverSubtitle')}
              </Animated.Text>
            </View>
            <View style={[s.coverActions, isTablet && s.coverActionsTablet]}>
              <TouchableOpacity style={s.coverLoginButton} onPress={() => togglePanel(true)} activeOpacity={0.86}>
                <View style={s.coverLoginArrowCircle}>
                  <ChevronRight size={19} color="#0B3E3A" strokeWidth={2.4} />
                </View>
                <Text style={s.coverLoginText}>{t('signIn')}</Text>
                <View style={s.coverLoginChevrons} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <ChevronRight size={18} color="#2E504A" strokeWidth={1.65} />
                  <ChevronRight size={18} color="#2E504A" strokeWidth={1.65} style={s.coverLoginChevronOverlap} />
                  <ChevronRight size={18} color="#2E504A" strokeWidth={1.65} style={s.coverLoginChevronOverlap} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={s.coverGuestButton} onPress={handleGuestAccess} activeOpacity={0.86}>
                <UserX color="#E6F4F0" size={18} />
                <Text style={s.coverGuestText}>{t('guestAccess')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={s.formScreen}>
            <TouchableOpacity onPress={() => togglePanel(false)} style={s.backButton} accessibilityLabel={t('backToCover')}>
              <X size={21} color="#E6F4F0" />
              <Text style={s.backText}>{t('back')}</Text>
            </TouchableOpacity>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.formContent, isTablet && s.formContentTablet]}>
            <Text style={[s.title, isTablet && s.titleTablet]}>{t('welcome')}</Text>
            <Text style={[s.subtitle, isTablet && s.subtitleTablet]}>{t('smartCrops')}</Text>

            {error ? (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={[s.inputRow, isTablet && s.inputRowTablet]}>
              <Mail color="#0F766E" size={20} style={s.inputIcon} />
              <TextInput
                style={[s.input, isTablet && s.inputTablet]}
                placeholder={t('emailPlaceholder')}
                accessibilityLabel={t('emailLabel')}
                value={email}
                onChangeText={(t) => { setEmail(t); setError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#D1D5DB"
              />
            </View>

            <View style={[s.inputRow, isTablet && s.inputRowTablet]}>
              <Lock color="#0F766E" size={20} style={s.inputIcon} />
              <TextInput
                style={[s.input, isTablet && s.inputTablet]}
                placeholder={t('passwordPlaceholder')}
                accessibilityLabel={t('passwordLabel')}
                value={password}
                onChangeText={(t) => { setPassword(t); setError(''); }}
                secureTextEntry={!showPassword}
                placeholderTextColor="#D1D5DB"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={s.eyeBtn}
                accessibilityLabel={t(showPassword ? 'hidePassword' : 'showPassword')}
                accessibilityRole="button"
              >
                {showPassword ? <Eye color="#FFFFFF" size={20} /> : <EyeOff color="#FFFFFF" size={20} />}
              </TouchableOpacity>
            </View>

              <TouchableOpacity
                style={[s.loginBtn, loading && { opacity: 0.75 }]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.88}
              >
                <View style={[s.loginGradient, isTablet && s.loginGradientTablet]}>
                  <View style={s.coverLoginArrowCircle}>
                    <ChevronRight size={19} color="#0B3E3A" strokeWidth={2.4} />
                  </View>
                  {loading ? (
                    <ActivityIndicator color="#0F766E" size="small" />
                  ) : (
                    <Text style={[s.loginText, isTablet && s.loginTextTablet]}>{t('startSession')}</Text>
                  )}
                  <View style={s.coverLoginChevrons} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <ChevronRight size={18} color="#2E504A" strokeWidth={1.65} />
                    <ChevronRight size={18} color="#2E504A" strokeWidth={1.65} style={s.coverLoginChevronOverlap} />
                    <ChevronRight size={18} color="#2E504A" strokeWidth={1.65} style={s.coverLoginChevronOverlap} />
                  </View>
                </View>
              </TouchableOpacity>

            <TouchableOpacity
                style={[s.guestBtn, isTablet && s.guestBtnTablet]}
                onPress={handleGuestAccess}
                activeOpacity={0.82}
              >
                <UserX color="#64748b" size={isTablet ? 20 : 17} />
                <Text style={[s.guestBtnText, isTablet && s.guestBtnTextTablet]}>
                  {t('freeTrial')}
                </Text>
              </TouchableOpacity>

            <View style={s.registerRow}>
              <Text style={[s.registerText, isTablet && s.registerTextTablet]}>
                 {t('contactBefore')}{' '}
              </Text>
               <TouchableOpacity onPress={() => Linking.openURL(REGISTER_URL)}>
                 <Text style={[s.registerEmail, s.registerEmailLink, isTablet && s.registerTextTablet]}>{REGISTER_URL}</Text>
              </TouchableOpacity>
               <Text style={[s.registerText, isTablet && s.registerTextTablet]}>{' '}{t('contactAfter')}</Text>
            </View>
            </ScrollView>
          </View>
        )}
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#071D1D',
  },
  backdropImage: { backgroundColor: '#18352B' },
  brandLogo: { width: 290, height: 104, alignSelf: 'center', tintColor: '#FFFFFF', opacity: 0.98, marginBottom: 2 },
  brandLogoTablet: { width: 380, height: 136 },
  coverContent: {
    flex: 1, justifyContent: 'flex-end', paddingHorizontal: 24, paddingBottom: 42,
  },
  coverCopy: { maxWidth: 620, marginBottom: 28 },
  coverEyebrow: {
    color: '#9AD8CE', fontFamily: 'Poppins-SemiBold', fontSize: 11,
    letterSpacing: 1.5, marginBottom: 12,
  },
  coverTitleSequence: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 9,
  },
  coverTitleSequenceTablet: {
    columnGap: 13,
  },
  coverTitleWord: {
    color: '#F5FBF8', fontFamily: 'Poppins-Regular', fontWeight: '400', fontSize: 36,
    lineHeight: 43, letterSpacing: -0.5,
  },
  coverTitleWordTablet: { fontSize: 52, lineHeight: 60 },
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
  coverGuestText: { color: '#E6F4F0', fontFamily: 'Poppins-SemiBold', fontSize: 15, flexShrink: 0 },
  coverLoginButton: {
    minHeight: 58, borderRadius: 29, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
    paddingHorizontal: 60,
    shadowColor: '#061D1B', shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16, shadowRadius: 12, elevation: 6,
  },
  coverLoginArrowCircle: {
    position: 'absolute', left: 5, width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#9DDED2',
  },
  coverLoginChevrons: {
    position: 'absolute', right: 10, flexDirection: 'row', alignItems: 'center',
  },
  coverLoginChevronOverlap: { marginLeft: -9 },
  coverLoginText: { color: '#173E39', fontFamily: 'Poppins-SemiBold', fontSize: 15, flexShrink: 0 },
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
    position: 'relative',
    zIndex: 1,
    elevation: 1,
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

  loginBtn: {
    borderRadius: 29,
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
    minHeight: 58,
    paddingHorizontal: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B8DCC7',
  },
  loginGradientTablet: {
    minHeight: 66,
    borderRadius: 33,
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

});
