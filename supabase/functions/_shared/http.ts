import { createClient } from "npm:@supabase/supabase-js@2.118.0";
export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-job-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function authenticate(
  req: Request,
  admin: ReturnType<typeof adminClient>,
) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer /i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error ? null : data.user;
}
export async function scheduled(
  req: Request,
  admin: ReturnType<typeof adminClient>,
) {
  const token = req.headers.get("x-job-token");
  if (!token) return false;
  const { data, error } = await admin.rpc("authorize_scheduled_job", {
    job_token: token,
  });
  return !error && data === true;
}
export function preflight(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  return null;
}
export function checked<T extends { error: unknown }>(result: T): T {
  if (result.error) throw result.error;
  return result;
}
