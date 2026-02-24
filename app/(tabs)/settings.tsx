import { useAuth } from "@/contexts/AuthContext";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useThemeColor } from "@/hooks/useThemeColor";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function SettingsScreen() {
  const {
    user,
    signOut,
    biometricAvailable,
    biometricEnabled,
    biometricLabel,
    enableBiometricLogin,
    disableBiometricLogin,
  } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const textColor = useThemeColor({}, "text");
  const bgColor = useThemeColor({}, "background");

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={styles.spacer} />
      <Text style={[styles.title, { color: "#2089dc" }]}>Settings</Text>

      <ScrollView style={styles.scrollContent}>
        {/* Account Section */}
        <Text style={[styles.sectionHeader, { color: isDark ? "#aaa" : "#666" }]}>
          ACCOUNT
        </Text>
        <View style={[styles.card, { backgroundColor: isDark ? "#1c1c1e" : "#fff" }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: textColor }]}>Email</Text>
            <Text style={[styles.rowValue, { color: isDark ? "#aaa" : "#666" }]}>
              {user?.email ?? "—"}
            </Text>
          </View>
        </View>

        {/* Security Section */}
        {biometricAvailable && (
          <>
            <Text style={[styles.sectionHeader, { color: isDark ? "#aaa" : "#666" }]}>
              SECURITY
            </Text>
            <View style={[styles.card, { backgroundColor: isDark ? "#1c1c1e" : "#fff" }]}>
              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: textColor }]}>
                  {biometricLabel === "Face ID" ? "👤 " : "👆 "}
                  {biometricLabel}
                </Text>
                <Switch
                  value={biometricEnabled}
                  onValueChange={(val) =>
                    val ? enableBiometricLogin() : disableBiometricLogin()
                  }
                  trackColor={{ false: "#555", true: "#4CD964" }}
                  thumbColor="#fff"
                />
              </View>
              <Text style={[styles.rowHint, { color: isDark ? "#777" : "#999" }]}>
                Use {biometricLabel} for faster sign-in
              </Text>
            </View>
          </>
        )}

        {/* Sign Out */}
        <View style={{ marginTop: 30 }}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.versionText, { color: isDark ? "#555" : "#bbb" }]}>
          AteWell.AI v1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  spacer: {
    height: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  scrollContent: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  rowValue: {
    fontSize: 15,
  },
  rowHint: {
    fontSize: 13,
    marginTop: 6,
  },
  signOutButton: {
    backgroundColor: "#FF3B30",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  signOutText: {
    color: "white",
    fontSize: 17,
    fontWeight: "600",
  },
  versionText: {
    textAlign: "center",
    fontSize: 13,
    marginTop: 30,
    marginBottom: 40,
  },
});
