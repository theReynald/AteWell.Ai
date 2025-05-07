import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';


import GroceryList from '@/components/GroceryList';
import { ThemedView } from '@/components/ThemedView';

export default function HomeScreen() {
  return (
    <LinearGradient
      colors={["#ffffff", "#e6f0ff", "#99c2ff", "#3366cc", "#001f3f"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradientBackground}
    >
      <ThemedView style={styles.container}>
        <GroceryList />
      </ThemedView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientBackground: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
});