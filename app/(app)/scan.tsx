import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { RotateCw as RotateCwIcon, Shield, Lock, ChevronLeft, Focus, CheckCircle2, AlertTriangle } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Reanimated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import * as FileSystem from "expo-file-system/legacy";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";

import { auth } from "../../firebaseConfig";
import { User, onAuthStateChanged } from "firebase/auth";
import { supabase } from "../../supabaseConfig";
import { useGuest, GUEST_MAX_SCANS } from "../../context/GuestContext";
import { localizeDomainLabel, TranslationResource, useLanguage, useTranslations } from "../../context/LanguageContext";
import ScanHome from "../../components/ScanHome";
import TokenRing from "../../components/TokenRing";
import { listLocal } from "../../services/recorridos";
import { insertSingleScan, uploadScanImage } from "../../services/escaneos";
import { resolveScanHuerta, type HuertaResolution } from "../../services/huertaResolver";
import OrchardPickerSheet from "../../components/scan/OrchardPickerSheet";
import * as Location from "expo-location";
import { CSS_EASE_OUT, EASE_OUT, PressableScale } from "../../components/scan/motion";

// Entradas y salidas de una sola vez (resultado, estado de análisis). Constantes de módulo, ver skill animate-expo.
const RESULT_ENTER = FadeInDown.duration(260).easing(EASE_OUT);
const RESULT_ENTER_REDUCED = FadeIn.duration(200);
const RESULT_EXIT = FadeOut.duration(180);
const STATE_FADE_IN = FadeIn.duration(200).easing(EASE_OUT);
const STATE_FADE_OUT = FadeOut.duration(160);
const CAMERA_ENTER = FadeIn.duration(240).easing(EASE_OUT);

// Destello breve al capturar: confirma que la foto se tomó.
const FLASH_KEYFRAMES = { from: { opacity: 0.75 }, to: { opacity: 0 } };


const scanTranslations: TranslationResource = {
  cameraAccess: { es: "Necesitamos acceso a la cámara", en: "Camera access is required" },
  continue: { es: "Continuar", en: "Continue" },
  saved: { es: "Diagnóstico Guardado", en: "Diagnosis Saved" },
  saveError: { es: "Error al Guardar", en: "Save Error" },
  saveErrorDetail: { es: "No se pudieron guardar los datos.", en: "The data could not be saved." },
  guestLimit: { es: "Límite alcanzado", en: "Limit reached" },
  guestLimitDetail: { es: "Crea una cuenta para continuar escaneando.", en: "Create an account to keep scanning." },
  noTokens: { es: "Sin Tokens disponibles", en: "No Tokens available" },
  noTokensDetail: { es: "Contacta a VEX para obtener más Tokens.", en: "Contact VEX to get more Tokens." },
  analyzeError: { es: "No se pudo analizar la imagen", en: "The image could not be analyzed" },
  tryAgain: { es: "Intenta de nuevo.", en: "Try again." },
  captureError: { es: "Error de captura", en: "Capture error" },
  confidence: { es: "Confianza: {percent}%", en: "Confidence: {percent}%" },
  accept: { es: "Aceptar", en: "Accept" },
  cameraTitle: { es: "Uso de la cámara e imágenes", en: "Camera and image use" },
  cameraSubtitle: { es: "Importante leer antes de escanear", en: "Important: read before scanning" },
  guestTokens: { es: "Modo invitado: tienes {tokens} Tokens disponibles", en: "Guest mode: you have {tokens} Tokens available" },
  tokensAvailable: { es: "Tienes {tokens} Tokens disponibles", en: "You have {tokens} Tokens available" },
  loadingTokens: { es: "Cargando Tokens...", en: "Loading Tokens..." },
  howScan: { es: "¿Cómo funciona el escaneo?", en: "How does scanning work?" },
  howScanBody: { es: "La cámara captura una foto del cultivo o fruto y la envía a nuestra IA para su análisis en tiempo real. El modelo detecta el tipo de fruta y su estado de salud.", en: "The camera captures a photo of the crop or fruit and sends it to our AI for real-time analysis. The model detects the type of fruit and its health condition." },
  imageUse: { es: "Uso de imágenes (IMPORTANTE)", en: "Image use (IMPORTANT)" },
  noStore: { es: "Las imágenes NO se almacenan en servidores ni bases de datos", en: "Images are NOT stored on servers or databases" },
  temporary: { es: "Se envían temporalmente a una API de Inteligencia Artificial para su análisis", en: "They are temporarily sent to an Artificial Intelligence API for analysis" },
  deleted: { es: "Una vez procesadas, la imagen se elimina y no se conserva", en: "Once processed, the image is deleted and not retained" },
  whatSaved: { es: "✅ ¿Qué sí se guarda?", en: "✅ What is saved?" },
  guestNotSaved: { es: "En modo invitado, los resultados no se guardan en ninguna base de datos.", en: "In guest mode, results are not saved to any database." },
  savedDetail: { es: "Solo se almacena el resultado: el tipo de fruta detectada, el diagnóstico de salud y el porcentaje de confianza.", en: "Only the result is stored: the detected fruit type, health diagnosis, and confidence percentage." },
  understood: { es: "Entendido, continuar", en: "Understood, continue" },
  usedAll: { es: "Has utilizado todos tus Tokens.\nContacta a VEX para recargar tu cuenta.", en: "You have used all your Tokens.\nContact VEX to recharge your account." },
  guestReached: { es: "Has alcanzado el límite del modo invitado.\nCrea una cuenta para continuar escaneando.", en: "You have reached the guest mode limit.\nCreate an account to keep scanning." },
  account: { es: "Crear cuenta / Iniciar sesión", en: "Create account / Sign in" },
  scan: { es: "Escanear Fruto", en: "Scan Fruit" },
  aim: { es: "Apunta al fruto para analizarlo", en: "Point at the fruit to analyze it" },
  remaining: { es: "{tokens} Tokens restantes", en: "{tokens} Tokens remaining" },
  analyzing: { es: "Analizando", en: "Analyzing" },
  saving: { es: "Guardando", en: "Saving" },
  analyzingDetail: { es: "Detectando fruto y estado del cultivo...", en: "Detecting fruit and crop condition..." },
  savingDetail: { es: "Tu diagnóstico se está guardando...", en: "Your diagnosis is being saved..." },
  flipCamera: { es: "Cambiar cámara", en: "Switch camera" },
  takePhoto: { es: "Tomar foto", en: "Take photo" },
  modes: { es: "Modos", en: "Modes" },
  backToModes: { es: "Volver a elegir el modo de escaneo", en: "Back to scan modes" },
  photoMode: { es: "Foto individual", en: "Single photo" },
  checkingOrchard: { es: "Verificando tu ubicación…", en: "Checking your location…" },
  inOrchard: { es: "Huerta: {name}", en: "Orchard: {name}" },
  noOrchard: { es: "Sin huerta asignada", en: "No orchard assigned" },
  autoOrchard: { es: "Estás en {name}", en: "You are in {name}" },
  autoOrchardDetail: { es: "Las fotos se guardarán en esta huerta.", en: "Photos will be saved to this orchard." },
  tip1: { es: "Centra un solo fruto en el recuadro", en: "Center one fruit in the frame" },
  tip2: { es: "Buena luz, sin contraluz", en: "Good light, no backlight" },
  tip3: { es: "A unos 30 cm del fruto", en: "About 30 cm from the fruit" },
  resultHealthy: { es: "Fruto sano", en: "Healthy fruit" },
  resultIssue: { es: "Posible problema detectado", en: "Possible issue detected" },
  fruitLabel: { es: "Fruto", en: "Fruit" },
  stateLabel: { es: "Estado", en: "Condition" },
  scanAgain: { es: "Escanear otro", en: "Scan another" },
};

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
  const t = useTranslations(scanTranslations);
  const { locale, language } = useLanguage();
  const [permission, requestPermission] = useCameraPermissions();
  const [type, setType] = useState<CameraType>("back");
  const [prediction, setPrediction] = useState<NormalizedPrediction | null>(null);
  const cameraRef = useRef<any>(null);

  const [user, setUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const isBusyRef = useRef(false);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  // Cada captura cambia la llave y vuelve a montar el destello (una sola reproducción por foto).
  const [flashKey, setFlashKey] = useState(0);

  // Al entrar a "Escanear" primero se elige el modo: foto individual o recorrido con IA.
  const [mode, setMode] = useState<"choose" | "photo">("choose");
  const [pendingWalks, setPendingWalks] = useState(0);
  const [pendingPhotos, setPendingPhotos] = useState(0);
  // El aviso de uso de la cámara se muestra al elegir la foto individual.
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [scanAccepted, setScanAccepted] = useState(false);
  // Huerta de la sesión de cámara: se decide ANTES de abrir la cámara y no cambia hasta volver a
  // Escanear (todas las fotos de esta sesión, sus reintentos y su guardado usan la misma).
  // undefined = sin decidir; null = el usuario eligió no asignar.
  const scanHuertaRef = useRef<string | null | undefined>(undefined);
  const [scanHuertaName, setScanHuertaName] = useState<string | null>(null);
  const [checkingOrchard, setCheckingOrchard] = useState(false);
  const [orchardPick, setOrchardPick] = useState<Extract<HuertaResolution, { kind: "manual" }> | null>(null);

  const [predictUrl, setPredictUrl] = useState<string | null>(null);
  const [userTokens, setUserTokens] = useState<number | null>(null);

  const { isGuest, guestScansLeft, decrementGuestScans } = useGuest();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const scanFrameSize = isTablet ? 320 : 240;

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

  // Escanear (video de la huerta arriba) y cámara: texto claro en la barra de estado.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      return () => setStatusBarStyle("dark");
    }, [mode])
  );

  // Al volver al selector se olvida la huerta de la sesión anterior.
  useEffect(() => {
    if (mode === "choose") {
      scanHuertaRef.current = undefined;
      setScanHuertaName(null);
    }
  }, [mode]);

  // Cada vez que se vuelve a la pestaña se muestra el selector de modo.
  useFocusEffect(
    useCallback(() => {
      setMode("choose");
      setPrediction(null);
      if (user?.email && !isGuest) {
        listLocal(user.email)
          .then(list => {
            setPendingWalks(list.length);
            setPendingPhotos(list.reduce((sum, r) => sum + r.fotos.length, 0));
          })
          .catch(() => { setPendingWalks(0); setPendingPhotos(0); });
      } else {
        setPendingWalks(0);
        setPendingPhotos(0);
      }
    }, [user?.email, isGuest])
  );

  const choosePhoto = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Toast.show({ type: "error", text1: t("cameraAccess") });
        return;
      }
    }
    // Invitados: sus fotos no se guardan, así que no hay huerta que asignar.
    if (isGuest || !user?.email) { openCamera(); return; }
    if (checkingOrchard) return;
    setCheckingOrchard(true);
    const res = await resolveScanHuerta(user.email);
    setCheckingOrchard(false);
    if (res.kind === "auto") {
      scanHuertaRef.current = res.huerta.id;
      setScanHuertaName(res.huerta.nombre);
      Toast.show({ type: "success", text1: t("autoOrchard", { name: res.huerta.nombre }), text2: t("autoOrchardDetail") });
      openCamera();
    } else {
      setOrchardPick(res);
    }
  };

  const openCamera = () => {
    setMode("photo");
    if (!scanAccepted) setScanModalVisible(true);
  };

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

  // Ubicación del escaneo solo si ya hay permiso (no se pregunta aquí) y la foto, para verlos en Mis escaneos.
  const scanExtras = async (photoUri: string | null) => {
    let lat: number | null = null, lng: number | null = null, precision: number | null = null;
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.granted) {
        const pos = (await Location.getLastKnownPositionAsync({ maxAge: 60000, requiredAccuracy: 50 }))
          ?? (await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise<null>(r => setTimeout(() => r(null), 4000)),
          ]));
        if (pos) { lat = pos.coords.latitude; lng = pos.coords.longitude; precision = pos.coords.accuracy ?? null; }
      }
    } catch { /* sin ubicación */ }
    const imagen_path = photoUri && user ? await uploadScanImage(user.uid, photoUri) : null;
    return { lat, lng, precision_m: precision, imagen_path };
  };

  const saveScanResult = async (pred: NormalizedPrediction, photoUri: string | null = null) => {
    if (!user) return;
    setIsSaving(true);
    isBusyRef.current = true;
    try {
      const scanRecord = {
        user_id: user.uid,
        user_email: user.email,
        fruto: pred.fruit.class_name,
        label: pred.state.class_name,
        score: pred.state.confidence,
        created_at: new Date().toISOString(),
      };
      // La huerta ya quedó decidida antes de abrir la cámara: no se vuelve a calcular aquí.
      const { error } = await insertSingleScan(scanRecord, { ...(await scanExtras(photoUri)), huerta_id: scanHuertaRef.current ?? null });
      if (error) throw error;
        Toast.show({ type: "success", text1: t("saved") });
    } catch (error) {
      console.error("Error al guardar datos en Supabase:", error);
      Toast.show({
        type: "error",
        text1: t("saveError"),
        text2: t("saveErrorDetail"),
      });
    } finally {
      setIsSaving(false);
      isBusyRef.current = false;
    }
  };

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
          text1: t("guestLimit"),
          text2: t("guestLimitDetail"),
        });
        return;
      }
    } else if (user) {
      if (userTokens !== null && userTokens <= 0) {
        Toast.show({
          type: "error",
          text1: t("noTokens"),
          text2: t("noTokensDetail"),
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

    // Mismo instante que el destello: una vibración media confirma el disparo.
    setFlashKey(k => k + 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: true,
      });

      let pred = Platform.OS === "web"
        ? await sendImageMultipart(photo)
        : await sendImageBase64(photo);
      if (!pred && Platform.OS === "web") pred = await sendImageBase64(photo);

      if (pred) {
        setPrediction(pred);
        Haptics.notificationAsync(
          isHealthyLabel(pred.state.class_name)
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning,
        ).catch(() => {});
        if (!isGuest) {
          await saveScanResult(pred, photo?.uri ?? null);
        }
      } else {
        setPrediction(null);
        Toast.show({ type: "error", text1: t("analyzeError"), text2: t("tryAgain") });
      }
    } catch (e) {
      console.error("Error capturando o procesando foto:", e);
      Toast.show({ type: "error", text1: t("captureError") });
    } finally {
      setIsProcessing(false);
      isBusyRef.current = false;
    }
  };

  if (mode === "choose") {
    // Mismo cálculo que ya muestra la cámara (tokens × 100).
    const tokensRemaining = isGuest ? guestScansLeft * 100 : userTokens !== null ? userTokens * 100 : null;
    return (
      <>
      <ScanHome
        isGuest={isGuest}
        tokensRemaining={tokensRemaining}
        email={user?.email ?? null}
        pendingCount={pendingWalks}
        onPhoto={choosePhoto}
        // `open`/`fuente` y `n` hacen que la pantalla destino (que sigue montada entre visitas)
        // abra el paso pedido cada vez que se pulsa el botón.
        onWalk={() => router.push({ pathname: "/(app)/recorrido", params: { open: "prepare", n: String(Date.now()) } })}
        onImport={fuente => router.push({ pathname: "/(app)/importar", params: { fuente, n: String(Date.now()) } })}
        onOpenScans={() => router.push({ pathname: "/(app)/escaneos", params: { n: String(Date.now()) } })}
        busyLabel={checkingOrchard ? t("checkingOrchard") : null}
      />
      <OrchardPickerSheet
        visible={!!orchardPick}
        reason={orchardPick?.reason ?? null}
        accuracyM={orchardPick?.accuracyM}
        orchards={orchardPick?.orchards ?? []}
        candidates={orchardPick?.candidates}
        onCancel={() => setOrchardPick(null)}
        onRegister={() => { setOrchardPick(null); router.navigate("/(app)/mapping"); }}
        onConfirm={huertaId => {
          const chosen = orchardPick?.orchards.find(o => o.id === huertaId) ?? null;
          scanHuertaRef.current = huertaId;
          setScanHuertaName(chosen?.nombre ?? null);
          setOrchardPick(null);
          openCamera();
        }}
      />
      </>
    );
  }

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>{t("cameraAccess")}</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>{t("continue")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const toggleCameraType = () => {
    setType((current) => (current === "back" ? "front" : "back"));
  };

  // ── Tarjeta de resultado: diagnóstico primero, confianza como dato secundario ──
  const renderPredictionContent = () => {
    if (!prediction) return null;
    const healthy = isHealthyLabel(prediction.state.class_name);
    const fruitPct = (prediction.fruit.confidence * 100).toFixed(1);
    const statePct = (prediction.state.confidence * 100).toFixed(1);
    const accent = healthy ? "#86efac" : "#fca5a5";

    return (
      <View style={[styles.predictionCard, isTablet && styles.predictionCardTablet]}>
        <View style={styles.resultHead}>
          <View style={[styles.resultIcon, { backgroundColor: healthy ? "rgba(134,239,172,0.18)" : "rgba(252,165,165,0.18)" }]}>
            {healthy ? <CheckCircle2 size={22} color={accent} /> : <AlertTriangle size={22} color={accent} />}
          </View>
          <Text style={[styles.resultTitle, isTablet && styles.resultTitleTablet]}>
            {healthy ? t("resultHealthy") : t("resultIssue")}
          </Text>
        </View>

        <View style={styles.resultRows}>
          <View style={styles.predictionRow}>
            <Text style={styles.resultKey}>{t("fruitLabel")}</Text>
            <View style={styles.predictionInfo}>
              <Text style={[styles.predictionLabel, isTablet && styles.predictionLabelTablet]}>
                {localizeDomainLabel(prediction.fruit.class_name, language)}
              </Text>
              <Text style={[styles.predictionSub, isTablet && styles.predictionSubTablet]}>
                {t("confidence", { percent: fruitPct })}
              </Text>
            </View>
          </View>

          <View style={styles.predictionDivider} />

          <View style={styles.predictionRow}>
            <Text style={styles.resultKey}>{t("stateLabel")}</Text>
            <View style={styles.predictionInfo}>
              <Text style={[styles.predictionLabel, isTablet && styles.predictionLabelTablet, { color: accent }]}>
                {localizeDomainLabel(prediction.state.class_name, language)}
              </Text>
              <Text style={[styles.predictionSub, isTablet && styles.predictionSubTablet]}>
                {t("confidence", { percent: statePct })}
              </Text>
            </View>
          </View>
        </View>

        <PressableScale
          style={[styles.acceptButton, isTablet && styles.acceptButtonTablet]}
          onPress={() => setPrediction(null)}
          accessibilityRole="button"
          accessibilityLabel={t("scanAgain")}
        >
          <Text style={[styles.acceptButtonText, isTablet && styles.acceptButtonTextTablet]}>
            {t("scanAgain")}
          </Text>
        </PressableScale>
      </View>
    );
  };

  const isHealthy = prediction ? isHealthyLabel(prediction.state.class_name) : false;

  const guestLimitReached = isGuest && guestScansLeft <= 0;
  const userLimitReached = !isGuest && user !== null && userTokens !== null && userTokens <= 0;
  const limitReached = guestLimitReached || userLimitReached;

  return (
    // Al abrir la cámara desde el selector, la vista entra con un fundido corto (continuidad entre pasos).
    <Reanimated.View entering={reducedMotion ? undefined : CAMERA_ENTER} style={styles.container}>
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

            <Text style={[styles.modalTitle, isTablet && styles.modalTitleTablet]}>{t("cameraTitle")}</Text>
            <Text style={[styles.modalSubtitle, isTablet && styles.modalSubtitleTablet]}>{t("cameraSubtitle")}</Text>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator
              persistentScrollbar
              nestedScrollEnabled
            >
              <View style={styles.guestScanInfo}>
                <Text style={styles.guestScanInfoText}>
                  {isGuest
                    ? <>{t("guestTokens", { tokens: (guestScansLeft * 100).toLocaleString(locale) })}</>
                    : userTokens !== null
                      ? <>{t("tokensAvailable", { tokens: (userTokens * 100).toLocaleString(locale) })}</>
                      : <>{t("loadingTokens")}</>
                  }
                </Text>
              </View>

              <View style={styles.modalSection}>
                <Text style={[styles.modalSectionTitle, isTablet && styles.modalSectionTitleTablet]}>{t("howScan")}</Text>
                <Text style={[styles.modalBodyText, isTablet && styles.modalBodyTextTablet]}>
                  {t("howScanBody")}
                </Text>
              </View>

              <View style={styles.modalSection}>
                <Text style={[styles.modalSectionTitle, isTablet && styles.modalSectionTitleTablet]}>{t("imageUse")}</Text>
                <View style={styles.highlightBox}>
                  <View style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>•</Text>
                     <Text style={[styles.bulletText, styles.boldText]}>{t("noStore")}</Text>
                  </View>
                  <View style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>•</Text>
                     <Text style={styles.bulletText}>{t("temporary")}</Text>
                  </View>
                  <View style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>•</Text>
                     <Text style={[styles.bulletText, styles.boldText]}>{t("deleted")}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={[styles.modalSectionTitle, isTablet && styles.modalSectionTitleTablet]}>{t("whatSaved")}</Text>
                <Text style={[styles.modalBodyText, isTablet && styles.modalBodyTextTablet]}>
                  {isGuest
                     ? t("guestNotSaved")
                     : t("savedDetail")}
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.acceptScanBtn}
                onPress={() => { setScanAccepted(true); setScanModalVisible(false); }}
              >
                <LinearGradient colors={['#34d399', '#0f766e']} style={styles.acceptBtnGrad}>
                  <Text style={[styles.acceptBtnText, isTablet && styles.acceptBtnTextTablet]}>{t("understood")}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Limit reached screen */}
      {limitReached ? (
        <View style={styles.limitContainer}>
             <View style={StyleSheet.absoluteFill} />
          {/* Sin saldo: se puede volver al selector (el recorrido no usa tokens). */}
          <PressableScale
            style={[styles.modesButton, styles.limitModes, { top: insets.top + 8 }]}
            onPress={() => setMode("choose")}
            accessibilityRole="button"
            accessibilityLabel={t("backToModes")}
          >
            <ChevronLeft size={18} color="#ffffff" />
            <Text style={styles.modesButtonText}>{t("modes")}</Text>
          </PressableScale>
          <View style={[styles.limitCard, isTablet && styles.limitCardTablet]}>
            <View style={styles.limitIconCircle}>
              <Lock size={36} color="#0f766e" />
            </View>
            <Text style={[styles.limitTitle, isTablet && styles.limitTitleTablet]}>
               {userLimitReached ? t("noTokens") : t("guestLimit")}
            </Text>
            <Text style={[styles.limitBody, isTablet && styles.limitBodyTablet]}>
              {userLimitReached
                 ? t("usedAll")
                 : t("guestReached")}
            </Text>
            {guestLimitReached && (
              <TouchableOpacity
                style={styles.limitLoginBtn}
                onPress={() => router.replace('/(auth)')}
              >
                <LinearGradient colors={['#34d399', '#0f766e']} style={styles.limitBtnGrad}>
                  <Text style={[styles.limitBtnText, isTablet && styles.limitBtnTextTablet]}>{t("account")}</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <CameraView style={styles.camera} type={type} ref={cameraRef} facing={type}>
          <View style={styles.overlay}>
            <LinearGradient
              colors={["rgba(10,6,24,0.72)", "rgba(10,6,24,0)"]}
              style={[styles.topShade, { paddingTop: insets.top + 8 }]}
              pointerEvents="box-none"
            >
              <View style={styles.topBar}>
                <PressableScale
                  style={styles.modesButton}
                  onPress={() => { setPrediction(null); setMode("choose"); }}
                  accessibilityRole="button"
                  accessibilityLabel={t("backToModes")}
                >
                  <ChevronLeft size={18} color="#ffffff" />
                  <Text style={styles.modesButtonText}>{t("modes")}</Text>
                </PressableScale>
                {(isGuest || userTokens !== null) && (
                  <TokenRing remaining={(isGuest ? guestScansLeft : userTokens ?? 0) * 100} isGuest={isGuest} email={user?.email ?? null} variant="dark" size={40} />
                )}
              </View>
              <View style={[styles.header, isTablet && styles.headerTablet]}>
                <View style={styles.modeTag}>
                  <View style={styles.modeTagDot} />
                  <Text style={styles.modeTagText}>{t("photoMode")}</Text>
                </View>
                {!isGuest && scanHuertaRef.current !== undefined && (
                  <Text style={styles.orchardTagText} numberOfLines={1}>
                    {scanHuertaName ? t("inOrchard", { name: scanHuertaName }) : t("noOrchard")}
                  </Text>
                )}
                <Text style={[styles.headerText, isTablet && styles.headerTextTablet]}>{t("aim")}</Text>
              </View>
            </LinearGradient>

            <View style={[styles.scanFrame, { width: scanFrameSize, height: scanFrameSize }]}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
              <View style={styles.frameCenter}><Focus size={22} color="rgba(255,255,255,0.55)" /></View>
            </View>

            {/* Guía de encuadre: tres consejos cortos, visibles antes de disparar */}
            {!prediction && !isProcessing && !isSaving && (
              <View style={styles.tips} pointerEvents="none">
                {[t("tip1"), t("tip2"), t("tip3")].map((tip) => (
                  <View key={tip} style={styles.tipChip}><Text style={styles.tipText}>{tip}</Text></View>
                ))}
              </View>
            )}

            <View style={[styles.controls, isTablet && styles.controlsTablet]}>
              <PressableScale
                style={[styles.flipButton, isTablet && styles.flipButtonTablet]}
                accessibilityRole="button"
                accessibilityLabel={t("flipCamera")}
                onPress={toggleCameraType}
                disabled={isProcessing}
              >
                <RotateCwIcon color="#eee" size={isTablet ? 30 : 24} />
              </PressableScale>

              <PressableScale
                pressedScale={0.92}
                style={[
                  styles.captureButton,
                  isTablet && styles.captureButtonTablet,
                  (isProcessing || isSaving) && styles.captureButtonDisabled,
                ]}
                onPress={takePicture}
                accessibilityRole="button"
                accessibilityLabel={t("takePhoto")}
                disabled={isProcessing || isSaving}
              >
                <View style={[styles.captureButtonInner, isTablet && styles.captureButtonInnerTablet]} />
              </PressableScale>

              <View style={{ width: isTablet ? 62 : 48 }} />
            </View>
          </View>
        </CameraView>
      )}

      {/* Destello de captura: 180 ms, solo opacidad (se mantiene con "Reducir movimiento", es un cambio de estado) */}
      {flashKey > 0 && (
        <Reanimated.View
          key={flashKey}
          pointerEvents="none"
          style={[
            styles.flash,
            {
              opacity: 0,
              animationName: FLASH_KEYFRAMES,
              animationDuration: reducedMotion ? 120 : 180,
              animationTimingFunction: CSS_EASE_OUT,
            },
          ]}
        />
      )}

      {/* Análisis: la imagen congelada sigue visible y una línea recorre el encuadre */}
      {(isSaving || isProcessing) && (
        <Reanimated.View entering={STATE_FADE_IN} exiting={STATE_FADE_OUT} style={styles.savingOverlay}>
          <View style={[styles.analyzeFrame, { width: scanFrameSize, height: scanFrameSize }]}>
            <View style={[styles.corner, styles.cornerTL, styles.cornerActive]} />
            <View style={[styles.corner, styles.cornerTR, styles.cornerActive]} />
            <View style={[styles.corner, styles.cornerBL, styles.cornerActive]} />
            <View style={[styles.corner, styles.cornerBR, styles.cornerActive]} />
            {reducedMotion ? (
              <View style={styles.frameCenter}><ActivityIndicator size="large" color="#c4b5fd" /></View>
            ) : (
              <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
                <Reanimated.View
                  style={[
                    styles.analyzeLine,
                    {
                      // La línea va de arriba a abajo del recuadro y regresa.
                      animationName: {
                        from: { transform: [{ translateY: 8 }] },
                        to: { transform: [{ translateY: scanFrameSize - 12 }] },
                      },
                      animationDuration: 1400,
                      animationIterationCount: "infinite",
                      animationDirection: "alternate",
                      animationTimingFunction: "ease-in-out",
                    },
                  ]}
                >
                  <LinearGradient
                    colors={["rgba(196,181,253,0)", "rgba(196,181,253,0.95)", "rgba(196,181,253,0)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Reanimated.View>
              </View>
            )}
          </View>
          <View style={[styles.loadingContainer, isTablet && styles.loadingContainerTablet]}>
            <Text style={[styles.savingTitle, isTablet && styles.savingTitleTablet]}>
              {isSaving ? t("saving") : t("analyzing")}
            </Text>
            <Text style={[styles.savingSubtitle, isTablet && styles.savingSubtitleTablet]}>
              {isSaving ? t("savingDetail") : t("analyzingDetail")}
            </Text>
          </View>
        </Reanimated.View>
      )}

      {/* Resultado: entra desde abajo en 260 ms con curva de salida fuerte */}
      {prediction && !isSaving && !isProcessing && !limitReached && (
        <Reanimated.View
          entering={reducedMotion ? RESULT_ENTER_REDUCED : RESULT_ENTER}
          exiting={RESULT_EXIT}
          style={[
            styles.predictionWrapper,
            isHealthy ? styles.predictionWrapperHealthy : styles.predictionWrapperSick,
            isTablet && styles.predictionWrapperTablet,
            { bottom: (isTablet ? 120 : 100) + insets.bottom },
          ]}
        >
          {renderPredictionContent()}
        </Reanimated.View>
      )}
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  camera: { flex: 1 },
  overlay: { flex: 1 },
  topShade: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: 36, zIndex: 5 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modesButton: {
    flexDirection: "row", alignItems: "center", gap: 2, minHeight: 40,
    paddingLeft: 8, paddingRight: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
  },
  modesButtonText: { color: "#ffffff", fontSize: 13, fontFamily: "Poppins_600SemiBold" },
  limitModes: { position: "absolute", left: 16, zIndex: 5 },
  tokenPill: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 1, borderColor: "rgba(245,158,11,0.55)",
  },
  tokenPillText: { color: "#fbbf24", fontFamily: "Poppins_600SemiBold", fontSize: 13 },
  header: { alignItems: "center", marginTop: 14, gap: 8 },
  headerTablet: { marginTop: 22 },
  modeTag: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    backgroundColor: "rgba(109,40,217,0.55)", borderWidth: 1, borderColor: "rgba(196,181,253,0.5)",
  },
  modeTagDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#c4b5fd" },
  modeTagText: { color: "#ede9fe", fontSize: 11.5, fontFamily: "Poppins_600SemiBold", letterSpacing: 0.3 },
  orchardTagText: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontFamily: "Poppins_600SemiBold", marginTop: 6, maxWidth: 280, textAlign: "center", textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 6 },
  headerText: { color: "#ffffff", fontSize: 19, fontFamily: "Poppins_600SemiBold", textAlign: "center" },
  headerTextTablet: { fontSize: 26 },

  scanFrame: { position: "absolute", alignSelf: "center", top: "30%" },
  frameCenter: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  corner: { position: 'absolute', width: 34, height: 34, borderColor: '#ffffff', borderWidth: 3.5 },
  cornerActive: { borderColor: '#c4b5fd' },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 12 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 12 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 12 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 12 },

  tips: { position: "absolute", left: 16, right: 16, bottom: 300, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  tipChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(10,6,24,0.55)" },
  tipText: { color: "rgba(255,255,255,0.9)", fontSize: 11.5, fontFamily: "Poppins_400Regular" },

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
  flipButton: { width: 48, height: 48, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  flipButtonTablet: { width: 62, height: 62, borderRadius: 31 },
  captureButton: {
    width: 82, height: 82, borderRadius: 41,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center", alignItems: "center",
    borderWidth: 4, borderColor: "#ffffff",
  },
  captureButtonTablet: { width: 100, height: 100, borderRadius: 50 },
  captureButtonDisabled: { opacity: 0.5 },
  captureButtonInner: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "#ffffff",
    borderWidth: 3, borderColor: "#6D28D9",
  },
  captureButtonInnerTablet: { width: 80, height: 80, borderRadius: 40 },

  flash: { ...StyleSheet.absoluteFill, backgroundColor: "#ffffff" },
  analyzeFrame: { marginBottom: 28 },
  analyzeLine: { position: "absolute", top: 0, left: 10, right: 10, height: 3, borderRadius: 2, overflow: "hidden" },
  resultHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  resultIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  resultTitle: { flex: 1, color: "#ffffff", fontFamily: "Poppins_700Bold", fontSize: 18 },
  resultTitleTablet: { fontSize: 22 },
  resultRows: { backgroundColor: "rgba(0,0,0,0.18)", borderRadius: 14, padding: 12 },
  resultKey: { width: 64, color: "rgba(255,255,255,0.6)", fontFamily: "Poppins_400Regular", fontSize: 12 },

  // ── Result card — centrado en pantalla ──────────────────
  predictionWrapper: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  predictionWrapperTablet: { left: 60, right: 60, borderRadius: 26 },
  predictionWrapperHealthy: { backgroundColor: 'rgba(20,83,45,0.96)' },
  predictionWrapperSick:    { backgroundColor: 'rgba(127,29,29,0.95)' },

  predictionCard: { padding: 20 },
  predictionCardTablet: { padding: 28 },

  predictionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  predictionEmoji: { fontSize: 30 },
  predictionMarker: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#6FB98F' },
  predictionEmojiTablet: { fontSize: 38 },
  predictionInfo: { flex: 1 },
  predictionLabel: { color: '#fff', fontFamily: 'Poppins-SemiBold', fontSize: 16 },
  predictionLabelTablet: { fontSize: 20 },
  predictionSub: { color: 'rgba(255,255,255,0.7)', fontFamily: 'Poppins-Regular', fontSize: 12, marginTop: 2 },
  predictionSubTablet: { fontSize: 14 },

  predictionDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: 12,
  },

  // ── Botón Aceptar ────────────────────────────────────────
  acceptButton: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  acceptButtonTablet: { marginTop: 22, paddingVertical: 14, borderRadius: 16 },
  acceptButtonText: {
    color: '#ffffff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  acceptButtonTextTablet: { fontSize: 18 },
  // ────────────────────────────────────────────────────────

  text: { color: "#ffffff", fontSize: 18, fontFamily: "Poppins-Regular", textAlign: "center", marginBottom: 20 },
  button: { backgroundColor: "#3aaa5c", padding: 16, borderRadius: 12, alignItems: "center" },
  buttonText: { color: "#ffffff", fontSize: 18, fontFamily: "Poppins-SemiBold" },

  savingOverlay: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(10,6,24,0.62)',
    justifyContent: 'center', alignItems: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingContainerTablet: { paddingHorizontal: 36 },
  fruitSpinner: {
    width: 100, height: 100,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(58,170,92,0.2)',
    borderRadius: 50, marginBottom: 20,
  },
  fruitSpinnerTablet: { width: 130, height: 130, borderRadius: 65, marginBottom: 26 },
  fruitEmoji: { fontSize: 50 },
  fruitEmojiTablet: { fontSize: 64 },
  fruitSpinnerMark: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#B8DCC7' },
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
    flex: 1, backgroundColor: 'rgba(0,0,0,0.58)',
    justifyContent: 'center', alignItems: 'center', padding: 16,
  },
  modalCard: {
    backgroundColor: '#ffffff', borderRadius: 22, padding: 18,
    width: '100%', maxWidth: 420, maxHeight: '88%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 12, alignItems: 'center',
  },
  modalCardTablet: { maxWidth: 560, padding: 28, borderRadius: 28, maxHeight: '84%' },
  modalIconCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#d1fae5',
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  modalTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 17, color: '#164E45', textAlign: 'center', marginBottom: 2 },
  modalTitleTablet: { fontSize: 22 },
  modalSubtitle: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: '#8A9995', textAlign: 'center', marginBottom: 12 },
  modalSubtitleTablet: { fontSize: 15, marginBottom: 18 },

  modalScroll: { width: '100%', flexShrink: 1 },
  modalScrollContent: { paddingRight: 5, paddingBottom: 2 },
  guestScanInfo: {
    backgroundColor: '#F7F7F4', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 9, marginBottom: 13,
    width: '100%',
  },
  guestScanInfoText: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: '#92400e', textAlign: 'center' },
  guestScanCount: { fontFamily: 'Poppins_600SemiBold', color: '#b45309' },

  modalSection: { width: '100%', marginBottom: 13 },
  modalSectionTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: '#134e4a', marginBottom: 6 },
  modalSectionTitleTablet: { fontSize: 15 },
  modalBodyText: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: '#334155', lineHeight: 19 },
  modalBodyTextTablet: { fontSize: 15, lineHeight: 23 },
  highlightBox: {
    backgroundColor: '#F2F8F5', borderRadius: 10, padding: 11, gap: 6,
  },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start' },
  bulletDot: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: '#0f766e', marginRight: 7, marginTop: 1 },
  bulletText: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: '#334155', flex: 1, lineHeight: 18 },
  boldText: { fontFamily: 'Poppins_600SemiBold', color: '#134e4a' },

  modalButtons: { width: '100%', marginTop: 10 },
  acceptScanBtn: { borderRadius: 15, overflow: 'hidden' },
  acceptBtnGrad: { paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  acceptBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: '#ffffff' },
  acceptBtnTextTablet: { fontSize: 19, paddingVertical: 4 },
});