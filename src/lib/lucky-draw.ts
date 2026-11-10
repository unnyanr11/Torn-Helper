export type Prize = { percentage?: number; item?: string; quantity?: number };
export type Campaign = {
  id: string;
  entry_token: string;
  entry_verification: "manual" | "token";
  audience: "all" | "new_players" | "faction";
  faction_id: number | null;
  host_user_id: string;
  host_torn_id: number;
  host_name: string;
  title: string;
  description: string;
  entry_item: string;
  quantity_per_ticket: number;
  max_tickets_per_player: number;
  prize_mode: "pool" | "fixed";
  prizes: Prize[];
  deposit_mode: "legacy_minimum" | "fixed" | "range";
  maximum_deposit: number | null;
  minimum_entries: number;
  days_after_threshold: number | null;
  threshold_reached_at: string | null;
  closing_policy: "fixed_date" | "entry_threshold";
  closes_at: string | null;
  created_at: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  drawn_at: string | null;
  pool_quantity: number | null;
  eligible_players: number | null;
};
export type Submission = {
  id: string;
  user_id: string | null;
  torn_id: number;
  player_name: string;
  quantity: number;
  tickets: number;
  transfer_reference: string;
  evidence: string;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  refund_reference: string | null;
  refunded_at: string | null;
  created_at: string;
};
export type Winner = {
  rank: number;
  user_id: string | null;
  torn_id: number;
  player_name: string;
  prize_item: string;
  quantity: number;
  percentage: number | null;
  payment_reference: string | null;
  paid_at: string | null;
  received_at: string | null;
};
export type Receipt = {
  log_id: string;
  sender_torn_id: number;
  received_at: string;
  kind: "cash" | "item";
  assets: { item_id?: number; quantity: number }[];
  message: string;
  entry_quantity: number;
  tickets: number;
  state: string;
  reason: string | null;
};
export type ReceiptPage = {
  offset: number;
  total: number;
  rows: Receipt[];
  money_received: number;
  counted_entries: number;
};
export type DrawDetails = {
  viewer_torn_id: number;
  receipt_data: ReceiptPage;
  entry_count: number;
  sync: { checked_through: number; has_more: boolean; pages: number } | null;
  campaign: Campaign;
  is_host: boolean;
  submissions: Submission[];
  pool_quantity: number;
  eligible_players: number;
  pending_count: number;
  winners: Winner[];
};
export function prizePreview(pool: number, prizes: Prize[]) {
  const wholePool = Number.isSafeInteger(pool) && pool >= 0 ? BigInt(pool) : 0n;
  const quantities = prizes.map((p) =>
    Number(
      (wholePool * BigInt(Math.round((p.percentage ?? 0) * 100))) / 10000n,
    ),
  );
  return {
    quantities,
    remainder: pool - quantities.reduce((sum, n) => sum + n, 0),
    percentage:
      prizes.reduce(
        (sum, p) => sum + Math.round((p.percentage ?? 0) * 100),
        0,
      ) / 100,
  };
}
export function campaignStatus(c: Campaign, now = Date.now()) {
  return c.cancelled_at
    ? "Cancelled"
    : c.drawn_at
      ? "Drawn"
      : !c.closes_at
        ? "Awaiting minimum entries"
        : Date.parse(c.closes_at) <= now
          ? "Awaiting draw"
          : "Open";
}

export function depositLabel(c: Campaign) {
  const amount = (n: number) =>
    c.entry_item === "Cash"
      ? `$${n.toLocaleString()}`
      : `${n.toLocaleString()} ${c.entry_item}`;
  if (c.deposit_mode === "fixed")
    return `Exactly ${amount(c.quantity_per_ticket)} per transfer`;
  if (c.deposit_mode === "range")
    return `${amount(c.quantity_per_ticket)} to ${amount(c.maximum_deposit ?? c.quantity_per_ticket)} per transfer (inclusive)`;
  return `At least ${amount(c.quantity_per_ticket)} per transfer`;
}
