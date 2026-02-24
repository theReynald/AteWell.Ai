import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const BIOMETRIC_ENABLED_KEY = "biometric_auth_enabled";
const BIOMETRIC_EMAIL_KEY = "biometric_auth_email";
const BIOMETRIC_TOKEN_KEY = "biometric_auth_token";

/**
 * Check if the device supports biometric authentication (Face ID / Touch ID).
 */
export async function isBiometricSupported(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

/**
 * Get the available biometric type label for display purposes.
 */
export async function getBiometricTypeLabel(): Promise<string> {
  const types =
    await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (
    types.includes(
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    )
  ) {
    return "Face ID";
  }
  if (
    types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
  ) {
    return "Touch ID";
  }
  return "Biometrics";
}

/**
 * Prompt the user for biometric authentication.
 */
export async function authenticateWithBiometrics(
  promptMessage?: string,
): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: promptMessage ?? "Authenticate to sign in",
    fallbackLabel: "Use password",
    disableDeviceFallback: false,
  });
  return result.success;
}

/**
 * Save credentials for biometric login (stored securely).
 */
export async function saveBiometricCredentials(
  email: string,
  refreshToken: string,
): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_EMAIL_KEY, email);
  await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, refreshToken);
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, "true");
}

/**
 * Check if biometric login is enabled (user previously opted in).
 */
export async function isBiometricLoginEnabled(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
  return val === "true";
}

/**
 * Retrieve stored credentials for biometric login.
 */
export async function getBiometricCredentials(): Promise<{
  email: string;
  refreshToken: string;
} | null> {
  const email = await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
  const refreshToken = await SecureStore.getItemAsync(
    BIOMETRIC_TOKEN_KEY,
  );
  if (email && refreshToken) {
    return { email, refreshToken };
  }
  return null;
}

/**
 * Clear stored biometric credentials (disable biometric login).
 */
export async function clearBiometricCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRIC_EMAIL_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_TOKEN_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
}
