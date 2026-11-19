import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    define: {
      // Vercel's Supabase integration uses unprefixed names. Expose only the
      // public URL and publishable/legacy anon key to this browser app.
      __SUPABASE_URL__: JSON.stringify(env.VITE_SUPABASE_URL || env.SUPABASE_URL || ""),
      __SUPABASE_PUBLISHABLE_KEY__: JSON.stringify(
        env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || ""
      ),
    },
    server: {
      port: 5173,
      open: true,
      allowedHosts: ['.ngrok-free.app'],
    },
  };
});
