export function validateClientConfig(
  urlValue: unknown,
  keyValue: unknown,
  production = true,
) {
  const url = typeof urlValue === "string" ? urlValue.trim() : "";
  const key = typeof keyValue === "string" ? keyValue.trim() : "";
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Set VITE_SUPABASE_URL to your Supabase project URL.");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (
    (parsed.protocol !== "https:" &&
      !(parsed.protocol === "http:" && local && !production)) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !["", "/"].includes(parsed.pathname)
  )
    throw new Error(
      "Use an HTTPS Supabase project URL without credentials, paths or query parameters.",
    );
  if (!key || /your_|placeholder|example/i.test(key))
    throw new Error(
      "Set VITE_SUPABASE_PUBLISHABLE_KEY to your project publishable key.",
    );
  if (key.startsWith("sb_secret_"))
    throw new Error(
      "A secret Supabase key cannot be used in the browser. Use a publishable key.",
    );
  if (!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key)) {
    try {
      const pieces = key.split(".");
      if (pieces.length !== 3) throw new Error();
      const payload = JSON.parse(
        atob(pieces[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (payload.role !== "anon") throw new Error();
    } catch {
      throw new Error(
        "Use a Supabase publishable key or legacy anon key. Server and service-role credentials are forbidden.",
      );
    }
  }
  return { url: parsed.origin, key };
}
