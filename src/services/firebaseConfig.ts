import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
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

// Cache local persistente multi-aba com IndexedDB para leituras instantâneas (<15ms)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export const storage = getStorage(app);
