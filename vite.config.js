import { defineConfig, loadEnv } from "vite";
import { readPublicConfig } from "./src/config.js";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if ((url || key) && !readPublicConfig(url, key)) {
    throw new Error("Configuração Supabase inválida. Use somente URL HTTPS do projeto dedicado e chave sb_publishable_. R4Food/Finance são bloqueados.");
  }
  return {};
});
