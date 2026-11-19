import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import evaluateSessionHandler from "./api/evaluate-session.js";

function localApiRoutes(env) {
  return {
    name: "local-transcription-api",
    configureServer(server) {
      // Vite exposes VITE_* values to the browser but does not copy them into
      // process.env. The server handler needs the same public Supabase values
      // to verify the signed-in user before minting a Gemini token.
      const setServerEnv = (name, value) => {
        if (!process.env[name] && value) process.env[name] = value;
      };
      setServerEnv("SUPABASE_URL", env.SUPABASE_URL || env.VITE_SUPABASE_URL);
      setServerEnv("SUPABASE_PUBLISHABLE_KEY", env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY);
      setServerEnv("SUPABASE_ANON_KEY", env.SUPABASE_ANON_KEY);
      setServerEnv("GEMINI_API_KEY", env.GEMINI_API_KEY);
      setServerEnv("GEMINI_MODEL", env.GEMINI_MODEL);

      // Vite serves the frontend but does not run Vercel Functions. Adapt this
      // handler locally so scoring works on the same localhost:5173 origin.
      server.middlewares.use("/api/evaluate-session", (req, res) => {
        res.status = (status) => { res.statusCode = status; return res; };
        res.json = (payload) => {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(payload));
          return res;
        };
        let raw = "";
        req.on("data", (chunk) => {
          raw += chunk;
          if (raw.length > 100_000) {
            res.status(413).json({ error: "invalid_request" });
            req.destroy();
          }
        });
        req.on("end", async () => {
          if (res.writableEnded) return;
          try {
            req.body = JSON.parse(raw || "{}");
            await evaluateSessionHandler(req, res);
          } catch (error) {
            if (!res.writableEnded) res.status(500).json({ error: "local_api_failed", detail: error?.message || "Local scoring route failed." });
          }
        });
      });

    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), localApiRoutes(env)],
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
