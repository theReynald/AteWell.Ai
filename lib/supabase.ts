import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const supabaseUrl = "https://lkbfscxbeojdvhttcxvj.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrYmZzY3hiZW9qZHZodHRjeHZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MjM4NjksImV4cCI6MjA4NzM5OTg2OX0.MrY3w9nqvMKYggxQDtoDnllVdsTuUOHKaD68zQCWS4g";

// Cross-platform storage: web → localStorage, native → SecureStore, fallback → memory
const createStorage = () => {
  const memory: Record<string, string> = {};

  const localStorageAdapter = typeof window !== "undefined" && window.localStorage
    ? {
        getItem: async (key: string) => window.localStorage.getItem(key),
        setItem: async (key: string, value: string) => window.localStorage.setItem(key, value),
        removeItem: async (key: string) => window.localStorage.removeItem(key),
      }
    : null;

  const secureStoreAdapter = {
    getItem: async (key: string) => {
      try {
        return await SecureStore.getItemAsync(key);
      } catch {
        return null;
      }
    },
    setItem: async (key: string, value: string) => {
      try {
        await SecureStore.setItemAsync(key, value);
      } catch {
        // Silently fail
      }
    },
    removeItem: async (key: string) => {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        // Silently fail
      }
    },
  };

  const memoryAdapter = {
    getItem: async (key: string) => memory[key] ?? null,
    setItem: async (key: string, value: string) => {
      memory[key] = value;
    },
    removeItem: async (key: string) => {
      delete memory[key];
    },
  };

  return localStorageAdapter ?? secureStoreAdapter ?? memoryAdapter;
};

const storage = createStorage();

/**
 * Fetch wrapper with a timeout using Promise.race.
 * Avoids passing AbortController signal to whatwg-fetch (which breaks in the simulator).
 * Instead, we race the fetch against a timeout promise.
 */
function fetchWithTimeout(ms = 10000): typeof fetch {
  return (input, init) => {
    const timeout = new Promise<Response>((_resolve, reject) => {
      setTimeout(
        () => reject(new Error("Request timed out")),
        ms,
      );
    });
    return Promise.race([fetch(input, init), timeout]);
  };
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: fetchWithTimeout(10000),
  },
});

