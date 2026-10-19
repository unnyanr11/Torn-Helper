export type Mode = "equal" | "proportional" | "weighted" | "hybrid";
export interface MemberInput {
  id: string;
  name: string;
  points: number;
  weight?: number;
  bonus: number;
  reimbursement: number;
  adjustment: number;
}
export function calculatePayout(
  members: MemberInput[],
  pool: number,
  mode: Mode,
  floors: Record<string, number> = {},
  caps: Record<string, number> = {},
) {
  const fail = (error: string) => ({
    lines: [] as any[],
    allocated: 0,
    retained: pool,
    error,
  });
  if (!Number.isSafeInteger(pool) || pool < 0)
    return fail("Pool must be a nonnegative safe integer");
  if (
    !members.length ||
    new Set(members.map((m) => m.id)).size !== members.length
  )
    return fail("Provide members with distinct IDs");
  if (
    members.some(
      (m) =>
        !m.name.trim() ||
        !Number.isFinite(m.points) ||
        m.points < 0 ||
        !Number.isFinite(m.weight ?? 1) ||
        (m.weight ?? 1) < 0 ||
        ![m.bonus, m.reimbursement, m.adjustment].every(Number.isSafeInteger),
    )
  )
    return fail(
      "Member inputs must have valid names, points, weights and integer adjustments",
    );
  const additions = members.reduce(
    (s, m) => s + m.bonus + m.reimbursement + m.adjustment,
    0,
  );
  const available = pool - additions;
  if (!Number.isSafeInteger(available) || available < 0)
    return fail("Bonuses, reimbursements and adjustments exceed the pool");
  const base = members.map((m) => floors[m.id] ?? 0),
    maximum = members.map((m) => caps[m.id] ?? available);
  if (
    base.some(
      (n, i) =>
        !Number.isSafeInteger(n) ||
        n < 0 ||
        !Number.isSafeInteger(maximum[i]) ||
        maximum[i] < n,
    )
  )
    return fail("Invalid share floor or cap");
  let remaining = available - base.reduce((s, n) => s + n, 0);
  if (remaining < 0) return fail("Share floors exceed the available pool");
  const totalPoints = members.reduce((s, m) => s + m.points, 0),
    totalWeighted = members.reduce((s, m) => s + m.points * (m.weight ?? 1), 0);
  const weights = members.map((m) =>
    mode === "equal"
      ? 1
      : mode === "weighted"
        ? m.points * (m.weight ?? 1)
        : mode === "hybrid"
          ? 0.5 / members.length +
            (totalPoints
              ? (0.5 * m.points) / totalPoints
              : 0.5 / members.length)
          : m.points,
  );
  while (remaining > 0) {
    const eligible = members
      .map((_, i) => i)
      .filter((i) => base[i] < maximum[i] && weights[i] > 0);
    if (!eligible.length) break;
    const total = eligible.reduce((s, i) => s + weights[i], 0),
      round = remaining;
    const fractions = eligible
      .map((i) => {
        const exact = (round * weights[i]) / total;
        const n = Math.min(maximum[i] - base[i], Math.floor(exact));
        base[i] += n;
        remaining -= n;
        return { i, fraction: exact - Math.floor(exact) };
      })
      .sort(
        (a, b) =>
          b.fraction - a.fraction ||
          members[a.i].id.localeCompare(members[b.i].id),
      );
    for (const { i } of fractions) {
      if (!remaining) break;
      if (base[i] < maximum[i]) {
        base[i]++;
        remaining--;
      }
    }
    if (remaining === round) break;
  }
  const lines = members.map((m, i) => ({
    member_id: m.id,
    member_name: m.name,
    eligible_points: m.points,
    share_cents: base[i],
    bonus_cents: m.bonus,
    reimbursement_cents: m.reimbursement,
    adjustment_cents: m.adjustment,
    amount_owed_cents: base[i] + m.bonus + m.reimbursement + m.adjustment,
    paid_cents: 0,
    status: "pending",
    explanation: `${mode}: share ${base[i]}, bonus ${m.bonus}, reimbursement ${m.reimbursement}, adjustment ${m.adjustment}`,
  }));
  if (
    lines.some(
      (l) =>
        !Number.isSafeInteger(l.amount_owed_cents) || l.amount_owed_cents < 0,
    )
  )
    return fail("An adjustment creates a negative or unsafe payment");
  const allocated = lines.reduce((s, l) => s + l.amount_owed_cents, 0);
  if (allocated > pool) return fail("Allocation exceeds the pool");
  return { lines, allocated, retained: pool - allocated, error: "" };
}
