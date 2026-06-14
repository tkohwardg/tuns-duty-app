import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  loginWithEmail,
  logout as firebaseLogout,
  onAuthChange,
  type UserProfile,
} from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, COLLECTIONS } from "./firebase";
import type { User } from "firebase/auth";

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  isLoading: true,
  isAdmin: false,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Fetch user profile from Firestore
        try {
          const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid));
          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile;
            setUserProfile(profile);
            await AsyncStorage.setItem("userProfile", JSON.stringify(profile));
          }
        } catch (error) {
          // Try to load from local storage as fallback
          const cached = await AsyncStorage.getItem("userProfile");
          if (cached) {
            setUserProfile(JSON.parse(cached));
          }
        }
      } else {
        setUserProfile(null);
        await AsyncStorage.removeItem("userProfile");
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const credential = await loginWithEmail(email, password);
    const firebaseUser = credential.user;

    // Fetch or create user profile
    const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid));
    if (userDoc.exists()) {
      const profile = userDoc.data() as UserProfile;
      setUserProfile(profile);
      await AsyncStorage.setItem("userProfile", JSON.stringify(profile));
    }
  };

  const logout = async () => {
    await firebaseLogout();
    setUser(null);
    setUserProfile(null);
    await AsyncStorage.removeItem("userProfile");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        isLoading,
        isAdmin: userProfile?.role === "admin",
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => useContext(AuthContext);
