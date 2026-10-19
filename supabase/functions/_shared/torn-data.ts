import registry from "./generated-capabilities.json" with { type: "json" };
import { LoginError } from "./torn-login.ts";
import { TornApiError } from "./torn.ts";
export type Parameter = {
  name: string;
  location: string;
  required: boolean;
  description: string;
  schema: any;
};
export type Endpoint = {
  id: string;
  path: string;
  group: string;
  summary: string;
  parameters: Parameter[];
  requiredAccess: string;
};
export const endpoints: Endpoint[] = registry.capabilities;
const forbidden = /^(key|api_?key|authorization|token|secret|password)$/i;
function validValue(value: string, schema: any): boolean {
  if (schema.enum && !schema.enum.map(String).includes(value)) return false;
  for (const kind of ["oneOf", "anyOf"])
    if (schema[kind])
      return schema[kind].some((child: any) => validValue(value, child));
  if (
    schema.allOf &&
    !schema.allOf.every((child: any) => validValue(value, child))
  )
    return false;
  if (schema.type === "array")
    return value
      .split(",")
      .every((item) => validValue(item, schema.items ?? {}));
  if (schema.type === "boolean" && !["true", "false"].includes(value))
    return false;
  if (["integer", "number"].includes(schema.type)) {
    if (!/^-?\d+(\.\d+)?$/.test(value)) return false;
    const n = Number(value);
    if (
      !Number.isFinite(n) ||
      (schema.type === "integer" && !Number.isSafeInteger(n))
    )
      return false;
    if (schema.minimum !== undefined && n < schema.minimum) return false;
    if (schema.maximum !== undefined && n > schema.maximum) return false;
  }
  if (schema.minLength !== undefined && value.length < schema.minLength)
    return false;
  if (schema.maxLength !== undefined && value.length > schema.maxLength)
    return false;
  if (schema.pattern && !new RegExp(schema.pattern).test(value)) return false;
  return true;
}
export function compileTornRequest(endpointId: unknown, input: unknown) {
  const endpoint = endpoints.find((item) => item.id === endpointId);
  if (!endpoint)
    throw new LoginError(400, "Choose a documented Torn data section.");
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new LoginError(400, "Invalid section parameters.");
  const parameters: Record<string, string> = {};
  const allowed = endpoint.parameters.filter(
    (p) => ["query", "path"].includes(p.location) && !forbidden.test(p.name),
  );
  for (const [name, raw] of Object.entries(input)) {
    const parameter = allowed.find((p) => p.name === name);
    if (
      !parameter ||
      typeof raw !== "string" ||
      raw.length > 1024 ||
      /[\x00-\x1f]/.test(raw)
    )
      throw new LoginError(400, "Invalid or unsupported parameter.");
    if (!raw.trim()) continue;
    const value = raw.trim();
    if (!validValue(value, parameter.schema))
      throw new LoginError(400, `Check the value for ${name}.`);
    parameters[name] = value;
  }
  for (const parameter of allowed)
    if (parameter.required && !parameters[parameter.name])
      throw new LoginError(400, `Enter ${parameter.name} for this section.`);
  let path = endpoint.path;
  for (const parameter of allowed.filter((p) => p.location === "path")) {
    const value = parameters[parameter.name];
    if (!value || !/^[A-Za-z0-9_-]+$/.test(value))
      throw new LoginError(400, `Enter a valid ${parameter.name}.`);
    path = path.replace(`{${parameter.name}}`, encodeURIComponent(value));
  }
  if (/[{}]/.test(path))
    throw new LoginError(400, "Missing section identifier.");
  const query = new URLSearchParams();
  for (const name of Object.keys(parameters).sort())
    if (allowed.find((p) => p.name === name)?.location === "query")
      query.set(name, parameters[name]);
  return { endpoint, parameters, path: path + (query.size ? `?${query}` : "") };
}
export async function requestHash(
  endpoint: string,
  parameters: Record<string, string>,
) {
  const sorted = Object.fromEntries(
    Object.entries(parameters).sort(([a], [b]) => a.localeCompare(b)),
  );
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify([endpoint, sorted])),
  );
  return [...new Uint8Array(hash)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export async function boundedJson(message: Request | Response, limit: number) {
  const reader = message.body?.getReader();
  if (!reader) throw new LoginError(400, "Empty request.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new LoginError(
        413,
        "This result is too large. Choose a smaller limit, date range or selection.",
      );
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(all));
  } catch {
    throw new LoginError(
      message instanceof Request ? 400 : 503,
      "Invalid JSON response or request.",
    );
  }
}
export async function fetchTornPage(
  path: string,
  apiKey: string,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher(`https://api.torn.com/v2${path}`, {
    headers: { Authorization: `ApiKey ${apiKey}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new TornApiError(null, response.status);
  const data = await boundedJson(response, 2097152);
  if (data?.error)
    throw new TornApiError(
      Number.isInteger(data.error.code) ? data.error.code : null,
    );
  // Upstream pagination URLs can echo credentials. Never cache or return the key.
  function scrub(value: any): any {
    if (typeof value === "string") {
      let safe = value.split(apiKey).join("[redacted]");
      if (safe.startsWith("https://api.torn.com/")) {
        try {
          const url = new URL(safe);
          for (const name of [...url.searchParams.keys()])
            if (forbidden.test(name)) url.searchParams.delete(name);
          safe = url.toString();
        } catch {}
      }
      return safe;
    }
    if (Array.isArray(value)) return value.map(scrub);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([name, child]) => [
          name,
          forbidden.test(name) && typeof child === "string"
            ? "[redacted]"
            : scrub(child),
        ]),
      );
    return value;
  }
  return scrub(data);
}
export function nextPageParameters(
  payload: any,
  compiled: ReturnType<typeof compileTornRequest>,
) {
  const next = payload?._metadata?.links?.next;
  if (typeof next !== "string") return null;
  try {
    const url = new URL(next, "https://api.torn.com");
    if (
      url.origin !== "https://api.torn.com" ||
      url.pathname !== `/v2${compiled.path.split("?")[0]}`
    )
      return null;
    const values = { ...compiled.parameters };
    for (const [name, value] of url.searchParams)
      if (
        compiled.endpoint.parameters.some(
          (p) => p.location === "query" && p.name === name,
        ) &&
        !forbidden.test(name)
      )
        values[name] = value;
    const validated = compileTornRequest(compiled.endpoint.id, values);
    return JSON.stringify(validated.parameters) ===
      JSON.stringify(compiled.parameters)
      ? null
      : validated.parameters;
  } catch {
    return null;
  }
}

export function tornDataFailure(error: unknown) {
  if (error instanceof LoginError)
    return { status: error.status, error: error.message };
  if (error instanceof TornApiError) {
    if ([5, 8, 14].includes(error.code ?? -1) || error.httpStatus === 429)
      return {
        status: 429,
        error: `Torn's request quota is currently exhausted (code ${error.code ?? 429}). Wait before trying again; other tools can share this account's quota.`,
      };
    if ([7, 16].includes(error.code ?? -1))
      return {
        status: 403,
        error:
          "Your Torn key or faction/company role does not allow this data. Check the section's access requirements.",
      };
    if ([2, 10, 13, 18].includes(error.code ?? -1))
      return {
        status: 401,
        error:
          "This Torn key is invalid, paused or unavailable. Check it in Torn settings.",
      };
    if (error.code === null || [9, 12, 15, 17, 24].includes(error.code))
      return {
        status: 503,
        error: "Torn is temporarily unavailable. Retry shortly.",
      };
    return {
      status: 400,
      error: `Torn rejected this section request (code ${error.code}). Check the IDs, categories and options.`,
    };
  }
  return {
    status: 503,
    error: "Unable to fetch this Torn section. Retry shortly.",
  };
}
