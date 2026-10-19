import { createClient } from "@supabase/supabase-js";
import { validateClientConfig } from "./config";
const config = validateClientConfig(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY,
  import.meta.env.PROD,
);
export const isRecoveryLink =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";
export const supabase = createClient(config.url, config.key);
