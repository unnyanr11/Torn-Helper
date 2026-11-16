// Enforce the limit while reading so chunked requests have the same bound.
export async function readJsonObject(req: Request, jsonError: (body: unknown, status: number) => Response) {
  const limit = 128 * 1024;
  const reader = req.body?.getReader();
  if (!reader) return jsonError({ error: "Request body required" }, 400);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        void reader.cancel().catch(() => {});
        return jsonError({ error: "Request too large" }, 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    const body = JSON.parse(text + decoder.decode());
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, any>;
  } catch {
    // Malformed UTF-8, JSON and interrupted uploads are invalid requests.
  } finally {
    reader.releaseLock();
  }
  return jsonError({ error: "Invalid request body" }, 400);
}
