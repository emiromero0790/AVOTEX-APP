import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBsP6jZoV9J32NFU5O67on5bgUH2UVz664",
  authDomain: "avotex-7ba66.firebaseapp.com",
  projectId: "avotex-7ba66",
  storageBucket: "avotex-7ba66.appspot.com",
  messagingSenderId: "25290185078",
  appId: "1:25290185078:web:9b693d666d9b7d594a8257",
};

const app = initializeApp(firebaseConfig);

let auth;

if (Platform.OS === "web") {
  auth = getAuth(app);
} else {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);
