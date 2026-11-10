export type Prize = { percentage?: number; item?: string; quantity?: number };
export type Campaign = {
  id: string;
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
  closes_at: string;
  created_at: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  drawn_at: string | null;
  pool_quantity: number | null;
  eligible_players: number | null;
};
export type Submission = {
  id: string;
  user_id: string;
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
  user_id: string;
  torn_id: number;
  player_name: string;
  prize_item: string;
  quantity: number;
  percentage: number | null;
  payment_reference: string | null;
  paid_at: string | null;
  received_at: string | null;
};
export type DrawDetails = {
  campaign: Campaign;
  is_host: boolean;
  submissions: Submission[];
  pool_quantity: number;
  eligible_players: number;
  pending_count: number;
  winners: Winner[];
};
export function prizePreview(pool: number, prizes: Prize[]) {
  const quantities = prizes.map((p) =>
    Math.floor((pool * Math.round((p.percentage ?? 0) * 100)) / 10000),
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
      : Date.parse(c.closes_at) <= now
        ? "Awaiting draw"
        : "Open";
}
