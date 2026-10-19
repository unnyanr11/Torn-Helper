/** Extract the safe JSON error returned by an Edge Function, including non-2xx responses. */
export async function functionError(
  data: unknown,
  error: unknown,
  fallback = "Request failed.",
): Promise<Error> {
  let message =
    typeof (data as any)?.error === "string" ? (data as any).error : "";
  const context = (error as any)?.context;
  if (!message && context instanceof Response) {
    try {
      const body = await context.clone().json();
      if (typeof body?.error === "string") message = body.error;
      else if (typeof body?.message === "string") message = body.message;
    } catch {
      /* A gateway may return a non-JSON body. */
    }
  }
  if (!message && error instanceof Error) message = error.message;
  return new Error(message || fallback);
}
