# AteWell Web

A lightweight Next.js web client for the AteWell grocery list. Sign in with the same Supabase project and add items that appear on mobile.

## Quick start

1. Copy env template:
   ```bash
   cp .env.example .env.local
   ```
   Ensure the values match the mobile app.

2. Install deps and run dev:
   ```bash
   npm install
   npm run dev
   ```

3. Open http://localhost:3000 and sign in with the same credentials you use on mobile.

## Notes
- Uses the `grocery_items` table and Supabase email/password auth, mirroring the mobile app.
- Items are inserted with `user_id` = the signed-in user, so they sync automatically to the mobile list.
- Keep `.env.local` out of source control (already ignored).
