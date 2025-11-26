import { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated } from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { RotateCw as RotateCwIcon } from "lucide-react-native";
import Toast from "react-native-toast-message";
import { useFocusEffect } from "expo-router";
import * as FileSystem from "expo-file-system";

import { auth } from "../../firebaseConfig";
import { User, onAuthStateChanged } from "firebase/auth";
import { supabase } from "../../supabaseConfig";

const URL_PREDICT_FILE = "https://deploy-service-116255691430.us-central1.run.app/predict";
const URL_PREDICT_BASE64 = "https://deploy-service-116255691430.us-central1.run.app/predict_base64";

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
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Ref para bloquear capturas
  const isBusyRef = useRef(false);
  
  // Animación del aguacate giratorio
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isProcessing || isSaving) {
      // Iniciar animación continua
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      // Resetear cuando no está procesando
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

  const stopCapturing = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

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
    if (!user) {
      return;
    }
    if(pred.label == "NoAguacate"){
        return;
    }
    
    setIsSaving(true);
    isBusyRef.current = true;
    try {
      const scanRecord = {
        user_id: user.uid,
        user_email: user.email,
        label: pred.label,
        score: pred.score,
        //class_index: pred.classIndex ?? null,
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
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
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
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          data: base64
        })
      });
      if (!res.ok) {
        throw new Error(`HTTP base64 ${res.status}`);
      }
      const data = await res.json();
      return normalizeServerResponse(data);
    } catch (e) {
      console.error("Error en fallback base64:", e);
      return null;
    }
  };

  const takePicture = async () => {
    // BLOQUEO CRÍTICO: No continuar si está ocupado
    if (isBusyRef.current || isProcessing || isSaving) {
      console.log("🚫 BLOQUEADO - Sistema ocupado:", { 
        isBusyRef: isBusyRef.current, 
        isProcessing, 
        isSaving 
      });
      return;
    }
    
    if (!cameraRef.current) {
      console.log("⚠️ Cámara no disponible");
      return;
    }

    console.log("📸 Iniciando captura...");
    isBusyRef.current = true;
    setIsProcessing(true);
    
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: true
      });

      console.log("🔄 Enviando a API...");
      let pred = await sendImageMultipart(photo);
      if (!pred) {
        pred = await sendImageBase64(photo);
      }

      if (pred) {
        console.log("✅ Predicción obtenida:", pred.label);
        setPrediction(pred);
        // Esperar a que termine de guardar antes de liberar
        console.log("💾 Guardando en Supabase...");
        await saveScanResult(pred);
        console.log("✅ Guardado completo");
      } else {
        setPrediction({
          label: "Respuesta inválida",
          score: 0
        });
      }
    } catch (e) {
      console.error("❌ Error capturando o procesando foto:", e);
      setPrediction({
        label: "Error de captura",
        score: 0
      });
    } finally {
      console.log("🔓 Liberando sistema...");
      setIsProcessing(false);
      isBusyRef.current = false;
    }
  };

  const startCapturing = () => {
    stopCapturing();
    intervalRef.current = setInterval(() => {
      takePicture();
    }, 2500); 
  };

  useFocusEffect(
    useCallback(() => {
      if (permission?.granted) {
        startCapturing();
      }
      return () => {
        stopCapturing();
      };
    }, [permission?.granted])
  );

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
      <CameraView style={styles.camera} type={type} ref={cameraRef} facing={type}>
        <View style={styles.overlay}>
          <View style={styles.header}>
            <Text style={styles.headerText}>Escanear Aguacate</Text>
          </View>
          <View style={styles.controls}>
            <TouchableOpacity style={styles.flipButton} onPress={toggleCameraType} disabled={isProcessing}>
              <RotateCwIcon color="#eee" size={28} />
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>

      {(isSaving || isProcessing) && (
        <View style={styles.savingOverlay}>
          <Animated.Text 
            style={[
              styles.avocadoEmoji,
              { transform: [{ rotate: spin }] }
            ]}
          >
            🥑
          </Animated.Text>
          <Text style={styles.savingText}>
            {isSaving ? "Guardando resultado..." : "Procesando..."}
          </Text>
        </View>
      )}

      {prediction && !isSaving && !isProcessing && (
        <View
          style={[
            styles.predictionContainer,
            isHealthy ? styles.sano : styles.enfermo
          ]}
        >
          <Text style={styles.predictionText}>{renderPredictionText()}</Text>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#000000" },
    camera: { flex: 1 },
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", padding: 20 },
    header: { paddingTop: 40, alignItems: "center" },
    headerText: { color: "#ffffff", fontSize: 24, fontFamily: "Poppins-SemiBold" },
    controls: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        paddingBottom: 40,
    },
    flipButton: {
        backgroundColor: "rgba(0,0,0,0.4)",
        borderRadius: 30,
        padding: 12,
    },
    predictionContainer: {
        position: "absolute",
        bottom: 120,
        alignSelf: "center",
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 25,
        elevation: 6,
    },
    predictionText: { fontSize: 20, fontWeight: "700", color: "#fff", fontFamily: "Poppins-SemiBold" },
    sano: { backgroundColor: "#2ecc71" },
    enfermo: { backgroundColor: "#e74c3c" },
    text: { color: "#ffffff", fontSize: 18, fontFamily: "Poppins-Regular", textAlign: "center", marginBottom: 20 },
    button: { backgroundColor: "#219bef", padding: 16, borderRadius: 12, alignItems: "center" },
    buttonText: { color: "#ffffff", fontSize: 18, fontFamily: "Poppins-SemiBold" },
    savingOverlay: {
        position: 'absolute',
        left: 0, right: 0, top: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    savingText: {
        color: '#ffffff',
        fontSize: 18,
        fontFamily: "Poppins-SemiBold",
        marginTop: 12,
    },
    avocadoEmoji: {
        fontSize: 80,
        marginBottom: 20,
    },
});