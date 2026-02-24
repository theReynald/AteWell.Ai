import { supabase } from "@/lib/supabase";
import {
    authenticateWithBiometrics,
    clearBiometricCredentials,
    getBiometricCredentials,
    getBiometricTypeLabel,
    isBiometricLoginEnabled,
    isBiometricSupported,
    saveBiometricCredentials,
} from "@/utils/biometrics";
import { Session, User } from "@supabase/supabase-js";
import React, { createContext, useContext, useEffect, useState } from "react";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithBiometrics: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  biometricLabel: string;
  enableBiometricLogin: () => Promise<void>;
  disableBiometricLogin: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState("Face ID");

  useEffect(() => {
    // Check biometric availability
    (async () => {
      const supported = await isBiometricSupported();
      setBiometricAvailable(supported);
      if (supported) {
        const label = await getBiometricTypeLabel();
        setBiometricLabel(label);
      }
      const enabled = await isBiometricLoginEnabled();
      setBiometricEnabled(enabled);
    })();

    // Get initial session (wrapped in try-catch to handle network issues)
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      })
      .catch((err) => {
        console.warn("Auth getSession failed (offline?):", err.message);
        setIsLoading(false);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { error: error.message };

    // After successful sign-in, save refresh token if biometrics are enabled
    if (biometricEnabled && data.session?.refresh_token) {
      await saveBiometricCredentials(email, data.session.refresh_token);
    }

    return { error: null };
  };

  const signInWithBiometricsHandler = async () => {
    try {
      const credentials = await getBiometricCredentials();
      if (!credentials) {
        return { error: "No saved credentials. Please sign in with your password first." };
      }

      const authenticated = await authenticateWithBiometrics(
        `Sign in to AteWell.AI with ${biometricLabel}`,
      );
      if (!authenticated) {
        return { error: "Authentication cancelled." };
      }

      // Use the stored refresh token to restore the session
      const { error } = await supabase.auth.refreshSession({
        refresh_token: credentials.refreshToken,
      });

      if (error) {
        // Token expired or revoked — clear stored credentials
        await clearBiometricCredentials();
        setBiometricEnabled(false);
        return { error: "Session expired. Please sign in with your password again." };
      }

      return { error: null };
    } catch (e: any) {
      return { error: e.message || "Biometric authentication failed." };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const enableBiometricLogin = async () => {
    // We need an active session to save the refresh token
    const { data } = await supabase.auth.getSession();
    const refreshToken = data.session?.refresh_token;
    const email = data.session?.user?.email;
    if (refreshToken && email) {
      await saveBiometricCredentials(email, refreshToken);
      setBiometricEnabled(true);
    }
  };

  const disableBiometricLogin = async () => {
    await clearBiometricCredentials();
    setBiometricEnabled(false);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isLoading,
        signUp,
        signIn,
        signInWithBiometrics: signInWithBiometricsHandler,
        signOut,
        biometricAvailable,
        biometricEnabled,
        biometricLabel,
        enableBiometricLogin,
        disableBiometricLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
