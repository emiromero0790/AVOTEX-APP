
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";


const firebaseConfig = {
  apiKey: "AIzaSyBsP6jZoV9J32NFU5O67on5bgUH2UVz664",
  authDomain: "avotex-7ba66.firebaseapp.com",
  projectId: "avotex-7ba66",
  storageBucket: "avotex-7ba66.appspot.com", 
  messagingSenderId: "25290185078",
  appId: "1:25290185078:web:9b693d666d9b7d594a8257"
};


const app = initializeApp(firebaseConfig);


export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
