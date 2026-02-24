// API configuration
// Dev: local Node server  |  Prod: Supabase Edge Function

// Optional override for dev/testing (set EXPO_PUBLIC_HEALTH_API_BASE="http://your-tunnel-or-host")
const ENV_API_BASE = process.env.EXPO_PUBLIC_HEALTH_API_BASE;

// TODO: Replace <your-project-ref> with your Supabase project reference ID
// Find it at: https://supabase.com/dashboard → Settings → General → Reference ID
const SUPABASE_PROJECT_REF = "lkbfscxbeojdvhttcxvj";
const PROD_API_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1`;

// Default to production Edge Function so physical devices don't call localhost.
// If you need a local server, set EXPO_PUBLIC_HEALTH_API_BASE to your LAN/tunnel URL.
export const API_BASE_URL = ENV_API_BASE || PROD_API_URL;

// In production, the Supabase anon key is needed for Edge Function auth
// Find it at: https://supabase.com/dashboard → Settings → API → anon/public key
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrYmZzY3hiZW9qZHZodHRjeHZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MjM4NjksImV4cCI6MjA4NzM5OTg2OX0.MrY3w9nqvMKYggxQDtoDnllVdsTuUOHKaD68zQCWS4g";
