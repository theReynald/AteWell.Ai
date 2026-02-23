// API configuration
// Dev: local Node server  |  Prod: Supabase Edge Function

const DEV_API_URL = "http://localhost:3000";

// TODO: Replace <your-project-ref> with your Supabase project reference ID
// Find it at: https://supabase.com/dashboard → Settings → General → Reference ID
const SUPABASE_PROJECT_REF = "lkbfscxbeojdvhttcxvj";
const PROD_API_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1`;

const IS_DEV = __DEV__;

// Dev path:  http://localhost:3000/api/health-suggestion
// Prod path: https://<ref>.supabase.co/functions/v1/health-suggestion
export const API_BASE_URL = IS_DEV ? DEV_API_URL : PROD_API_URL;

// In production, the Supabase anon key is needed for Edge Function auth
// Find it at: https://supabase.com/dashboard → Settings → API → anon/public key
export const SUPABASE_ANON_KEY = "sb_publishable_ajAp3BCz2jqBG8U1wAlgfQ_gHT1q6oL";
