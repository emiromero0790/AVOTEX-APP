import { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { RotateCw as RotateCwIcon } from "lucide-react-native";
import Toast from 'react-native-toast-message';
import { useFocusEffect } from "expo-router";

// --- Importaciones de Firebase (para usuario) y Supabase (para guardar datos) ---
import { auth } from "../../firebaseConfig";
import { User, onAuthStateChanged } from "firebase/auth";
import { supabase } from "../../supabaseConfig";

const URL_PREDICT_FILE = "https://tflite-service-630562712876.us-central1.run.app/predict";

export default function Scan() {
    const [permission, requestPermission] = useCameraPermissions();
    const [type, setType] = useState<CameraType>("back");
    const [prediction, setPrediction] = useState<string | null>(null);
    const cameraRef = useRef<any>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const [user, setUser] = useState<User | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    const stopCapturing = () => {
        if (intervalRef.current) {
            console.log("📸 Deteniendo captura de fotos...");
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    const saveScanResult = async (predictionData: { label: string; score: number }) => {
        if (!user) {
            console.log("No hay usuario para guardar el escaneo.");
            return;
        }
        
        setIsSaving(true);

        try {
            const scanRecord = {
                user_id: user.uid,
                user_email: user.email,
                label: predictionData.label,
                score: predictionData.score,
            };

            const { error } = await supabase.from('scans').insert([scanRecord]);
            if (error) throw error;

            console.log("¡Datos del escaneo guardados con éxito en Supabase!");
            Toast.show({ type: 'success', text1: 'Diagnóstico Guardado' });

        } catch (error) {
            console.error("Error al guardar datos en Supabase:", error);
            Toast.show({ type: 'error', text1: 'Error al Guardar', text2: 'No se pudieron guardar los datos.' });
        } finally {
            setIsSaving(false);
        }
    };

    const takePicture = async () => {
        if (!cameraRef.current || isSaving) return;
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.7,
                skipProcessing: true,
            });
            
            const pred = await sendImageToServer(photo);
            
            if (pred?.label && pred.score != null) {
                setPrediction(`${pred.label}: ${(pred.score * 100).toFixed(1)}%`);
                await saveScanResult(pred);
            } else {
                setPrediction("Respuesta inválida");
            }
        } catch (e) {
            console.error("Error capturando foto:", e);
        }
    };

    const startCapturing = () => {
        stopCapturing();
        console.log("📸 Iniciando captura de fotos...");
        intervalRef.current = setInterval(() => {
            takePicture();
        }, 1500);
    };

    const sendImageToServer = async (image: { uri: string }) => {
        try {
            const formData = new FormData();
            formData.append("file", {
                uri: image.uri,
                name: "photo.jpg",
                type: "image/jpeg",
            } as any);
            const res = await fetch(URL_PREDICT_FILE, {
                method: "POST",
                body: formData,
            });
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            console.error("Error enviando imagen:", e);
            return null;
        }
    };

    useFocusEffect(
        useCallback(() => {
            // Se ejecuta cuando la pantalla está en foco
            if (permission?.granted) {
                startCapturing();
            }

            // Se ejecuta cuando sales de la pantalla
            return () => {
                stopCapturing();
            };
        }, [permission?.granted])
    );

    if (!permission) { return <View />; }

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

    return (
        <View style={styles.container}>
            <CameraView style={styles.camera} type={type} ref={cameraRef} facing={type}>
                <View style={styles.overlay}>
                    <View style={styles.header}>
                        <Text style={styles.headerText}>Escanear Aguacate</Text>
                    </View>
                    <View style={styles.controls}>
                        <TouchableOpacity style={styles.flipButton} onPress={toggleCameraType}>
                            <RotateCwIcon color="#eee" size={28} />
                        </TouchableOpacity>
                    </View>
                </View>
            </CameraView>

            {isSaving && (
                <View style={styles.savingOverlay}>
                    <ActivityIndicator size="large" color="#ffffff" />
                    <Text style={styles.savingText}>Guardando resultado...</Text>
                </View>
            )}

            {prediction && !isSaving && (
                <View style={[styles.predictionContainer, 
                    prediction.toLowerCase().includes("saludable") ? styles.sano : styles.enfermo]}>
                    <Text style={styles.predictionText}>🎯 {prediction}</Text>
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
});