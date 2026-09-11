import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import {
  ChevronLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  Trash2,
  TriangleAlert,
  User,
  LogOut,
  Coins,
} from 'lucide-react-native';
import {
  signInWithEmailAndPassword,
  updatePassword,
  signOut,
  deleteUser,
} from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { supabase } from '../../supabaseConfig';
import { useFonts, Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { TranslationResource, useTranslations, useLanguage } from '../../context/LanguageContext';

const translations: TranslationResource = {
  'profile.title': { es: 'Mi Perfil', en: 'My Profile' }, 'profile.account': { es: 'CUENTA', en: 'ACCOUNT' }, 'profile.myAccount': { es: 'Mi cuenta', en: 'My account' }, 'profile.balance': { es: 'SALDO', en: 'BALANCE' }, 'profile.tokens': { es: 'Mis Tokens', en: 'My Tokens' }, 'profile.available': { es: 'Disponibles para escanear', en: 'Available for scanning' }, 'profile.session': { es: 'SESIÓN', en: 'SESSION' }, 'profile.signOut': { es: 'Cerrar sesión', en: 'Sign out' }, 'profile.security': { es: 'SEGURIDAD', en: 'SECURITY' }, 'profile.changePassword': { es: 'Cambiar contraseña', en: 'Change password' }, 'profile.current': { es: 'Contraseña actual', en: 'Current password' }, 'profile.new': { es: 'Nueva contraseña', en: 'New password' }, 'profile.repeat': { es: 'Repetir nueva contraseña', en: 'Repeat new password' }, 'profile.confirm': { es: 'Confirmar cambio', en: 'Confirm change' }, 'profile.success': { es: 'Contraseña actualizada exitosamente. Inicia sesión nuevamente.', en: 'Password updated successfully. Sign in again.' }, 'profile.login': { es: 'Ir al inicio de sesión', en: 'Go to sign in' }, 'profile.dangerZone': { es: 'ZONA DE PELIGRO', en: 'DANGER ZONE' }, 'profile.dangerTitle': { es: 'Zona de peligro', en: 'Danger zone' }, 'profile.dangerBody': { es: 'Eliminar tu cuenta es una acción {permanent}. Se eliminarán todos tus datos de la aplicación.', en: 'Deleting your account is {permanent}. All your app data will be deleted.' }, 'profile.permanent': { es: 'permanente e irreversible', en: 'permanent and irreversible' }, 'profile.delete': { es: 'Eliminar cuenta', en: 'Delete account' }, 'profile.deleteTitle': { es: '¿Eliminar cuenta?', en: 'Delete account?' }, 'profile.deleteBody': { es: 'Esta acción es permanente e irreversible.\\n\\nSe eliminarán tu cuenta y todos tus datos de la aplicación. No podrás recuperarlos.', en: 'This action is permanent and irreversible.\\n\\nYour account and all app data will be deleted. You cannot recover them.' }, 'profile.type': { es: 'Escribe {phrase} para continuar:', en: 'Type {phrase} to continue:' }, 'profile.cancel': { es: 'Cancelar', en: 'Cancel' }, 'profile.yesDelete': { es: 'Sí, eliminar', en: 'Yes, delete' }, 'profile.required': { es: 'Por favor completa todos los campos.', en: 'Please complete all fields.' }, 'profile.mismatch': { es: 'Las contraseñas nuevas no coinciden.', en: 'The new passwords do not match.' }, 'profile.length': { es: 'La nueva contraseña debe tener al menos 6 caracteres.', en: 'The new password must be at least 6 characters.' }, 'profile.different': { es: 'La nueva contraseña debe ser diferente a la actual.', en: 'The new password must differ from the current one.' }, 'profile.credentials': { es: 'Correo o contraseña actual incorrectos.', en: 'Incorrect email or current password.' }, 'profile.weak': { es: 'La contraseña nueva es demasiado débil.', en: 'The new password is too weak.' }, 'profile.changeError': { es: 'No se pudo cambiar la contraseña. Intenta de nuevo.', en: 'Could not change password. Try again.' }, 'profile.recent': { es: 'Por seguridad, cierra sesión, vuelve a iniciar sesión y luego intenta de nuevo.', en: 'For security, sign out, sign in again, and then try again.' }, 'profile.deleteError': { es: 'No se pudo eliminar la cuenta. Intenta de nuevo.', en: 'Could not delete the account. Try again.' }, 'profile.confirmPhrase': { es: 'ELIMINAR', en: 'DELETE' }, 'profile.deletePrompt': { es: 'Esta acción es', en: 'This action is' },
};

export default function ProfileScreen() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold });

  const currentUser = auth.currentUser;
  const userEmail = currentUser?.email ?? '';

  const [userTokens, setUserTokens] = useState<number | null>(null);

  useEffect(() => {
    if (!userEmail) return;
    supabase.from('users').select('tokens').eq('user_email', userEmail).maybeSingle()
      .then(({ data }) => { setUserTokens(data?.tokens ?? 0); });
  }, [userEmail]);

  // ── Change password state ──
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const handleChangePassword = async () => {
    if (!oldPw || !newPw || !confirmPw) {
      setPwError(t('profile.required'));
      return;
    }
    if (newPw !== confirmPw) {
      setPwError(t('profile.mismatch'));
      return;
    }
    if (newPw.length < 6) {
      setPwError(t('profile.length'));
      return;
    }
    if (newPw === oldPw) {
      setPwError(t('profile.different'));
      return;
    }
    setPwLoading(true);
    setPwError('');
    try {
      const credential = await signInWithEmailAndPassword(auth, userEmail, oldPw);
      await updatePassword(credential.user, newPw);
      await signOut(auth);
      setPwSuccess(true);
      setOldPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err: any) {
      const code = err?.code ?? '';
      if (
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential' ||
        code === 'auth/user-not-found'
      ) {
        setPwError(t('profile.credentials'));
      } else if (code === 'auth/weak-password') {
        setPwError(t('profile.weak'));
      } else {
        setPwError(t('profile.changeError'));
      }
    } finally {
      setPwLoading(false);
    }
  };

  // ── Sign out ──
  const [signOutLoading, setSignOutLoading] = useState(false);

  const handleSignOut = async () => {
    setSignOutLoading(true);
    try {
      await signOut(auth);
      router.replace('/(auth)');
    } catch {
      setSignOutLoading(false);
    }
  };

  // ── Delete account state ──
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const CONFIRM_PHRASE = t('profile.confirmPhrase');

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('no-user');
      await deleteUser(user);
      setDeleteModalVisible(false);
      router.replace('/(auth)');
    } catch (err: any) {
      const code = err?.code ?? '';
      if (code === 'auth/requires-recent-login') {
        setDeleteError(
          t('profile.recent')
        );
      } else {
        setDeleteError(t('profile.deleteError'));
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!fontsLoaded) return null;

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFillObject} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>{t('profile.account')}</Text>
        <View style={styles.avatarCard}>
          <View style={styles.avatarCircle}>
            <User size={36} color="#fff" />
          </View>
          <View style={styles.accountCopy}>
            <Text style={styles.accountName}>{t('profile.myAccount')}</Text>
            <View style={styles.emailRow}>
              <Mail size={14} color="#8E8E93" />
              <Text style={styles.emailText} numberOfLines={1}>{userEmail}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>{t('profile.balance')}</Text>
        <View style={styles.tokenCard}>
          <View style={styles.tokenCardGrad}>
            <View style={styles.tokenCardLeft}>
              <Coins size={20} color="#FFFFFF" />
            </View>
            <View style={styles.tokenCardRight}>
              <Text style={styles.tokenCardLabel}>{t('profile.tokens')}</Text>
              <Text style={styles.tokenCardSub}>{t('profile.available')}</Text>
            </View>
            <View style={styles.tokenAmountRow}>
              <Text style={styles.tokenCardAmount}>
                {userTokens !== null ? (userTokens * 100).toLocaleString(locale) : '—'}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>{t('profile.session')}</Text>
        <TouchableOpacity
          style={[styles.signOutBtn, signOutLoading && { opacity: 0.7 }]}
          onPress={handleSignOut}
          disabled={signOutLoading}
          activeOpacity={0.82}
        >
          {signOutLoading ? (
            <ActivityIndicator color="#FF3B30" size="small" />
          ) : (
            <>
              <LogOut size={16} color="#FF3B30" />
              <Text style={styles.signOutBtnText}>{t('profile.signOut')}</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>{t('profile.security')}</Text>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconCircle}>
              <KeyRound size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.sectionTitle}>{t('profile.changePassword')}</Text>
          </View>

          {pwSuccess ? (
            <View style={styles.successBox}>
                  <Text style={styles.successText}>{t('profile.success')}</Text>
              <TouchableOpacity
                style={styles.successBtn}
                onPress={() => { setPwSuccess(false); router.replace('/(auth)'); }}
              >
                <View style={styles.successBtnGrad}>
                    <Text style={styles.successBtnText}>{t('profile.login')}</Text>
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {pwError ? (
                <View style={styles.errorBox}>
                   <Text style={styles.errorText}>{pwError}</Text>
                </View>
              ) : null}

              <View style={styles.inputRow}>
                <Lock size={18} color="#8E8E93" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('profile.current')}
                  placeholderTextColor="#8E8E93"
                  value={oldPw}
                  onChangeText={(t) => { setOldPw(t); setPwError(''); }}
                  secureTextEntry={!showOldPw}
                  editable={!pwLoading}
                />
                <TouchableOpacity onPress={() => setShowOldPw(!showOldPw)} style={styles.eyeBtn}>
                  {showOldPw ? <Eye size={18} color="#8E8E93" /> : <EyeOff size={18} color="#8E8E93" />}
                </TouchableOpacity>
              </View>

              <View style={styles.inputRow}>
                <Lock size={18} color="#8E8E93" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('profile.new')}
                  placeholderTextColor="#8E8E93"
                  value={newPw}
                  onChangeText={(t) => { setNewPw(t); setPwError(''); }}
                  secureTextEntry={!showNewPw}
                  editable={!pwLoading}
                />
                <TouchableOpacity onPress={() => setShowNewPw(!showNewPw)} style={styles.eyeBtn}>
                  {showNewPw ? <Eye size={18} color="#8E8E93" /> : <EyeOff size={18} color="#8E8E93" />}
                </TouchableOpacity>
              </View>

              <View style={styles.inputRow}>
                <Lock size={18} color="#8E8E93" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('profile.repeat')}
                  placeholderTextColor="#8E8E93"
                  value={confirmPw}
                  onChangeText={(t) => { setConfirmPw(t); setPwError(''); }}
                  secureTextEntry={!showConfirmPw}
                  editable={!pwLoading}
                />
                <TouchableOpacity onPress={() => setShowConfirmPw(!showConfirmPw)} style={styles.eyeBtn}>
                  {showConfirmPw ? <Eye size={18} color="#8E8E93" /> : <EyeOff size={18} color="#8E8E93" />}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, pwLoading && { opacity: 0.75 }]}
                onPress={handleChangePassword}
                disabled={pwLoading}
                activeOpacity={0.88}
              >
                <View style={styles.primaryBtnGrad}>
                  {pwLoading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.primaryBtnText}>{t('profile.confirm')}</Text>
                  }
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={styles.sectionLabel}>{t('profile.dangerZone')}</Text>
        <View style={[styles.section, styles.dangerSection]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconCircle, styles.dangerIconCircle]}>
              <Trash2 size={18} color="#FFFFFF" />
            </View>
            <Text style={[styles.sectionTitle, styles.dangerTitle]}>{t('profile.dangerTitle')}</Text>
          </View>

          <Text style={styles.dangerBody}>
             {t('profile.dangerBody', { permanent: t('profile.permanent') })}
          </Text>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => { setDeleteError(''); setDeleteConfirmText(''); setDeleteModalVisible(true); }}
            activeOpacity={0.82}
          >
            <Trash2 size={17} color="#FF3B30" />
            <Text style={styles.deleteBtnText}>{t('profile.delete')}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Delete account confirmation modal ── */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}>
              <TriangleAlert size={28} color="#dc2626" />
            </View>

            <Text style={styles.modalTitle}>{t('profile.deleteTitle')}</Text>

            <Text style={styles.modalBody}>
              {t('profile.deleteBody')}
            </Text>

            <View style={styles.confirmInputWrapper}>
              <Text style={styles.confirmInputLabel}>
                {t('profile.type', { phrase: t('profile.confirmPhrase') })}
              </Text>
              <TextInput
                style={[
                  styles.confirmInput,
                  deleteConfirmText === CONFIRM_PHRASE && styles.confirmInputValid,
                ]}
                value={deleteConfirmText}
                onChangeText={(t) => { setDeleteConfirmText(t); setDeleteError(''); }}
                placeholder={t('profile.confirmPhrase')}
                placeholderTextColor="#fca5a5"
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!deleteLoading}
              />
            </View>

            {deleteError ? (
              <View style={styles.modalErrorBox}>
                <Text style={styles.modalErrorText}>{deleteError}</Text>
              </View>
            ) : null}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setDeleteModalVisible(false); setDeleteError(''); setDeleteConfirmText(''); }}
                disabled={deleteLoading}
              >
                <Text style={styles.cancelBtnText}>{t('profile.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmDeleteBtn,
                  (deleteLoading || deleteConfirmText !== CONFIRM_PHRASE) && styles.confirmDeleteBtnDisabled,
                ]}
                onPress={handleDeleteAccount}
                disabled={deleteLoading || deleteConfirmText !== CONFIRM_PHRASE}
                activeOpacity={0.82}
              >
                {deleteLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Trash2 size={16} color="#fff" />
                    <Text style={styles.confirmDeleteText}>{t('profile.yesDelete')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 20,
    color: '#000000',
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 110,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  sectionLabel: {
    color: '#6D6D72',
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    marginLeft: 15,
    marginBottom: 7,
  },

  tokenCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
  },
  tokenCardGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 66,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  tokenCardLeft: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#8E8E93',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tokenCardRight: { flex: 1 },
  tokenCardLabel: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: '#111111',
  },
  tokenAmountRow: { alignItems: 'flex-end', marginLeft: 10 },
  tokenCardAmount: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#3A3A3C',
  },
  tokenCardSub: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 10,
    color: '#8E8E93',
  },

  avatarCard: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 24,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8E8E93',
    marginRight: 14,
  },
  accountCopy: {
    flex: 1,
    minWidth: 0,
  },
  accountName: {
    color: '#111111',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 17,
    marginBottom: 3,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emailText: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: '#7A7A80',
  },

  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 24,
  },
  dangerSection: {
    paddingBottom: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sectionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#8E8E93',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerIconCircle: {
    backgroundColor: '#FF3B30',
  },
  sectionTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    color: '#111111',
  },
  dangerTitle: {
    color: '#111111',
  },

  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#dc2626',
  },
  errorText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: '#b91c1c',
    textAlign: 'center',
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0,
    borderRadius: 11,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#111111',
    height: 46,
  },
  eyeBtn: { paddingLeft: 8, paddingRight: 2 },

  primaryBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
  },
  primaryBtnGrad: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#007AFF',
  },
  primaryBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  successBox: {
    alignItems: 'center',
    gap: 14,
  },
  successText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: '#007AFF',
    textAlign: 'center',
    lineHeight: 20,
    backgroundColor: '#EEF6FF',
    padding: 14,
    borderRadius: 14,
    width: '100%',
  },
  successBtn: {
    width: '100%',
    borderRadius: 50,
    overflow: 'hidden',
  },
  successBtnGrad: {
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: 50,
    backgroundColor: '#007AFF',
  },
  successBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#fff',
  },

  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    minHeight: 54,
    paddingVertical: 12,
    marginBottom: 24,
  },
  signOutBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: '#FF3B30',
  },

  dangerBody: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  dangerBold: {
    fontFamily: 'Poppins_600SemiBold',
    color: '#dc2626',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D8D8DC',
  },
  deleteBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: '#FF3B30',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 14,
  },
  modalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  modalTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 22,
    color: '#1a1a1a',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalBody: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  modalBold: {
    fontFamily: 'Poppins_600SemiBold',
    color: '#dc2626',
  },
  confirmInputWrapper: {
    width: '100%',
    marginBottom: 16,
  },
  confirmInputLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmPhrase: {
    fontFamily: 'Poppins_600SemiBold',
    color: '#dc2626',
    letterSpacing: 1,
  },
  confirmInput: {
    borderWidth: 2,
    borderColor: '#fca5a5',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    letterSpacing: 2,
    backgroundColor: '#fff5f5',
  },
  confirmInputValid: {
    borderColor: '#dc2626',
    backgroundColor: '#fee2e2',
  },
  modalErrorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    width: '100%',
    borderLeftWidth: 3,
    borderLeftColor: '#dc2626',
  },
  modalErrorText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: '#b91c1c',
    textAlign: 'center',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: '#6b7280',
  },
  confirmDeleteBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 50,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmDeleteBtnDisabled: {
    backgroundColor: '#f87171',
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmDeleteText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: '#fff',
  },
});
