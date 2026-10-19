export class TornApiError extends Error {
  constructor(
    public code: number | null,
    public httpStatus: number | null = null,
  ) {
    super(
      code === null
        ? "Torn API temporarily unavailable"
        : `Torn API rejected request (code ${code})`,
    );
  }
}
export async function tornGet(
  path: string,
  apiKey: string,
  fetcher: typeof fetch = fetch,
) {
  if (!path.startsWith("/") || path.startsWith("//"))
    throw new Error("Invalid Torn path");
  const response = await fetcher(`https://api.torn.com/v2${path}`, {
    headers: { Authorization: `ApiKey ${apiKey}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new TornApiError(null, response.status);
  const data = await response.json();
  if (data.error)
    throw new TornApiError(
      Number.isInteger(data.error.code) ? data.error.code : null,
    );
  return data;
}
export type Attack = {
  id: string;
  attacker: number;
  defender: number;
  ended: number;
  loss: boolean;
};
export function normalizeAttacks(payload: { attacks?: unknown }): Attack[] {
  const records = payload.attacks;
  if (!records || typeof records !== "object") return [];
  return Object.entries(records)
    .map(([id, value]) => {
      const a = value as Record<string, any>;
      return {
        id: String(a.id ?? id),
        attacker: Number(a.attacker?.id ?? a.attacker_id),
        defender: Number(a.defender?.id ?? a.defender_id),
        ended: Number(a.ended ?? a.timestamp_ended),
        loss: ["lost", "loss"].includes(String(a.result).toLowerCase()),
      };
    })
    .filter(
      (a) =>
        /^\d+$/.test(a.id) &&
        Number.isSafeInteger(a.attacker) &&
        a.attacker > 0 &&
        Number.isSafeInteger(a.defender) &&
        a.defender > 0 &&
        Number.isFinite(a.ended) &&
        a.ended > 0,
    )
    .sort((a, b) => a.ended - b.ended || a.id.localeCompare(b.id));
}
export function qualifies(
  attack: Attack,
  seller: number,
  target: number,
  start: number,
  end: number,
): boolean {
  return (
    attack.loss &&
    attack.attacker === seller &&
    attack.defender === target &&
    attack.ended >= start &&
    attack.ended <= end
  );
}
