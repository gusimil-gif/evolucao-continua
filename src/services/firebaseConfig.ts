import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyD-6Z_ESshmHAHMjXuYI9uNPOrVtI2DPzI",
  authDomain: "smtl-ce8e9.firebaseapp.com",
  projectId: "smtl-ce8e9",
  storageBucket: "smtl-ce8e9.firebasestorage.app",
  messagingSenderId: "475032022367",
  appId: "1:475032022367:web:4435adda46fcf51a3adaea",
  measurementId: "G-NVEWKLW4Z3"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
