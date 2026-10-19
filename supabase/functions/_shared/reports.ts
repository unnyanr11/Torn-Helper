export function shareIsActive(
  grant: { expires_at: string; revoked: boolean; audience: string } | null,
  now = Date.now(),
): boolean {
  return (
    !!grant &&
    !grant.revoked &&
    grant.audience === "link" &&
    Date.parse(grant.expires_at) > now
  );
}
export function redactReport(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactReport);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            !/key|token|secret|encrypted|password|authorization|webhook/i.test(
              key,
            ),
        )
        .map(([key, data]) => [key, redactReport(data)]),
    );
  return value;
}
