/** Personal planning only. All monetary amounts are whole Torn dollars. */
export interface MortgageTerms {
  principal: number;
  annualBps: number;
  months: number;
  firstDue: string;
}
export interface Installment {
  number: number;
  due: string;
  principal: number;
  interest: number;
  amount: number;
  balance: number;
}
export function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function monthlyDate(first: string, offset: number): string {
  const start = new Date(first + "T00:00:00Z");
  const last = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth() + offset,
      Math.min(start.getUTCDate(), last),
    ),
  )
    .toISOString()
    .slice(0, 10);
}
export function amortize(t: MortgageTerms): Installment[] {
  if (
    !Number.isSafeInteger(t.principal) ||
    t.principal < 1 ||
    t.principal > 1e12 ||
    !Number.isInteger(t.annualBps) ||
    t.annualBps < 0 ||
    t.annualBps > 10000 ||
    !Number.isInteger(t.months) ||
    t.months < 1 ||
    t.months > 600 ||
    !validDate(t.firstDue) ||
    t.firstDue < "2000-01-01" ||
    t.firstDue > "2100-12-31"
  )
    throw new Error(
      "Use a whole-dollar principal of 1–1 trillion, annual rate of 0–100% (two decimals), 1–600 months and a valid first due date (2000–2100).",
    );
  const rate = t.annualBps / 120000;
  const payment = rate
    ? Math.round((t.principal * rate) / (1 - (1 + rate) ** -t.months))
    : Math.max(1, Math.round(t.principal / t.months));
  let balance = t.principal;
  const rows: Installment[] = [];
  for (let i = 0; i < t.months && balance > 0; i++) {
    const interest = Math.round((balance * t.annualBps) / 120000);
    const principal =
      i === t.months - 1
        ? balance
        : Math.min(balance, Math.max(1, payment - interest));
    balance -= principal;
    rows.push({
      number: i + 1,
      due: monthlyDate(t.firstDue, i),
      principal,
      interest,
      amount: principal + interest,
      balance,
    });
  }
  return rows;
}
export interface CashFlow {
  date: string;
  asset: string;
  amount: number;
}
export interface CashFlowSummary {
  invested: number;
  returned: number;
  profit: number;
  roi: number;
  npv: number;
  xirr: number | null;
  xirrReason: string;
  recoveryDate: string | null;
  assets: {
    asset: string;
    invested: number;
    returned: number;
    profit: number;
  }[];
}
export function analyzeCashFlows(
  flows: CashFlow[],
  discountPercent = 0,
): CashFlowSummary {
  if (
    flows.length < 2 ||
    flows.length > 500 ||
    !Number.isFinite(discountPercent) ||
    discountPercent <= -100 ||
    discountPercent > 10000
  )
    throw new Error(
      "Enter 2–500 dated cash flows and a discount rate above -100% and at most 10,000%.",
    );
  if (
    flows.some(
      (f) =>
        !validDate(f.date) ||
        !f.asset.trim() ||
        f.asset.length > 80 ||
        !Number.isSafeInteger(f.amount) ||
        !f.amount ||
        Math.abs(f.amount) > 1e12,
    )
  )
    throw new Error(
      "Each flow needs a valid date, asset name and a nonzero whole-dollar amount up to 1 trillion.",
    );
  const sorted = [...flows].sort((a, b) => a.date.localeCompare(b.date));
  const invested = -flows.reduce((s, f) => s + Math.min(0, f.amount), 0),
    returned = flows.reduce((s, f) => s + Math.max(0, f.amount), 0);
  if (!invested || !returned)
    throw new Error(
      "Include both investment outflows (negative) and receipts or a terminal valuation (positive).",
    );
  const start = Date.parse(sorted[0].date),
    times = sorted.map((f) => (Date.parse(f.date) - start) / 86400000 / 365);
  const rawValue = (logRate: number) =>
    sorted.reduce((s, f, i) => s + f.amount * Math.exp(-logRate * times[i]), 0);
  const npv = rawValue(Math.log1p(discountPercent / 100));
  if (!Number.isFinite(npv))
    throw new Error(
      "The discount rate and dates exceed the supported NPV range.",
    );
  // Scale all terms equally when finding roots, avoiding Infinity - Infinity on long horizons.
  const value = (logRate: number) => {
    const exponents = times.map((t) => -logRate * t),
      shift = Math.max(0, ...exponents);
    return sorted.reduce(
      (sum, f, i) => sum + f.amount * Math.exp(exponents[i] - shift),
      0,
    );
  };
  // Group same-day flows. Nonconventional signs can have multiple IRRs; do not pick an arbitrary root.
  const daily = new Map<string, number>();
  sorted.forEach((f) => daily.set(f.date, (daily.get(f.date) ?? 0) + f.amount));
  const signs = [...daily.values()]
    .filter((v) => v !== 0)
    .map((v) => Math.sign(v));
  const changes = signs.slice(1).filter((s, i) => s !== signs[i]).length;
  let xirr: number | null = null,
    xirrReason = "";
  if (times[times.length - 1] === 0)
    xirrReason = "A return rate needs cash flows on different dates.";
  else if (changes !== 1 || signs[0] !== -1)
    xirrReason =
      "Nonconventional cash flows can have multiple return rates; XIRR is omitted.";
  else {
    let low = -20,
      high = 20;
    if (value(low) * value(high) > 0)
      xirrReason = "No return rate found inside the supported numerical range.";
    else {
      for (let i = 0; i < 180; i++) {
        const mid = (low + high) / 2;
        if (value(mid) > 0) low = mid;
        else high = mid;
      }
      xirr = Math.expm1((low + high) / 2) * 100;
    }
  }
  let balance = 0,
    recoveryDate: string | null = null,
    deployed = false;
  for (const [date, amount] of daily) {
    balance += amount;
    if (balance < 0) deployed = true;
    if (deployed && balance >= 0 && !recoveryDate) recoveryDate = date;
  }
  const assets = [...new Set(flows.map((f) => f.asset.trim()))].map((asset) => {
    const subset = flows.filter((f) => f.asset.trim() === asset);
    const cost = -subset.reduce((s, f) => s + Math.min(0, f.amount), 0),
      income = subset.reduce((s, f) => s + Math.max(0, f.amount), 0);
    return { asset, invested: cost, returned: income, profit: income - cost };
  });
  return {
    invested,
    returned,
    profit: returned - invested,
    roi: ((returned - invested) / invested) * 100,
    npv,
    xirr,
    xirrReason,
    recoveryDate,
    assets,
  };
}
