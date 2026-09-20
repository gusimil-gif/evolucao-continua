import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebaseConfig';
import type { UserData } from '../types';

interface AuthContextType {
  currentUser: User | null;
  userData: UserData | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userData: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(() => {
    try {
      const cached = sessionStorage.getItem('ec_session_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      return !sessionStorage.getItem('ec_session_user');
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Fetch custom user data from Firestore (instantaneosly from IndexedDB cache)
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().ativo !== false) {
          const data = userDoc.data() as UserData;
          setCurrentUser(user);
          setUserData(data);
          try {
            sessionStorage.setItem('ec_session_user', JSON.stringify(data));
          } catch (_) {}
        } else {
          try { sessionStorage.removeItem('ec_session_user'); } catch (_) {}
          await signOut(auth);
          setCurrentUser(null);
          setUserData(null);
        }
      } else {
        try { sessionStorage.removeItem('ec_session_user'); } catch (_) {}
        setCurrentUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userData, loading }}>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D]">
          <div className="w-10 h-10 border-4 border-[#D4A947] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : children}
    </AuthContext.Provider>
  );
};
