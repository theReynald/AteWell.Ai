import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import AuthScreen from '@/components/AuthScreen';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { GroceryProvider } from '@/contexts/GroceryContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ActivityIndicator, LogBox, View } from 'react-native';

// Suppress network errors in development (simulator has fetch issues)
LogBox.ignoreLogs([
  'Network request failed',
  'Request timed out',
  'TypeError: Network request failed',
  'Could not load items',
  'Network error loading items',
]);

function AppContent() {
  const colorScheme = useColorScheme();
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
        <ActivityIndicator size="large" color="#2089dc" />
      </View>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return (
    <GroceryProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GroceryProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
