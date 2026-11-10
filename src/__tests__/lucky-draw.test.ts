import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { prizePreview, campaignStatus, type Campaign } from "../lib/lucky-draw";
const db = new PGlite();
const host = "00000000-0000-4000-8000-000000000001",
  a = "00000000-0000-4000-8000-000000000002",
  b = "00000000-0000-4000-8000-000000000003",
  d = "00000000-0000-4000-8000-000000000004";
async function user(id: string, sql: string, params: unknown[] = []) {
  await db.exec(
    `select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`,
  );
  try {
    return await db.query<any>(sql, params);
  } finally {
    await db.exec("reset role");
  }
}
async function act(
  id: string,
  action: string,
  campaign: string | null = null,
  payload: Record<string, unknown> = {},
) {
  return (
    await user(id, "select public.lucky_draw_action($1,$2,$3) as data", [
      action,
      campaign,
      JSON.stringify(payload),
    ])
  ).rows[0].data;
}
function terms(extra: Record<string, unknown> = {}) {
  return {
    title: "Xanax lucky draw",
    description: "A real campaign",
    entry_item: "Xanax",
    quantity_per_ticket: 1,
    max_tickets_per_player: 100,
    prize_mode: "pool",
    prizes: [{ percentage: 40 }, { percentage: 20 }, { percentage: 10 }],
    closes_at: new Date(Date.now() + 86400000).toISOString(),
    ...extra,
  };
}
let campaign: string;
beforeAll(async () => {
  await db.exec(`create role authenticated;create role anon;create schema auth;create schema private;create schema extensions;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
 create table public.profiles(id uuid primary key);
 create table public.linked_torn_accounts(user_id uuid primary key,torn_id bigint unique,torn_name text,revoked_at timestamptz);
 -- Randomness shim only for isolated WASM PostgreSQL; production uses pgcrypto.
 create function extensions.gen_random_bytes(n integer) returns bytea language sql volatile as $$select substring(decode(md5(random()::text),'hex') from 1 for n)$$;
 insert into profiles values('${host}'),('${a}'),('${b}'),('${d}');
 insert into linked_torn_accounts values('${host}',1,'Host',null),('${a}',2,'Alice',null),('${b}',3,'Bob',null),('${d}',4,'Dan',null);`);
  await db.exec(
    readFileSync(
      "supabase/migrations/20261110083910_lucky_draw_campaigns.sql",
      "utf8",
    ),
  );
  campaign = (await act(host, "create", null, terms())).id;
});
afterAll(() => db.close());
describe("campaign validation and access controls", () => {
  it("preserves the 40/20/10 configuration and computes whole-item remainder", async () => {
    const r = await act(a, "details", campaign);
    expect(r.campaign.prizes).toEqual([
      { percentage: 40 },
      { percentage: 20 },
      { percentage: 10 },
    ]);
    expect(prizePreview(101, r.campaign.prizes)).toEqual({
      quantities: [40, 20, 10],
      remainder: 31,
      percentage: 70,
    });
    expect(
      prizePreview(3, [
        { percentage: 33.33 },
        { percentage: 33.33 },
        { percentage: 33.34 },
      ]),
    ).toEqual({ quantities: [0, 0, 1], remainder: 2, percentage: 100 });
  });
  it("rejects invalid percentages, fractional prizes, missing limits and past deadlines", async () => {
    for (const extra of [
      { prizes: [{ percentage: 101 }] },
      { prizes: [{ percentage: 70 }, { percentage: 40 }] },
      { prizes: [] },
      { prizes: [{ percentage: 0 }] },
      { prizes: [{ percentage: 2.555 }] },
      { prize_mode: "fixed", prizes: [{ item: "Xanax", quantity: 1.5 }] },
      { closes_at: new Date(0).toISOString() },
      { quantity_per_ticket: null },
      { max_tickets_per_player: 0 },
    ])
      await expect(act(host, "create", null, terms(extra))).rejects.toThrow();
  });
  it("blocks unauthenticated and revoked identities", async () => {
    await db.exec(`set role anon`);
    await expect(
      db.query("select public.lucky_draw_action('details',$1)", [campaign]),
    ).rejects.toThrow("permission denied");
    await db.exec("reset role");
    await db.exec(
      `update linked_torn_accounts set revoked_at=now() where user_id='${d}'`,
    );
    await expect(act(d, "details", campaign)).rejects.toThrow("verified Torn");
    await db.exec(
      `update linked_torn_accounts set revoked_at=null where user_id='${d}'`,
    );
  });
  it("disallows direct client edits and private evidence access", async () => {
    await expect(
      user(host, "update lucky_draw_campaigns set prizes='[]'"),
    ).rejects.toThrow("permission denied");
    await expect(
      user(a, "select * from private.lucky_draw_submissions"),
    ).rejects.toThrow("permission denied");
    await expect(
      user(a, "insert into lucky_draw_winners(campaign_id,rank) values($1,1)", [
        campaign,
      ]),
    ).rejects.toThrow("permission denied");
  });
  it("checks quantities, host exclusion, per-player limits and deduplicates a host transfer across campaigns", async () => {
    await expect(
      act(host, "submit", campaign, { quantity: 1 }),
    ).rejects.toThrow("Hosts cannot");
    const other = (
      await act(
        host,
        "create",
        null,
        terms({
          quantity_per_ticket: 2,
          max_tickets_per_player: 2,
          prizes: [{ percentage: 50 }],
        }),
      )
    ).id;
    await expect(act(a, "submit", other, { quantity: 3 })).rejects.toThrow(
      "whole multiple",
    );
    const payload = {
      quantity: 4,
      transfer_reference: "unique-transfer",
      evidence: "Sent four Xanax to Host",
    };
    await act(a, "submit", other, payload);
    await expect(
      act(a, "submit", other, { ...payload, transfer_reference: "different" }),
    ).rejects.toThrow("ticket limit");
    await expect(act(a, "submit", campaign, payload)).rejects.toThrow("unique");
  });
});
describe("cancellation and immutable rules", () => {
  it("stops entries and draws when cancelled and records refunds once", async () => {
    const c = await act(
      host,
      "create",
      null,
      terms({ prizes: [{ percentage: 40 }] }),
    );
    const entry = await act(a, "submit", c.id, {
      quantity: 1,
      transfer_reference: "cancelled-entry",
      evidence: "One item sent to the host",
    });
    await expect(act(a, "cancel", c.id, { note: "Stop" })).rejects.toThrow(
      "Only the host",
    );
    await expect(act(host, "cancel", c.id, { note: "" })).rejects.toThrow(
      "reason",
    );
    await act(host, "cancel", c.id, {
      note: "Not enough players; items will be returned",
    });
    await expect(act(a, "submit", c.id, { quantity: 1 })).rejects.toThrow(
      "closed",
    );
    await expect(
      act(host, "approve", c.id, { submission_id: entry.id }),
    ).rejects.toThrow("cancelled");
    await expect(act(host, "draw", c.id)).rejects.toThrow("cancelled");
    await expect(
      act(a, "refund", c.id, {
        submission_id: entry.id,
        reference: "refund-1",
      }),
    ).rejects.toThrow("Only the host");
    await act(host, "refund", c.id, {
      submission_id: entry.id,
      reference: "refund-1",
    });
    await expect(
      act(host, "refund", c.id, {
        submission_id: entry.id,
        reference: "refund-2",
      }),
    ).rejects.toThrow("already refunded");
    const r = await act(a, "details", c.id);
    expect(r.submissions[0].refund_reference).toBe("refund-1");
    expect(campaignStatus(r.campaign)).toBe("Cancelled");
  });
  it("groups tickets by verified identity even if a player changes their name", async () => {
    const c = await act(
      host,
      "create",
      null,
      terms({ prizes: [{ percentage: 50 }, { percentage: 30 }] }),
    );
    for (const [id, name, ref] of [
      [a, "OldName", "old-name"],
      [a, "NewName", "new-name"],
      [b, "Bob", "bob-name"],
    ]) {
      await db.query(
        "update linked_torn_accounts set torn_name=$1 where user_id=$2",
        [name, id],
      );
      const entry = await act(id, "submit", c.id, {
        quantity: 1,
        transfer_reference: ref,
        evidence: "An item transfer",
      });
      await act(host, "approve", c.id, { submission_id: entry.id });
    }
    await db.query(
      "update lucky_draw_campaigns set closes_at=now()-interval '1 second' where id=$1",
      [c.id],
    );
    await act(host, "draw", c.id);
    expect((await act(host, "details", c.id)).winners).toHaveLength(2);
  });
});
describe("real database entry, draw and payout workflow", () => {
  let entry: string;
  it("accepts entries pending review and keeps evidence between host and entrant", async () => {
    for (const [id, q] of [
      [a, 41],
      [b, 40],
      [d, 20],
    ] as const) {
      const s = await act(id, "submit", campaign, {
        quantity: q,
        transfer_reference: `entry-${q}`,
        evidence: "Private transfer evidence",
      });
      if (id === a) entry = s.id;
    }
    const r = await act(a, "details", campaign);
    expect(r.submissions).toHaveLength(1);
    expect(r.pool_quantity).toBe(0);
    expect(r.pending_count).toBe(3);
    expect((await act(host, "details", campaign)).submissions).toHaveLength(3);
  });
  it("rejects forged approval, early draw, pending entries and too few winners", async () => {
    await expect(
      act(a, "approve", campaign, { submission_id: entry }),
    ).rejects.toThrow("Only the host");
    await expect(act(host, "draw", campaign)).rejects.toThrow("deadline");
    await db.query(
      "update lucky_draw_campaigns set closes_at=now()-interval '1 second' where id=$1",
      [campaign],
    );
    await expect(act(host, "draw", campaign)).rejects.toThrow("pending");
    await expect(act(a, "submit", campaign, { quantity: 1 })).rejects.toThrow(
      "closed",
    );
    const pending = (await act(host, "details", campaign)).submissions;
    await act(host, "approve", campaign, { submission_id: pending[0].id });
    await expect(
      act(host, "approve", campaign, { submission_id: pending[0].id }),
    ).rejects.toThrow("already reviewed");
    await act(host, "approve", campaign, { submission_id: pending[1].id });
    await expect(
      act(host, "reject", campaign, { submission_id: pending[2].id, note: "" }),
    ).rejects.toThrow("reason");
    await act(host, "reject", campaign, {
      submission_id: pending[2].id,
      note: "Transfer not received; resolve directly",
    });
    await expect(act(host, "draw", campaign)).rejects.toThrow(
      "distinct eligible player",
    );
    // New isolated campaign below supplies all three verified entrants.
  });
  it("finalizes one result with distinct weighted winners, exact pool shares and no rerolls", async () => {
    campaign = (await act(host, "create", null, terms())).id;
    for (const [id, q] of [
      [a, 41],
      [b, 40],
      [d, 20],
    ] as const) {
      const s = await act(id, "submit", campaign, {
        quantity: q,
        transfer_reference: `final-${q}`,
        evidence: "Transfer received by host",
      });
      await act(host, "approve", campaign, { submission_id: s.id });
    }
    await db.query(
      "update lucky_draw_campaigns set closes_at=now()-interval '1 second' where id=$1",
      [campaign],
    );
    await expect(act(a, "draw", campaign)).rejects.toThrow("Only the host");
    const attempts = await Promise.allSettled([
      act(host, "draw", campaign),
      act(host, "draw", campaign),
    ]);
    expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const r = await act(host, "details", campaign);
    expect(r.winners.map((w: any) => Number(w.quantity))).toEqual([40, 20, 10]);
    expect(new Set(r.winners.map((w: any) => w.user_id)).size).toBe(3);
    expect(r.campaign.pool_quantity).toBe(101);
    await expect(act(host, "draw", campaign)).rejects.toThrow("already final");
  });
  it("requires payout evidence, prevents duplicate sends and only accepts the actual winner receipt", async () => {
    const w = (await act(host, "details", campaign)).winners[0];
    await expect(
      act(host, "paid", campaign, { rank: 1, reference: "" }),
    ).rejects.toThrow("reference");
    await expect(
      act(a, "paid", campaign, { rank: 1, reference: "payout-1" }),
    ).rejects.toThrow("Only the host");
    await expect(
      act(w.user_id, "received", campaign, { rank: 1 }),
    ).rejects.toThrow("winning player");
    await act(host, "paid", campaign, { rank: 1, reference: "payout-1" });
    await expect(
      act(host, "paid", campaign, { rank: 1, reference: "payout-2" }),
    ).rejects.toThrow("already marked");
    await expect(act(host, "received", campaign, { rank: 1 })).rejects.toThrow(
      "winning player",
    );
    await act(w.user_id, "received", campaign, { rank: 1 });
    expect(
      (await act(host, "details", campaign)).winners[0].received_at,
    ).toBeTruthy();
  });
  it("supports separately supplied fixed item prizes", async () => {
    const c = await act(
      host,
      "create",
      null,
      terms({
        prize_mode: "fixed",
        prizes: [{ item: "Feathery Hotel Coupon", quantity: 3 }],
      }),
    );
    const s = await act(a, "submit", c.id, {
      quantity: 1,
      transfer_reference: "fixed-transfer",
      evidence: "One Xanax received",
    });
    await act(host, "approve", c.id, { submission_id: s.id });
    await db.query(
      "update lucky_draw_campaigns set closes_at=now()-interval '1 second' where id=$1",
      [c.id],
    );
    await act(host, "draw", c.id);
    const winner = (await act(host, "details", c.id)).winners[0];
    expect(winner.prize_item).toBe("Feathery Hotel Coupon");
    expect(winner.quantity).toBe(3);
    expect(winner.percentage).toBeNull();
  });
  it("labels deadlines and finalized campaigns", () => {
    expect(
      campaignStatus({
        drawn_at: null,
        closes_at: new Date(0).toISOString(),
      } as Campaign),
    ).toBe("Awaiting draw");
    expect(campaignStatus({ drawn_at: "done" } as Campaign)).toBe("Drawn");
  });
});
