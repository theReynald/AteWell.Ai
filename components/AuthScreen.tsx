import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export default function AuthScreen() {
  const {
    signIn,
    signUp,
    signInWithBiometrics,
    biometricAvailable,
    biometricEnabled,
    biometricLabel,
    enableBiometricLogin,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);

  // Auto-prompt biometric sign-in on launch if enabled
  useEffect(() => {
    if (biometricAvailable && biometricEnabled) {
      handleBiometricSignIn();
    }
  }, [biometricAvailable, biometricEnabled]);

  const handleBiometricSignIn = async () => {
    setIsBiometricLoading(true);
    const { error } = await signInWithBiometrics();
    if (error) {
      // Only show alert for errors other than cancellation
      if (error !== "Authentication cancelled.") {
        Alert.alert(biometricLabel, error);
      }
    }
    setIsBiometricLoading(false);
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(email.trim(), password);
        if (error) {
          Alert.alert("Sign Up Error", error);
        } else {
          Alert.alert(
            "Check your email",
            "We sent you a confirmation link. Please check your email to verify your account, then sign in.",
          );
          setIsSignUp(false);
        }
      } else {
        const { error } = await signIn(email.trim(), password);
        if (error) {
          Alert.alert("Sign In Error", error);
        } else if (biometricAvailable && !biometricEnabled) {
          // Offer to enable biometric login after first successful sign-in
          Alert.alert(
            `Enable ${biometricLabel}?`,
            `Would you like to use ${biometricLabel} to sign in next time?`,
            [
              { text: "Not Now", style: "cancel" },
              {
                text: "Enable",
                onPress: async () => {
                  await enableBiometricLogin();
                },
              },
            ],
          );
        }
      }
    } catch (e: any) {
      Alert.alert("Unexpected Error", `${e.name}: ${e.message}\n\n${e.stack?.slice(0, 300)}`);
    }

    setIsLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>🍽️💡</Text>
        <Text style={styles.title}>AteWell.AI</Text>
        <Text style={styles.subtitle}>
          Your smart grocery companion
        </Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType={isSignUp ? "newPassword" : "password"}
            autoComplete={isSignUp ? "new-password" : "current-password"}
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>
                {isSignUp ? "Create Account" : "Sign In"}
              </Text>
            )}
          </TouchableOpacity>

          {biometricAvailable && biometricEnabled && !isSignUp && (
            <TouchableOpacity
              style={[styles.biometricButton, isBiometricLoading && styles.buttonDisabled]}
              onPress={handleBiometricSignIn}
              disabled={isBiometricLoading}
            >
              {isBiometricLoading ? (
                <ActivityIndicator color="#2089dc" />
              ) : (
                <>
                  <Text style={styles.biometricIcon}>
                    {biometricLabel === "Face ID" ? "👤" : "👆"}
                  </Text>
                  <Text style={styles.biometricText}>
                    Sign in with {biometricLabel}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setIsSignUp(!isSignUp)}
          >
            <Text style={styles.switchText}>
              {isSignUp
                ? "Already have an account? Sign In"
                : "Don't have an account? Sign Up"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  logo: {
    fontSize: 64,
    marginBottom: 10,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#2089dc",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#888",
    marginBottom: 40,
  },
  form: {
    width: "100%",
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 10,
    paddingHorizontal: 16,
    marginBottom: 14,
    fontSize: 16,
    color: "#fff",
    backgroundColor: "#1a1a1a",
  },
  button: {
    height: 50,
    backgroundColor: "#2089dc",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  switchButton: {
    marginTop: 20,
    alignItems: "center",
  },
  switchText: {
    color: "#2089dc",
    fontSize: 15,
  },
  biometricButton: {
    height: 50,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: "#2089dc",
    flexDirection: "row",
    gap: 8,
  },
  biometricIcon: {
    fontSize: 22,
  },
  biometricText: {
    color: "#2089dc",
    fontSize: 16,
    fontWeight: "600",
  },
});
