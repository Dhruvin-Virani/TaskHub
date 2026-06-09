"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { authApi, type AppUser } from "@/lib/api";

interface AuthContextValue {
  firebaseUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
  backendError: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      setFirebaseUser(user);
      setBackendError(null);

      if (user) {
        try {
          const idToken = await user.getIdToken();
          const res = await authApi.callback(idToken);
          setAppUser(res.user);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          // Distinguish between "backend down" and other errors
          if (message.includes("fetch") || message.includes("Failed to fetch") || message.includes("NetworkError")) {
            setBackendError("Cannot reach backend. Make sure Flask is running on port 5000.");
          } else {
            setBackendError(message);
          }
          setAppUser(null);
        }
      } else {
        setAppUser(null);
      }

      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(firebaseAuth, provider);
  };

  const signInWithGithub = async () => {
    const provider = new GithubAuthProvider();
    await signInWithPopup(firebaseAuth, provider);
  };

  const signOut = async () => {
    await firebaseSignOut(firebaseAuth);
    setAppUser(null);
    setFirebaseUser(null);
    setBackendError(null);
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, loading, backendError, signInWithGoogle, signInWithGithub, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
