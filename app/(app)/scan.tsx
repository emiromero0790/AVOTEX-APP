import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Modal,
  useWindowDimensions,
} from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { RotateCw as RotateCwIcon, Camera as CameraIcon, Shield, Lock } from "lucide-react-native";
import Toast from "react-native-toast-message";
import { useFocusEffect } from "expo-router";
import * as FileSystem from "expo-file-system";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";

import { auth } from "../../firebaseConfig";
import { User, onAuthStateChanged } from "firebase/auth";
import { supabase } from "../../supabaseConfig";
import { useGuest, GUEST_MAX_SCANS } from "../../context/GuestContext";

const IA_ROW_ID = '7293688b-1ee9-469c-9679-d69d9a1089a5';

type FruitPrediction = {
  class_index: number;
  class_name: string;
  confidence: number;
};

type StatePrediction = {
  class_index: number;
  class_name: string;
  confidence: number;
};

type NormalizedPrediction = {
  fruit: FruitPrediction;       
  state: StatePrediction;       
  allFruits?: FruitPrediction[];
  allStates?: StatePrediction[];
};


const HEALTHY_LABELS = ["saludable", "healthy", "sano", "fresh", "fresco"];

const isHealthyLabel = (label: string) =>
  HEALTHY_LABELS.some((h) => label.toLowerCase().includes(h));

export default function Scan() {
  const [permission, requestPermission] = useCameraPermissions();
  const [type, setType] = useState<CameraType>("back");
  const [prediction, setPrediction] = useState<NormalizedPrediction | null>(null);
  const cameraRef = useRef<any>(null);

  const [user, setUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const isBusyRef = useRef(false);
  const spinValue = useRef(new Animated.Value(0)).current;

  const [scanModalVisible, setScanModalVisible] = useState(true);
  const [scanAccepted, setScanAccepted] = useState(false);

  const [predictUrl, setPredictUrl] = useState<string | null>(null);
  const [userTokens, setUserTokens] = useState<number | null>(null);

  const { isGuest, guestScansLeft, decrementGuestScans } = useGuest();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const scanFrameSize = isTablet ? 320 : 240;

  useEffect(() => {
    if (isProcessing || isSaving) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinValue.setValue(0);
    }
  }, [isProcessing, isSaving]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('ia').select('url').eq('id', IA_ROW_ID).single();
        if (data?.url) setPredictUrl(data.url);
      } catch (e) {
        console.warn('No se pudo obtener la URL del modelo IA:', e);
      }
    })();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.email || isGuest) return;
    supabase.from('users').select('tokens').eq('user_email', user.email).maybeSingle()
      .then(({ data, error }) => {
        if (error) { console.warn('[tokens] error:', error.message); setUserTokens(0); return; }
        setUserTokens(data?.tokens ?? 0);
      });
  }, [user?.email, isGuest]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.email || isGuest) return;
      const email = user.email;
      supabase.from('users').select('tokens').eq('user_email', email).maybeSingle()
        .then(({ data, error }) => {
          if (error) { console.warn('[tokens focus] error:', error.message); setUserTokens(0); return; }
          setUserTokens(data?.tokens ?? 0);
        });
    }, [user?.email, isGuest])
  );

  // Parse the new model response format:
  // { result: { fruit: [...], state: [...] } }
  const normalizeServerResponse = (data: any): NormalizedPrediction | null => {
    try {
      if (!data?.result) return null;

      const fruits: FruitPrediction[] = data.result.fruit;
      const states: StatePrediction[] = data.result.state;

      if (!Array.isArray(fruits) || fruits.length === 0) return null;
      if (!Array.isArray(states) || states.length === 0) return null;

      return {
        fruit: fruits[0],
        state: states[0],
        allFruits: fruits,
        allStates: states,
      };
    } catch {
      return null;
    }
  };

  const saveScanResult = async (pred: NormalizedPrediction) => {
    if (!user) return;

    setIsSaving(true);
    isBusyRef.current = true;
    try {
      const scanRecord = {
        user_id: user.uid,
        user_email: user.email,
        fruto: pred.fruit.class_name,          // new column: which fruit
        label: pred.state.class_name,           // health state / disease
        score: pred.state.confidence,
        created_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("scans").insert([scanRecord]);
      if (error) throw error;
      Toast.show({ type: "success", text1: "Diagnóstico Guardado" });
    } catch (error) {
      console.error("Error al guardar datos en Supabase:", error);
      Toast.show({
        type: "error",
        text1: "Error al Guardar",
        text2: "No se pudieron guardar los datos.",
      });
    } finally {
      setIsSaving(false);
      isBusyRef.current = false;
    }
  };

  // Primary: multipart/form-data with top_k=3
  const sendImageMultipart = async (image: { uri: string }) => {
    if (!predictUrl) return null;
    const formData = new FormData();
    formData.append("file", {
      uri: image.uri,
      name: "photo.jpg",
      type: "image/jpeg",
    } as any);
    try {
      const res = await fetch(`${predictUrl}/predict?top_k=3`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return normalizeServerResponse(data);
    } catch (e) {
      console.warn("Fallo multipart, intentando base64 fallback:", e);
      return null;
    }
  };

  // Fallback: base64
  const sendImageBase64 = async (image: { uri: string }) => {
    if (!predictUrl) return null;
    try {
      const base64 = await FileSystem.readAsStringAsync(image.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const res = await fetch(`${predictUrl}/predict_base64?top_k=3`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: base64 }),
      });
      if (!res.ok) throw new Error(`HTTP base64 ${res.status}`);
      const data = await res.json();
      return normalizeServerResponse(data);
    } catch (e) {
      console.error("Error en fallback base64:", e);
      return null;
    }
  };

  const takePicture = async () => {
    if (!scanAccepted) return;
    if (isBusyRef.current || isProcessing || isSaving) return;
    if (!cameraRef.current) return;

    if (isGuest) {
      const allowed = await decrementGuestScans();
      if (!allowed) {
        Toast.show({
          type: "error",
          text1: "Límite alcanzado",
          text2: "Crea una cuenta para continuar escaneando.",
        });
        return;
      }
    } else if (user) {
      if (userTokens !== null && userTokens <= 0) {
        Toast.show({
          type: "error",
          text1: "Sin Tokens disponibles",
          text2: "Contacta a VEX para obtener más Tokens.",
        });
        return;
      }
      if (userTokens !== null && userTokens > 0) {
        const newTokens = userTokens - 1;
        setUserTokens(newTokens);
        supabase.from('users').update({ tokens: newTokens }).eq('user_email', user.email).then(() => {});
      }
    }

    isBusyRef.current = true;
    setIsProcessing(true);
    setPrediction(null);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: true,
      });

      let pred = await sendImageMultipart(photo);
      if (!pred) pred = await sendImageBase64(photo);

      if (pred) {
        setPrediction(pred);
        if (!isGuest) {
          await saveScanResult(pred);
        }
      } else {
        // Use a sentinel so the UI can show an error state without crashing
        setPrediction(null);
        Toast.show({ type: "error", text1: "No se pudo analizar la imagen", text2: "Intenta de nuevo." });
      }
    } catch (e) {
      console.error("Error capturando o procesando foto:", e);
      Toast.show({ type: "error", text1: "Error de captura" });
    } finally {
      setIsProcessing(false);
      isBusyRef.current = false;
    }
  };

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Necesitamos acceso a la cámara</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Continuar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const toggleCameraType = () => {
    setType((current) => (current === "back" ? "front" : "back"));
  };

  // Build the result card text
  const renderPredictionContent = () => {
    if (!prediction) return null;
    const healthy = isHealthyLabel(prediction.state.class_name);
    const fruitPct = (prediction.fruit.confidence * 100).toFixed(1);
    const statePct = (prediction.state.confidence * 100).toFixed(1);

    return (
      <View style={[styles.predictionCard, isTablet && styles.predictionCardTablet]}>
        {/* Fruit row */}
        <View style={styles.predictionRow}>
          <Text style={[styles.predictionEmoji, isTablet && styles.predictionEmojiTablet]}>🍑</Text>
          <View style={styles.predictionInfo}>
            <Text style={[styles.predictionLabel, isTablet && styles.predictionLabelTablet]}>
              {prediction.fruit.class_name}
            </Text>
            <Text style={[styles.predictionSub, isTablet && styles.predictionSubTablet]}>
              Confianza: {fruitPct}%
            </Text>
          </View>
        </View>

        <View style={styles.predictionDivider} />

        {/* State / disease row */}
        <View style={styles.predictionRow}>
          <Text style={[styles.predictionEmoji, isTablet && styles.predictionEmojiTablet]}>
            {healthy ? "✅" : "🦠"}
          </Text>
          <View style={styles.predictionInfo}>
            <Text style={[
              styles.predictionLabel,
              isTablet && styles.predictionLabelTablet,
              { color: healthy ? "#16a34a" : "#dc2626" }
            ]}>
              {prediction.state.class_name}
            </Text>
            <Text style={[styles.predictionSub, isTablet && styles.predictionSubTablet]}>
              Confianza: {statePct}%
            </Text>
          </View>
        </View>

        {/* Alternatives (top 2 & 3) */}
        {prediction.allFruits && prediction.allFruits.length > 1 && (
          <View style={styles.altSection}>
            <Text style={[styles.altTitle, isTablet && styles.altTitleTablet]}>Otras posibles frutas:</Text>
            {prediction.allFruits.slice(1).map((f, i) => (
              <Text key={i} style={[styles.altItem, isTablet && styles.altItemTablet]}>
                • {f.class_name} ({(f.confidence * 100).toFixed(1)}%)
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  };

  const isHealthy = prediction ? isHealthyLabel(prediction.state.class_name) : false;

  const guestLimitReached = isGuest && guestScansLeft <= 0;
  const userLimitReached = !isGuest && user !== null && userTokens !== null && userTokens <= 0;
  const limitReached = guestLimitReached || userLimitReached;

  return (
    <View style={styles.container}>
      {/* Scan privacy modal */}
      <Modal
        visible={scanModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isTablet && styles.modalCardTablet]}>
            <View style={styles.modalIconCircle}>
              <Shield size={30} color="#0f766e" />
            </View>

            <Text style={[styles.modalTitle, isTablet && styles.modalTitleTablet]}>📷 Uso de la Cámara e Imágenes</Text>
            <Text style={[styles.modalSubtitle, isTablet && styles.modalSubtitleTablet]}>Importante leer antes de escanear</Text>

            <View style={styles.guestScanInfo}>
              <Text style={styles.guestScanInfoText}>
                {isGuest
                  ? <>🪙 Modo invitado: tienes <Text style={styles.guestScanCount}>{(guestScansLeft * 100).toLocaleString('es-MX')} Tokens</Text> disponibles</>
                  : userTokens !== null
                    ? <>🪙 Tienes <Text style={styles.guestScanCount}>{(userTokens * 100).toLocaleString('es-MX')} Tokens</Text> disponibles</>
                    : <>🪙 Cargando Tokens...</>
                }
              </Text>
            </View>

            <View style={styles.modalSection}>
              <Text style={[styles.modalSectionTitle, isTablet && styles.modalSectionTitleTablet]}>🔍 ¿Cómo funciona el escaneo?</Text>
              <Text style={[styles.modalBodyText, isTablet && styles.modalBodyTextTablet]}>
                La cámara captura una foto del cultivo o fruto y la envía a nuestra IA para su análisis en tiempo real. El modelo detecta el tipo de fruta y su estado de salud.
              </Text>
            </View>

            <View style={styles.modalSection}>
              <Text style={[styles.modalSectionTitle, isTablet && styles.modalSectionTitleTablet]}>🗑️ Uso de imágenes (IMPORTANTE)</Text>
              <View style={styles.highlightBox}>
                <View style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={[styles.bulletText, styles.boldText]}>Las imágenes NO se almacenan en servidores ni bases de datos</Text>
                </View>
                <View style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>Se envían temporalmente a una API de Inteligencia Artificial para su análisis</Text>
                </View>
                <View style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={[styles.bulletText, styles.boldText]}>Una vez procesadas, la imagen se elimina y no se conserva</Text>
                </View>
              </View>
            </View>

            <View style={styles.modalSection}>
              <Text style={[styles.modalSectionTitle, isTablet && styles.modalSectionTitleTablet]}>✅ ¿Qué sí se guarda?</Text>
              <Text style={[styles.modalBodyText, isTablet && styles.modalBodyTextTablet]}>
                {isGuest
                  ? "En modo invitado, los resultados no se guardan en ninguna base de datos."
                  : "Solo se almacena el resultado: el tipo de fruta detectada, el diagnóstico de salud y el porcentaje de confianza."}
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.acceptScanBtn}
                onPress={() => { setScanAccepted(true); setScanModalVisible(false); }}
              >
                <LinearGradient colors={['#34d399', '#0f766e']} style={styles.acceptBtnGrad}>
                  <Text style={[styles.acceptBtnText, isTablet && styles.acceptBtnTextTablet]}>Entendido, continuar</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Limit reached screen */}
      {limitReached ? (
        <View style={styles.limitContainer}>
          <LinearGradient colors={['#0f766e', '#134e4a']} style={StyleSheet.absoluteFill} />
          <View style={[styles.limitCard, isTablet && styles.limitCardTablet]}>
            <View style={styles.limitIconCircle}>
              <Lock size={36} color="#0f766e" />
            </View>
            <Text style={[styles.limitTitle, isTablet && styles.limitTitleTablet]}>
              {userLimitReached ? 'Sin Tokens disponibles' : 'Límite alcanzado'}
            </Text>
            <Text style={[styles.limitBody, isTablet && styles.limitBodyTablet]}>
              {userLimitReached
                ? 'Has utilizado todos tus Tokens.\nContacta a VEX para recargar tu cuenta.'
                : 'Has alcanzado el límite del modo invitado.\nCrea una cuenta para continuar escaneando.'}
            </Text>
            {guestLimitReached && (
              <TouchableOpacity
                style={styles.limitLoginBtn}
                onPress={() => router.replace('/(auth)')}
              >
                <LinearGradient colors={['#34d399', '#0f766e']} style={styles.limitBtnGrad}>
                  <Text style={[styles.limitBtnText, isTablet && styles.limitBtnTextTablet]}>Crear cuenta / Iniciar sesión</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <CameraView style={styles.camera} type={type} ref={cameraRef} facing={type}>
          <View style={styles.overlay}>
            <View style={[styles.header, isTablet && styles.headerTablet]}>
              <Text style={[styles.headerText, isTablet && styles.headerTextTablet]}>Escanear Fruto</Text>
              <Text style={[styles.headerSubtext, isTablet && styles.headerSubtextTablet]}>Apunta al fruto para analizarlo</Text>
              {isGuest ? (
                <View style={[styles.guestCounter, isTablet && styles.guestCounterTablet]}>
                  <Text style={[styles.guestCounterText, isTablet && styles.guestCounterTextTablet]}>
                    🪙 {(guestScansLeft * 100).toLocaleString('es-MX')} Tokens restantes
                  </Text>
                </View>
              ) : userTokens !== null ? (
                <View style={[styles.guestCounter, isTablet && styles.guestCounterTablet]}>
                  <Text style={[styles.guestCounterText, isTablet && styles.guestCounterTextTablet]}>
                    🪙 {(userTokens * 100).toLocaleString('es-MX')} Tokens disponibles
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={[styles.scanFrame, { width: scanFrameSize, height: scanFrameSize }]}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>

            <View style={[styles.controls, isTablet && styles.controlsTablet]}>
              <TouchableOpacity
                style={[styles.flipButton, isTablet && styles.flipButtonTablet]}
                onPress={toggleCameraType}
                disabled={isProcessing}
              >
                <RotateCwIcon color="#eee" size={isTablet ? 34 : 28} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.captureButton,
                  isTablet && styles.captureButtonTablet,
                  (isProcessing || isSaving) && styles.captureButtonDisabled,
                ]}
                onPress={takePicture}
                disabled={isProcessing || isSaving}
              >
                <View style={[styles.captureButtonInner, isTablet && styles.captureButtonInnerTablet]}>
                  <CameraIcon color="#fff" size={isTablet ? 38 : 32} />
                </View>
              </TouchableOpacity>

              <View style={{ width: isTablet ? 72 : 56 }} />
            </View>
          </View>
        </CameraView>
      )}

      {/* Spinner overlay */}
      {(isSaving || isProcessing) && (
        <View style={styles.savingOverlay}>
          <View style={[styles.loadingContainer, isTablet && styles.loadingContainerTablet]}>
            <Animated.View
              style={[styles.fruitSpinner, isTablet && styles.fruitSpinnerTablet, { transform: [{ rotate: spin }] }]}
            >
              <Text style={[styles.fruitEmoji, isTablet && styles.fruitEmojiTablet]}>🌿</Text>
            </Animated.View>
            <Text style={[styles.savingTitle, isTablet && styles.savingTitleTablet]}>
              {isSaving ? "Guardando" : "Analizando"}
            </Text>
            <Text style={[styles.savingSubtitle, isTablet && styles.savingSubtitleTablet]}>
              {isSaving ? "Tu diagnóstico se está guardando..." : "Detectando fruto y estado del cultivo..."}
            </Text>
          </View>
        </View>
      )}

      {/* Result card */}
      {prediction && !isSaving && !isProcessing && !limitReached && (
        <View style={[
          styles.predictionWrapper,
          isHealthy ? styles.predictionWrapperHealthy : styles.predictionWrapperSick,
          isTablet && styles.predictionWrapperTablet,
        ]}>
          {renderPredictionContent()}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  camera: { flex: 1 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)", padding: 20 },

  header: { paddingTop: 50, alignItems: "center", marginBottom: 20 },
  headerTablet: { paddingTop: 60, marginBottom: 28 },
  headerText: { color: "#ffffff", fontSize: 22, fontFamily: "Poppins-SemiBold", letterSpacing: 0.5 },
  headerTextTablet: { fontSize: 28 },
  headerSubtext: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Poppins-Regular", marginTop: 4 },
  headerSubtextTablet: { fontSize: 16, marginTop: 6 },

  guestCounter: {
    marginTop: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.6)',
  },
  guestCounterTablet: { marginTop: 14, paddingHorizontal: 22, paddingVertical: 8 },
  guestCounterText: { color: '#fbbf24', fontFamily: 'Poppins-SemiBold', fontSize: 13 },
  guestCounterTextTablet: { fontSize: 16 },

  scanFrame: { alignSelf: 'center', marginTop: 20 },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#3aaa5c', borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },

  controls: {
    position: 'absolute',
    bottom: 190,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 40,
  },
  controlsTablet: { bottom: 260, gap: 60 },
  flipButton: { backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 30, padding: 12 },
  flipButtonTablet: { padding: 16, borderRadius: 36 },
  captureButton: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center", alignItems: "center",
    borderWidth: 4, borderColor: "#ffffff",
  },
  captureButtonTablet: { width: 100, height: 100, borderRadius: 50 },
  captureButtonDisabled: { opacity: 0.5 },
  captureButtonInner: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "#3aaa5c",
    justifyContent: "center", alignItems: "center",
  },
  captureButtonInnerTablet: { width: 80, height: 80, borderRadius: 40 },

  // ── New result card ──────────────────────────────────────
  predictionWrapper: {
    position: "absolute",
    bottom: 110,
    left: 16,
    right: 16,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  predictionWrapperTablet: { bottom: 150, left: 40, right: 40, borderRadius: 26 },
  predictionWrapperHealthy: { backgroundColor: 'rgba(20,83,45,0.92)' },
  predictionWrapperSick: { backgroundColor: 'rgba(127,29,29,0.92)' },

  predictionCard: { padding: 16 },
  predictionCardTablet: { padding: 22 },

  predictionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  predictionEmoji: { fontSize: 28 },
  predictionEmojiTablet: { fontSize: 36 },
  predictionInfo: { flex: 1 },
  predictionLabel: { color: '#fff', fontFamily: 'Poppins-SemiBold', fontSize: 15 },
  predictionLabelTablet: { fontSize: 19 },
  predictionSub: { color: 'rgba(255,255,255,0.7)', fontFamily: 'Poppins-Regular', fontSize: 12, marginTop: 2 },
  predictionSubTablet: { fontSize: 14 },

  predictionDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: 10,
  },

  altSection: { marginTop: 10 },
  altTitle: { color: 'rgba(255,255,255,0.6)', fontFamily: 'Poppins-SemiBold', fontSize: 11, marginBottom: 4 },
  altTitleTablet: { fontSize: 13 },
  altItem: { color: 'rgba(255,255,255,0.55)', fontFamily: 'Poppins-Regular', fontSize: 11 },
  altItemTablet: { fontSize: 13 },
  // ────────────────────────────────────────────────────────

  text: { color: "#ffffff", fontSize: 18, fontFamily: "Poppins-Regular", textAlign: "center", marginBottom: 20 },
  button: { backgroundColor: "#3aaa5c", padding: 16, borderRadius: 12, alignItems: "center" },
  buttonText: { color: "#ffffff", fontSize: 18, fontFamily: "Poppins-SemiBold" },

  savingOverlay: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center', alignItems: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 28, padding: 36,
    borderWidth: 1, borderColor: 'rgba(58,170,92,0.4)',
  },
  loadingContainerTablet: { padding: 48, borderRadius: 36 },
  fruitSpinner: {
    width: 100, height: 100,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(58,170,92,0.2)',
    borderRadius: 50, marginBottom: 20,
  },
  fruitSpinnerTablet: { width: 130, height: 130, borderRadius: 65, marginBottom: 26 },
  fruitEmoji: { fontSize: 50 },
  fruitEmojiTablet: { fontSize: 64 },
  savingTitle: { color: '#ffffff', fontSize: 22, fontFamily: "Poppins-Bold", marginBottom: 8 },
  savingTitleTablet: { fontSize: 28 },
  savingSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontFamily: "Poppins-Regular", textAlign: 'center', maxWidth: 250 },
  savingSubtitleTablet: { fontSize: 17, maxWidth: 340 },

  limitContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 },
  limitCard: {
    backgroundColor: '#fff', borderRadius: 28, padding: 32,
    alignItems: 'center', width: '100%', maxWidth: 400,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25, shadowRadius: 24, elevation: 12,
  },
  limitCardTablet: { maxWidth: 520, padding: 48, borderRadius: 36 },
  limitIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#d1fae5',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  limitTitle: { fontFamily: 'Poppins-Bold', fontSize: 24, color: '#134e4a', marginBottom: 12, textAlign: 'center' },
  limitTitleTablet: { fontSize: 30 },
  limitBody: { fontFamily: 'Poppins-Regular', fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  limitBodyTablet: { fontSize: 17, lineHeight: 28, marginBottom: 36 },
  limitLoginBtn: { width: '100%', borderRadius: 50, overflow: 'hidden' },
  limitBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  limitBtnText: { fontFamily: 'Poppins-SemiBold', fontSize: 16, color: '#fff' },
  limitBtnTextTablet: { fontSize: 19 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff', borderRadius: 28, padding: 24,
    width: '100%', maxWidth: 420,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25, shadowRadius: 24, elevation: 12, alignItems: 'center',
  },
  modalCardTablet: { maxWidth: 560, padding: 36, borderRadius: 36 },
  modalIconCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#d1fae5',
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  modalTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 18, color: '#0f766e', textAlign: 'center', marginBottom: 4 },
  modalTitleTablet: { fontSize: 22 },
  modalSubtitle: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: '#94a3b8', textAlign: 'center', marginBottom: 14 },
  modalSubtitleTablet: { fontSize: 15, marginBottom: 18 },

  guestScanInfo: {
    backgroundColor: '#fffbeb', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10, marginBottom: 14,
    borderWidth: 1, borderColor: '#fcd34d', width: '100%',
  },
  guestScanInfoText: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: '#92400e', textAlign: 'center' },
  guestScanCount: { fontFamily: 'Poppins_600SemiBold', color: '#b45309' },

  modalSection: { width: '100%', marginBottom: 14 },
  modalSectionTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: '#134e4a', marginBottom: 6 },
  modalSectionTitleTablet: { fontSize: 15 },
  modalBodyText: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: '#334155', lineHeight: 19 },
  modalBodyTextTablet: { fontSize: 15, lineHeight: 23 },
  highlightBox: {
    backgroundColor: '#f0fdf4', borderRadius: 12, padding: 12,
    borderLeftWidth: 3, borderLeftColor: '#22c55e', gap: 6,
  },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start' },
  bulletDot: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: '#0f766e', marginRight: 7, marginTop: 1 },
  bulletText: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: '#334155', flex: 1, lineHeight: 18 },
  boldText: { fontFamily: 'Poppins_600SemiBold', color: '#134e4a' },

  modalButtons: { width: '100%', marginTop: 6 },
  acceptScanBtn: { borderRadius: 50, overflow: 'hidden' },
  acceptBtnGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  acceptBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: '#ffffff' },
  acceptBtnTextTablet: { fontSize: 19, paddingVertical: 4 },
});