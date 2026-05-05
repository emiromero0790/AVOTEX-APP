import { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated, Modal } from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { RotateCw as RotateCwIcon, Camera as CameraIcon, Shield } from "lucide-react-native";
import Toast from "react-native-toast-message";
import { useFocusEffect } from "expo-router";
import * as FileSystem from "expo-file-system";
import { LinearGradient } from "expo-linear-gradient";

import { auth } from "../../firebaseConfig";
import { User, onAuthStateChanged } from "firebase/auth";
import { supabase } from "../../supabaseConfig";

const PREDICT_URL = process.env.EXPO_PUBLIC_PREDICT_URL!;
const URL_PREDICT_FILE = `${PREDICT_URL}/predict`;
const URL_PREDICT_BASE64 = `${PREDICT_URL}/predict_base64`;

type NormalizedPrediction = {
  label: string;
  score: number;
  classIndex?: number;
  raw?: any;
};

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
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const normalizeServerResponse = (data: any): NormalizedPrediction | null => {
    try {
      if (!data) return null;
      if (data.class_index !== undefined && data.class_name && data.confidence !== undefined) {
        return {
          label: data.class_name,
          score: Number(data.confidence),
          classIndex: Number(data.class_index),
          raw: data
        };
      }
      if (Array.isArray(data.predictions)) {
        const first = data.predictions[0];
        if (first?.predictions && Array.isArray(first.predictions)) {
          const top = first.predictions[0];
          if (top) {
            return {
              label: top.class_name,
              score: Number(top.confidence),
              classIndex: Number(top.class_index),
              raw: top
            };
          }
        } else if (data.predictions[0]?.class_name) {
          const top = data.predictions[0];
          return {
            label: top.class_name,
            score: Number(top.confidence),
            classIndex: Number(top.class_index),
            raw: top
          };
        }
      }
      if (data.label && data.score !== undefined) {
        return {
          label: data.label,
          score: Number(data.score),
          raw: data
        };
      }
      return null;
    } catch {
      return null;
    }
  };

  const saveScanResult = async (pred: NormalizedPrediction) => {
    if (!user) return;
    if (pred.label === "NoAguacate") return;

    setIsSaving(true);
    isBusyRef.current = true;
    try {
      const scanRecord = {
        user_id: user.uid,
        user_email: user.email,
        label: pred.label,
        score: pred.score,
        created_at: new Date().toISOString()
      };
      const { error } = await supabase.from("scans").insert([scanRecord]);
      if (error) throw error;
      Toast.show({ type: "success", text1: "Diagnóstico Guardado" });
    } catch (error) {
      console.error("Error al guardar datos en Supabase:", error);
      Toast.show({
        type: "error",
        text1: "Error al Guardar",
        text2: "No se pudieron guardar los datos."
      });
    } finally {
      setIsSaving(false);
      isBusyRef.current = false;
    }
  };

  const sendImageMultipart = async (image: { uri: string }) => {
    const formData = new FormData();
    formData.append("file", {
      uri: image.uri,
      name: "photo.jpg",
      type: "image/jpeg"
    } as any);
    try {
      const res = await fetch(URL_PREDICT_FILE, {
        method: "POST",
        body: formData
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
    try {
      const base64 = await FileSystem.readAsStringAsync(image.uri, {
        encoding: FileSystem.EncodingType.Base64
      });
      const res = await fetch(URL_PREDICT_BASE64, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: base64 })
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

    isBusyRef.current = true;
    setIsProcessing(true);
    setPrediction(null);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: true
      });

      let pred = await sendImageMultipart(photo);
      if (!pred) pred = await sendImageBase64(photo);

      if (pred) {
        setPrediction(pred);
        await saveScanResult(pred);
      } else {
        setPrediction({ label: "Respuesta inválida", score: 0 });
      }
    } catch (e) {
      console.error("Error capturando o procesando foto:", e);
      setPrediction({ label: "Error de captura", score: 0 });
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
          <Text style={styles.buttonText}>Permitir acceso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const toggleCameraType = () => {
    setType((current) => (current === "back" ? "front" : "back"));
  };

  const renderPredictionText = () => {
    if (!prediction) return null;
    if (prediction.label === "Respuesta inválida" || prediction.label === "Error de captura") {
      return `⚠️ ${prediction.label}`;
    }
    return `🎯 ${prediction.label}: ${(prediction.score * 100).toFixed(1)}%`;
  };

  const isHealthy = prediction?.label?.toLowerCase().includes("salud") || prediction?.label?.toLowerCase().includes("healthy");

  return (
    <View style={styles.container}>
      {/* ── Scan privacy modal – always shown ── */}
      <Modal
        visible={scanModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}>
              <Shield size={30} color="#0f766e" />
            </View>

            <Text style={styles.modalTitle}>📷 Uso de la Cámara e Imágenes</Text>
            <Text style={styles.modalSubtitle}>Importante leer antes de escanear</Text>

            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>🔍 ¿Cómo funciona el escaneo?</Text>
              <Text style={styles.modalBodyText}>
                La cámara captura una foto del cultivo o fruto y la envía a nuestra IA para su análisis en tiempo real.
              </Text>
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>🗑️ Uso de imágenes (IMPORTANTE)</Text>
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
              <Text style={styles.modalSectionTitle}>✅ ¿Qué sí se guarda?</Text>
              <Text style={styles.modalBodyText}>
                Solo se almacena el resultado del análisis: el porcentaje de probabilidad de enfermedad y el diagnóstico obtenido.
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.acceptScanBtn}
                onPress={() => { setScanAccepted(true); setScanModalVisible(false); }}
              >
                <LinearGradient colors={['#34d399', '#0f766e']} style={styles.acceptBtnGrad}>
                  <Text style={styles.acceptBtnText}>Entendido, continuar</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <CameraView style={styles.camera} type={type} ref={cameraRef} facing={type}>
        <View style={styles.overlay}>
          <View style={styles.header}>
            <Text style={styles.headerText}>Escanear Fruto</Text>
            <Text style={styles.headerSubtext}>Apunta al fruto para analizarlo</Text>
          </View>

          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>

          <View style={styles.controls}>
            <TouchableOpacity style={styles.flipButton} onPress={toggleCameraType} disabled={isProcessing}>
              <RotateCwIcon color="#eee" size={28} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.captureButton, (isProcessing || isSaving) && styles.captureButtonDisabled]}
              onPress={takePicture}
              disabled={isProcessing || isSaving}
            >
              <View style={styles.captureButtonInner}>
                <CameraIcon color="#fff" size={32} />
              </View>
            </TouchableOpacity>

            <View style={{ width: 56 }} />
          </View>
        </View>
      </CameraView>

      {(isSaving || isProcessing) && (
        <View style={styles.savingOverlay}>
          <View style={styles.loadingContainer}>
            <Animated.View
              style={[styles.fruitSpinner, { transform: [{ rotate: spin }] }]}
            >
              <Text style={styles.fruitEmoji}>🌿</Text>
            </Animated.View>
            <Text style={styles.savingTitle}>
              {isSaving ? "Guardando" : "Analizando"}
            </Text>
            <Text style={styles.savingSubtitle}>
              {isSaving ? "Tu diagnóstico se está guardando..." : "Detectando estado del cultivo..."}
            </Text>
          </View>
        </View>
      )}

      {prediction && !isSaving && !isProcessing && (
        <View style={[styles.predictionContainer, isHealthy ? styles.sano : styles.enfermo]}>
          <Text style={styles.predictionText}>{renderPredictionText()}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  camera: { flex: 1 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)", padding: 20 },
  header: {
    paddingTop: 50,
    alignItems: "center",
    marginBottom: 20,
  },
  headerText: {
    color: "#ffffff",
    fontSize: 22,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.5,
  },
  headerSubtext: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontFamily: "Poppins-Regular",
    marginTop: 4,
  },
  scanFrame: {
    width: 240,
    height: 240,
    alignSelf: 'center',
    marginTop: 20,
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#3aaa5c',
    borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  controls: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 40,
  },
  flipButton: {
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 30,
    padding: 12,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#ffffff",
  },
  captureButtonDisabled: { opacity: 0.5 },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#3aaa5c",
    justifyContent: "center",
    alignItems: "center",
  },
  predictionContainer: {
    position: "absolute",
    bottom: 200,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  predictionText: { fontSize: 18, fontWeight: "700", color: "#fff", fontFamily: "Poppins-SemiBold" },
  sano: { backgroundColor: "#2ecc71" },
  enfermo: { backgroundColor: "#e74c3c" },
  text: { color: "#ffffff", fontSize: 18, fontFamily: "Poppins-Regular", textAlign: "center", marginBottom: 20 },
  button: { backgroundColor: "#3aaa5c", padding: 16, borderRadius: 12, alignItems: "center" },
  buttonText: { color: "#ffffff", fontSize: 18, fontFamily: "Poppins-SemiBold" },
  savingOverlay: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 28,
    padding: 36,
    borderWidth: 1,
    borderColor: 'rgba(58, 170, 92, 0.4)',
  },
  fruitSpinner: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(58, 170, 92, 0.2)',
    borderRadius: 50,
    marginBottom: 20,
  },
  fruitEmoji: { fontSize: 50 },
  savingTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontFamily: "Poppins-Bold",
    marginBottom: 8,
  },
  savingSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontFamily: "Poppins-Regular",
    textAlign: 'center',
    maxWidth: 250,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
    alignItems: 'center',
  },
  modalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: '#0f766e',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 18,
  },
  modalSection: {
    width: '100%',
    marginBottom: 14,
  },
  modalSectionTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: '#134e4a',
    marginBottom: 6,
  },
  modalBodyText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
  },
  highlightBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
    gap: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bulletDot: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#0f766e',
    marginRight: 7,
    marginTop: 1,
  },
  bulletText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: '#334155',
    flex: 1,
    lineHeight: 18,
  },
  boldText: {
    fontFamily: 'Poppins_600SemiBold',
    color: '#134e4a',
  },
  modalButtons: {
    width: '100%',
    marginTop: 6,
  },
  acceptScanBtn: {
    borderRadius: 50,
    overflow: 'hidden',
  },
  acceptBtnGrad: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#ffffff',
  },
});
