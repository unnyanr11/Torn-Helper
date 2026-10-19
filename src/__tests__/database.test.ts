import { PGlite } from "@electric-sql/pglite";
import { readFileSync, writeFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
const db = new PGlite();
const buyer = "00000000-0000-4000-8000-000000000001",
  seller = "00000000-0000-4000-8000-000000000002",
  other = "00000000-0000-4000-8000-000000000003";
let contract: string, claim: string;
async function asUser(id: string, sql: string, params: any[] = []) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`,
  );
  try {
    return await db.query<any>(sql, params);
  } finally {
    await db.exec("reset role");
  }
}
async function asService(sql: string, params: any[] = []) {
  await db.exec("set role service_role");
  try {
    return await db.query<any>(sql, params);
  } finally {
    await db.exec("reset role");
  }
}
beforeAll(async () => {
  const schema = JSON.parse(
    readFileSync("scripts/live-schema-audit.json", "utf8"),
  );
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema extensions;create schema vault;create schema cron;create schema net;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated,service_role,anon;grant execute on function auth.uid() to authenticated,service_role,anon;create table vault.secrets(id uuid default gen_random_uuid(),name text,decrypted_secret text);create view vault.decrypted_secrets as select * from vault.secrets;create function vault.create_secret(secret text,name text) returns uuid language sql as $$insert into vault.secrets(name,decrypted_secret) values(name,secret) returning id$$;create function extensions.gen_random_bytes(n integer) returns bytea language sql as $$select decode(repeat('ab',n),'hex')$$;create table cron.job(jobid bigint generated always as identity,jobname text,schedule text,command text);create function cron.unschedule(id bigint) returns boolean language plpgsql as $$begin delete from cron.job where jobid=id;return true;end$$;create function cron.schedule(name text,timing text,body text) returns bigint language sql as $$insert into cron.job(jobname,schedule,command) values(name,timing,body) returning jobid$$;create publication supabase_realtime;`,
  );
  await db.exec(
    "set search_path=public,extensions;create function auth.role() returns text language sql stable as $$select current_setting('role',true)$$;",
  );
  const tables = [...new Set<string>(schema.columns.map((c: any) => c.table))];
  for (const table of tables) {
    const cols = schema.columns
      .filter((c: any) => c.table === table)
      .map(
        (c: any) =>
          `"${c.column}" ${c.type}${c.default ? " default " + c.default : ""}${c.nullable === "NO" ? " not null" : ""}`,
      );
    await db.exec(`create table public."${table}"(${cols.join(",")})`);
  }
  for (const k of schema.constraints.filter(
    (c: any) => !c.definition.startsWith("FOREIGN KEY"),
  ))
    await db.exec(
      `alter table public."${k.table}" add constraint "${k.name}" ${k.definition}`,
    );
  for (const k of schema.constraints.filter((c: any) =>
    c.definition.startsWith("FOREIGN KEY"),
  ))
    await db.exec(
      `alter table public."${k.table}" add constraint "${k.name}" ${k.definition}`,
    );
  await db.exec(
    `create function public.touch_updated_at() returns trigger language plpgsql as $$begin return new;end$$;create function public.enforce_watch_limit() returns trigger language plpgsql as $$begin return new;end$$;create function public.handle_new_user() returns trigger language plpgsql as $$begin return new;end$$;grant all on all tables in schema public to anon,authenticated,service_role;`,
  );
  for (const table of tables)
    await db.exec(`alter table public."${table}" enable row level security`);
  for (const policy of schema.policies) {
    await db.exec(
      `create policy "${policy.policyname}" on public."${policy.tablename}" for ${policy.cmd} to ${policy.roles.join(",")}${policy.qual ? " using (" + policy.qual + ")" : ""}${policy.with_check ? " with check (" + policy.with_check + ")" : ""}`,
    );
  }
  await db.exec(
    readFileSync(
      "supabase/migrations/20261019053830_repair_runtime_security_and_marketplaces.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261019062308_saved_workspaces_and_mortgage_ledger.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261019063040_opt_in_personal_history.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261019081004_production_integration_safeguards.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261019153325_torn_key_authentication.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261019161634_api_data_browser.sql",
      "utf8",
    ),
  );
  const candidate = await db.query(
    "select table_name as table,column_name as column,data_type as type from information_schema.columns where table_schema='public'",
  );
  writeFileSync(
    "scripts/candidate-schema.json",
    JSON.stringify({ columns: candidate.rows }),
  );
  for (const [id, torn] of [
    [buyer, 101],
    [seller, 102],
    [other, 103],
  ]) {
    await db.query("insert into auth.users(id) values($1)", [id]);
    await db.query("insert into public.profiles(id) values($1)", [id]);
    await db.query(
      "insert into public.linked_torn_accounts(user_id,torn_id,key_access_level) values($1,$2,'Limited Access')",
      [id, torn],
    );
  }
  const r = await asUser(
    buyer,
    "insert into public.loss_contracts(buyer_user_id,target_player_id,quantity,price_per_loss) values($1,999,2,100) returning id",
    [buyer],
  );
  contract = r.rows[0].id;
}, 60000);
afterAll(async () => {
  await db.close();
});
describe("actual PostgreSQL migration and access controls", () => {
  it("prevents profile role escalation", async () => {
    await expect(
      asUser(seller, "update profiles set role='admin' where id=$1", [seller]),
    ).rejects.toThrow(/permission denied/i);
  });
  it("prevents membership and identity self-authorization", async () => {
    await expect(
      asUser(
        seller,
        "update linked_torn_accounts set torn_id=777 where user_id=$1",
        [seller],
      ),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      asUser(
        seller,
        "insert into memberships(user_id,faction_id,role) values($1,gen_random_uuid(),'leader')",
        [seller],
      ),
    ).rejects.toThrow(/permission denied/i);
  });
  it("keeps ciphertext server-only while exposing key status", async () => {
    await db.query(
      "insert into encrypted_credentials(user_id,provider,encrypted_key) values($1,'torn','test-ciphertext')",
      [seller],
    );
    await expect(
      asUser(seller, "select encrypted_key from encrypted_credentials"),
    ).rejects.toThrow(/permission denied/i);
    const r = await asUser(
      seller,
      "select provider from encrypted_credentials",
    );
    expect(r.rows).toEqual([{ provider: "torn" }]);
  });
  it("reserves slots once and prevents oversubscription by a second seller", async () => {
    const r = await asUser(
      seller,
      "select (public.claim_loss_contract($1,2)).id",
      [contract],
    );
    claim = r.rows[0].id;
    await expect(
      asUser(other, "select public.claim_loss_contract($1,1)", [contract]),
    ).rejects.toThrow(/Insufficient/);
    await expect(
      asUser(seller, "select public.claim_loss_contract($1,1)", [contract]),
    ).rejects.toThrow(/one active/);
  });
  it("does not allow self-certified evidence or seller-edited earnings", async () => {
    await expect(
      asUser(
        seller,
        "insert into loss_attack_evidence(claim_id,attack_id,seller_torn_id,target_torn_id,attack_timestamp,outcome,verified) values($1,123,102,999,now(),'loss',true)",
        [claim],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(seller, "select record_loss_attack($1,123,102,999,now(),true)", [
        claim,
      ]),
    ).rejects.toThrow(/permission denied/);
  });
  it("accepts authorized delayed evidence by event time and deduplicates money", async () => {
    await db.query(
      "update loss_claims set claimed_at=now()-interval '10 minutes',expires_at=now()-interval '1 minute',reconcile_until=now()+interval '9 minutes' where id=$1",
      [claim],
    );
    const first = await asService(
      "select record_loss_attack($1,123,102,999,now()-interval '9 minutes',true) as ok",
      [claim],
    );
    expect(first.rows[0].ok).toBe(true);
    const duplicate = await asService(
      "select record_loss_attack($1,123,102,999,now()-interval '9 minutes',true) as ok",
      [claim],
    );
    expect(duplicate.rows[0].ok).toBe(false);
    const r = await db.query<any>(
      "select amount_owed from loss_settlement_entries where claim_id=$1",
      [claim],
    );
    expect(Number(r.rows[0].amount_owed)).toBe(100);
  });
  it("rejects wrong targets, wins and records outside the event window", async () => {
    for (const [target, loss, when] of [
      [998, true, "now()-interval '8 minutes'"],
      [999, false, "now()-interval '8 minutes'"],
      [999, true, "now()-interval '20 minutes'"],
    ]) {
      const r = await asService(
        `select record_loss_attack($1,124,102,$2,${when},$3) as ok`,
        [claim, target, loss],
      );
      expect(r.rows[0].ok).toBe(false);
    }
  });
  it("holds unused slots throughout reconciliation and preserves earned partials on cancellation", async () => {
    await asUser(buyer, "select set_loss_contract_status($1,'cancelled')", [
      contract,
    ]);
    const r = await db.query<any>(
      "select quantity_verified from loss_claims where id=$1",
      [claim],
    );
    expect(r.rows[0].quantity_verified).toBe(1);
    await expect(
      asUser(
        buyer,
        "select transition_loss_settlement(id,'approved') from loss_settlement_entries where claim_id=$1",
        [claim],
      ),
    ).rejects.toThrow(/reconciliation/);
  });
  it("isolates evidence and settlements from uninvolved users", async () => {
    expect(
      (await asUser(other, "select * from loss_attack_evidence")).rows,
    ).toHaveLength(0);
    expect(
      (await asUser(other, "select * from loss_settlement_entries")).rows,
    ).toHaveLength(0);
    await expect(
      asUser(seller, "update loss_settlement_entries set amount_paid=500"),
    ).rejects.toThrow(/permission denied/);
  });
  it("requires manual payment reference and seller receipt, with duplicate-payment protection", async () => {
    await db.query(
      "update loss_claims set status='completed',reconcile_until=now()-interval '1 minute' where id=$1",
      [claim],
    );
    const r = await db.query<any>(
      "select id from loss_settlement_entries where claim_id=$1",
      [claim],
    );
    const entry = r.rows[0].id;
    await expect(
      asUser(seller, "select transition_loss_settlement($1,'approved')", [
        entry,
      ]),
    ).rejects.toThrow(/Buyer or operator/);
    await asUser(buyer, "select transition_loss_settlement($1,'approved')", [
      entry,
    ]);
    await expect(
      asUser(buyer, "select transition_loss_settlement($1,'sent')", [entry]),
    ).rejects.toThrow(/Invalid/);
    await asUser(
      buyer,
      "select transition_loss_settlement($1,'sent','torn-ref-1')",
      [entry],
    );
    await expect(
      asUser(
        buyer,
        "select transition_loss_settlement($1,'sent','torn-ref-1')",
        [entry],
      ),
    ).rejects.toThrow(/Invalid/);
    await asUser(seller, "select transition_loss_settlement($1,'reconciled')", [
      entry,
    ]);
    expect(
      Number(
        (
          await db.query<any>(
            "select amount_paid from loss_settlement_entries where id=$1",
            [entry],
          )
        ).rows[0].amount_paid,
      ),
    ).toBe(100);
  });
});

describe("reservation and reconciliation regressions", () => {
  it("serializes two simultaneous claim requests for the final slot", async () => {
    const r = await asUser(
      buyer,
      "insert into loss_contracts(buyer_user_id,target_player_id,quantity,price_per_loss) values($1,998,1,100) returning id",
      [buyer],
    );
    const id = r.rows[0].id;
    const attempt = (user: string) =>
      db.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
          user,
        ]);
        await tx.exec("set local role authenticated");
        return tx.query("select claim_loss_contract($1,1)", [id]);
      });
    const results = await Promise.allSettled([attempt(seller), attempt(other)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    await db.query(
      "update loss_claims set status='expired',reconcile_until=now()-interval '1 minute' where contract_id=$1",
      [id],
    );
  });
  it("recomputes evidence when a late event bridges a five-minute gap, without exceeding quota", async () => {
    const c = await asUser(
      buyer,
      "insert into loss_contracts(buyer_user_id,target_player_id,quantity,price_per_loss) values($1,997,3,100) returning id",
      [buyer],
    );
    const r = await asUser(seller, "select (claim_loss_contract($1,3)).id", [
      c.rows[0].id,
    ]);
    const id = r.rows[0].id;
    await db.query(
      "update loss_claims set claimed_at=now()-interval '12 minutes' where id=$1",
      [id],
    );
    await asService(
      "select record_loss_attack($1,201,102,997,now()-interval '9 minutes',true)",
      [id],
    );
    const gap = await asService(
      "select record_loss_attack($1,203,102,997,now()-interval '3 minutes',true) as ok",
      [id],
    );
    expect(gap.rows[0].ok).toBe(false);
    const bridge = await asService(
      "select record_loss_attack($1,202,102,997,now()-interval '6 minutes',true) as ok",
      [id],
    );
    expect(bridge.rows[0].ok).toBe(true);
    const verified = await db.query<any>(
      "select quantity_verified from loss_claims where id=$1",
      [id],
    );
    expect(verified.rows[0].quantity_verified).toBe(3);
    await asService(
      "select record_loss_attack($1,204,102,997,now()-interval '2 minutes',true)",
      [id],
    );
    expect(
      Number(
        (
          await db.query<any>(
            "select amount_owed from loss_settlement_entries where claim_id=$1",
            [id],
          )
        ).rows[0].amount_owed,
      ),
    ).toBe(300);
    await expect(
      db.query("delete from profiles where id=$1", [seller]),
    ).rejects.toThrow(/Unsettled marketplace/);
    await db.query(
      "update loss_claims set reconcile_until=now()-interval '1 second' where id=$1",
      [id],
    );
    expect(
      (
        await asService(
          "select record_loss_attack($1,205,102,997,now(),true) as ok",
          [id],
        )
      ).rows[0].ok,
    ).toBe(false);
  });
  it("prevents counterfeit funding and disputes on unrelated claims", async () => {
    await expect(
      asUser(
        other,
        "insert into loss_funding_records(contract_id,buyer_user_id,amount,status) values($1,$2,100,'verified')",
        [contract, other],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(
        other,
        "insert into loss_disputes(claim_id,raised_by,reason) values($1,$2,'not my claim')",
        [claim, other],
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("claims revive slots atomically and identifies the seller from the linked account", async () => {
    const c = await asUser(
      buyer,
      "insert into revive_contracts(user_id,target_torn_id,quantity,price_per_revive) values($1,999,1,100) returning id",
      [buyer],
    );
    const result = await asUser(
      seller,
      "select (claim_revive_contract($1,1)).seller_torn_id as id",
      [c.rows[0].id],
    );
    expect(Number(result.rows[0].id)).toBe(102);
    await expect(
      asUser(other, "select claim_revive_contract($1,1)", [c.rows[0].id]),
    ).rejects.toThrow(/Insufficient/);
  });
});

describe("mortgage lifecycle and private workspace persistence", () => {
  let mortgage: string, payment: string;
  it("isolates saved presets by owner and rejects invalid documents", async () => {
    const p = await asUser(
      buyer,
      'insert into workspace_presets(kind,name,config) values(\'comparison\',\'My rivals\',\'{"version":1,"ids":"101,102","days":"30"}\') returning id',
    );
    expect(
      (
        await asUser(seller, "select * from workspace_presets where id=$1", [
          p.rows[0].id,
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await asUser(
          seller,
          "update workspace_presets set config='{}' where id=$1 returning id",
          [p.rows[0].id],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      asUser(
        buyer,
        "insert into workspace_presets(kind,name,config) values('roi','bad','[]')",
      ),
    ).rejects.toThrow(/check constraint/);
    await expect(
      asUser(
        seller,
        "insert into workspace_presets(user_id,kind,name,config) values($1,'roi','stolen','{}')",
        [buyer],
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("creates an application through RPC with immutable terms and audit", async () => {
    const r = await asUser(
      buyer,
      "select apply_mortgage('Borrower',456,1200,0,3,'2024-01-31','Reviewed personal ledger') as id",
    );
    mortgage = r.rows[0].id;
    expect(
      (
        await asUser(
          buyer,
          "select status from mortgage_agreements where id=$1",
          [mortgage],
        )
      ).rows[0].status,
    ).toBe("application");
    await expect(
      asUser(buyer, "update mortgage_agreements set principal=1 where id=$1", [
        mortgage,
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(seller, "select decide_mortgage($1,'active')", [mortgage]),
    ).rejects.toThrow(/unavailable/);
    expect(
      (
        await asUser(seller, "select * from mortgage_agreements where id=$1", [
          mortgage,
        ])
      ).rows,
    ).toHaveLength(0);
  });
  it("freezes a whole-dollar schedule and prevents activation twice", async () => {
    await asUser(buyer, "select decide_mortgage($1,'active')", [mortgage]);
    const s = await asUser(
      buyer,
      "select installment_number,due_date::text,principal,interest,balance from mortgage_installments where agreement_id=$1 order by installment_number",
      [mortgage],
    );
    expect(s.rows.map((r) => r.due_date)).toEqual([
      "2024-01-31",
      "2024-02-29",
      "2024-03-31",
    ]);
    expect(s.rows.map((r) => Number(r.principal))).toEqual([400, 400, 400]);
    expect(Number(s.rows[2].balance)).toBe(0);
    await expect(
      asUser(buyer, "select decide_mortgage($1,'active')", [mortgage]),
    ).rejects.toThrow(/Only applications/);
    await expect(
      asUser(
        buyer,
        "update mortgage_installments set paid=amount where agreement_id=$1",
        [mortgage],
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("allocates partial payments oldest first and rejects duplicates, overpayment and forgery", async () => {
    const r = await asUser(
      buyer,
      "select record_mortgage_payment($1,500,'2024-02-01','receipt-1') as id",
      [mortgage],
    );
    payment = r.rows[0].id;
    const s = await asUser(
      buyer,
      "select paid from mortgage_installments where agreement_id=$1 order by installment_number",
      [mortgage],
    );
    expect(s.rows.map((r) => Number(r.paid))).toEqual([400, 100, 0]);
    await expect(
      asUser(
        buyer,
        "select record_mortgage_payment($1,500,'2024-02-01','receipt-1')",
        [mortgage],
      ),
    ).rejects.toThrow(/unique constraint/);
    await expect(
      asUser(
        buyer,
        "select record_mortgage_payment($1,701,'2024-02-01','overpaid')",
        [mortgage],
      ),
    ).rejects.toThrow(/exceeds outstanding/);
    await expect(
      asUser(
        seller,
        "select record_mortgage_payment($1,1,'2024-02-01','forged')",
        [mortgage],
      ),
    ).rejects.toThrow(/unavailable/);
    expect(
      (
        await asUser(
          seller,
          "select * from mortgage_payment_allocations where payment_id=$1",
          [payment],
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("retains corrections, reopens settled agreements and never deletes audit evidence", async () => {
    await asUser(
      buyer,
      "select record_mortgage_payment($1,700,'2024-03-01','receipt-final')",
      [mortgage],
    );
    expect(
      (
        await asUser(
          buyer,
          "select status from mortgage_agreements where id=$1",
          [mortgage],
        )
      ).rows[0].status,
    ).toBe("settled");
    await expect(
      asUser(seller, "select void_mortgage_payment($1,'malicious')", [payment]),
    ).rejects.toThrow(/unavailable/);
    await asUser(
      buyer,
      "select void_mortgage_payment($1,'Incorrect receipt')",
      [payment],
    );
    expect(
      (
        await asUser(
          buyer,
          "select status from mortgage_agreements where id=$1",
          [mortgage],
        )
      ).rows[0].status,
    ).toBe("active");
    expect(
      Number(
        (
          await asUser(
            buyer,
            "select sum(amount-paid) as outstanding from mortgage_installments where agreement_id=$1",
            [mortgage],
          )
        ).rows[0].outstanding,
      ),
    ).toBe(500);
    await expect(
      asUser(buyer, "select void_mortgage_payment($1,'again')", [payment]),
    ).rejects.toThrow(/current payment/);
    await expect(
      asUser(buyer, "delete from mortgage_events where agreement_id=$1", [
        mortgage,
      ]),
    ).rejects.toThrow(/permission denied/);
    expect(
      (
        await asUser(
          buyer,
          "select action from mortgage_events where agreement_id=$1",
          [mortgage],
        )
      ).rows,
    ).toHaveLength(5);
  });
  it("matches the client amortization preview on interest and monthly rounding", async () => {
    const { amortize } = await import("../lib/finance");
    for (const terms of [
      {
        principal: 1000000,
        annualBps: 525,
        months: 36,
        firstDue: "2026-01-31",
      },
      { principal: 1, annualBps: 0, months: 600, firstDue: "2026-01-31" },
      {
        principal: 1000000000000,
        annualBps: 10000,
        months: 600,
        firstDue: "2026-01-31",
      },
    ]) {
      const r = await asUser(
        buyer,
        "select apply_mortgage('Schedule parity',null,$1,$2,$3,$4,'') as id",
        [terms.principal, terms.annualBps, terms.months, terms.firstDue],
      );
      const id = r.rows[0].id;
      await asUser(buyer, "select decide_mortgage($1,'active')", [id]);
      const s = await asUser(
        buyer,
        "select installment_number,due_date::text,principal,interest,amount,balance from mortgage_installments where agreement_id=$1 order by installment_number",
        [id],
      );
      expect(
        s.rows.map((r) => ({
          number: r.installment_number,
          due: r.due_date,
          principal: Number(r.principal),
          interest: Number(r.interest),
          amount: Number(r.amount),
          balance: Number(r.balance),
        })),
      ).toEqual(amortize(terms));
    }
  });
});

describe("opt-in numeric personal history", () => {
  it("does not collect before opt-in and rejects browser writes or forged snapshots", async () => {
    const values = {
      "battlestats.strength": 100,
      "personalstats.attacks.total": 4,
    };
    const r = await asService(
      "select record_personal_snapshot($1,now(),$2) as recorded",
      [other, JSON.stringify(values)],
    );
    expect(r.rows[0].recorded).toBe(false);
    await expect(
      asUser(other, "select record_personal_snapshot($1,now(),$2)", [
        other,
        JSON.stringify(values),
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(
        other,
        "insert into personal_stat_snapshots(user_id,stat_values) values($1,$2)",
        [other, JSON.stringify(values)],
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("allows explicit preference and stores only owner-readable immutable observations", async () => {
    await asUser(
      other,
      "update profiles set history_enabled=true where id=$1",
      [other],
    );
    const r = await asService(
      "select record_personal_snapshot($1,now(),$2) as recorded",
      [other, JSON.stringify({ "battlestats.strength": 100 })],
    );
    expect(r.rows[0].recorded).toBe(true);
    expect(
      (
        await asUser(
          buyer,
          "select * from personal_stat_snapshots where user_id=$1",
          [other],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (await asUser(other, "select * from personal_stat_snapshots")).rows,
    ).toHaveLength(1);
    await expect(
      asUser(other, "delete from personal_stat_snapshots"),
    ).rejects.toThrow(/permission denied/);
    const duplicate = await asService(
      "select record_personal_snapshot($1,now(),$2) as recorded",
      [other, JSON.stringify({ "battlestats.strength": 101 })],
    );
    expect(duplicate.rows[0].recorded).toBe(false);
  });
  it("respects pause and rejects credential or malformed payloads and backdated data", async () => {
    await asUser(
      other,
      "update profiles set tracking_paused=true where id=$1",
      [other],
    );
    const r = await asService(
      "select record_personal_snapshot($1,now(),$2) as recorded",
      [other, '{"battlestats.strength":102}'],
    );
    expect(r.rows[0].recorded).toBe(false);
    await asUser(
      other,
      "update profiles set tracking_paused=false where id=$1",
      [other],
    );
    for (const values of [
      '{"secret":1}',
      '{"battlestats.strength":"unknown"}',
      "[]",
    ])
      await expect(
        asService("select record_personal_snapshot($1,now(),$2)", [
          other,
          values,
        ]),
      ).rejects.toThrow(/numeric|Invalid/);
    await expect(
      asService(
        "select record_personal_snapshot($1,now()-interval '1 day','{\"battlestats.strength\":1}')",
        [other],
      ),
    ).rejects.toThrow(/Invalid observation time/);
  });
});

describe("unavailable integrations cannot collect client-side secrets", () => {
  it("blocks token retrieval and forged connected status while retaining scoped metadata/deletion", async () => {
    const r = await db.query<{ id: string }>(
      "insert into integration_connections(user_id,provider,token_encrypted,status) values($1,'tornstats','legacy-test-secret','connected') returning id",
      [buyer],
    );
    const id = r.rows[0].id;
    await expect(
      asUser(buyer, "select token_encrypted from integration_connections"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(
        buyer,
        "insert into integration_connections(user_id,provider,token_encrypted,status) values($1,'tornstats','plaintext','connected')",
        [buyer],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(
        buyer,
        "update integration_connections set status='connected' where id=$1",
        [id],
      ),
    ).rejects.toThrow(/permission denied/);
    expect(
      (
        await asUser(
          seller,
          "select id from integration_connections where id=$1",
          [id],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await asUser(
          seller,
          "delete from integration_connections where id=$1 returning id",
          [id],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await asUser(
          buyer,
          "delete from integration_connections where id=$1 returning id",
          [id],
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("blocks direct webhook secret reads/writes and inactive channel opt-ins", async () => {
    await expect(
      asUser(buyer, "select webhook_url from discord_webhooks"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(
        buyer,
        "insert into discord_webhooks(user_id,webhook_url) values($1,'https://discord.com/api/webhooks/test')",
        [buyer],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(
        buyer,
        "insert into notification_preferences(user_id,email_enabled) values($1,true)",
        [buyer],
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("server-only Torn authentication mapping and abuse limits", () => {
  it("does not let anonymous or signed-in browsers mint accounts or bypass login limits", async () => {
    await expect(
      asUser(
        buyer,
        "select complete_torn_login(123,$1,'Forged','Limited Access',false,null)",
        [buyer],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(buyer, "select consume_torn_login_budget($1,$2)", [
        "a".repeat(64),
        "b".repeat(64),
      ]),
    ).rejects.toThrow(/permission denied/);
  });
  it("reuses the unique verified identity and atomically updates optional credential retention", async () => {
    const r = await asService(
      "select complete_torn_login(101,$1,'Verified buyer','Limited Access',true,'test-iv:authenticated-ciphertext') as id",
      [seller],
    );
    expect(r.rows[0].id).toBe(buyer);
    const credential = await asService(
      "select encrypted_key from encrypted_credentials where user_id=$1 and provider='torn'",
      [buyer],
    );
    expect(credential.rows).toHaveLength(1);
    await asService(
      "select complete_torn_login(101,$1,'Verified buyer','Limited Access',false,null)",
      [seller],
    );
    expect(
      (
        await asService(
          "select * from encrypted_credentials where user_id=$1 and provider='torn'",
          [buyer],
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("uses the first committed mapping when two first-login proposals arrive", async () => {
    const first = "00000000-0000-4000-8000-000000000004",
      second = "00000000-0000-4000-8000-000000000005";
    for (const id of [first, second]) {
      await db.query("insert into auth.users(id) values($1)", [id]);
      await db.query("insert into profiles(id) values($1)", [id]);
    }
    for (const id of [first, second])
      expect(
        (
          await asService(
            "select complete_torn_login(90001,$1,'New player','Minimal Access',false,null) as id",
            [id],
          )
        ).rows[0].id,
      ).toBe(first);
    expect(
      Number(
        (
          await asService(
            "select count(*) as n from linked_torn_accounts where torn_id=90001",
          )
        ).rows[0].n,
      ),
    ).toBe(1);
  });
  it("enforces a per-key sign-in budget without retaining raw keys", async () => {
    for (let i = 0; i < 5; i++)
      expect(
        (
          await asService(
            "select consume_torn_login_budget($1,$2) as allowed",
            ["a".repeat(64), "b".repeat(64)],
          )
        ).rows[0].allowed,
      ).toBe(true);
    expect(
      (
        await asService("select consume_torn_login_budget($1,$2) as allowed", [
          "a".repeat(64),
          "b".repeat(64),
        ])
      ).rows[0].allowed,
    ).toBe(false);
  });
});

describe("all-section Torn observations", () => {
  it("keeps cached private observations isolated between accounts", async () => {
    await asService(
      "select public.store_torn_data($1,$2,'v2-user-money','{}','{\"money\":5}')",
      [buyer, "a".repeat(64)],
    );
    expect(
      (await asUser(buyer, "select * from public.torn_data_cache")).rows,
    ).toHaveLength(1);
    expect(
      (await asUser(seller, "select * from public.torn_data_cache")).rows,
    ).toHaveLength(0);
    expect(
      (await asUser(seller, "delete from public.torn_data_cache returning *"))
        .rows,
    ).toHaveLength(0);
  });
  it("does not allow browsers to forge observations or bypass the budget", async () => {
    await expect(
      asUser(
        buyer,
        "insert into public.torn_data_cache(user_id,request_hash,endpoint_id,payload) values($1,$2,'fake','{}')",
        [buyer, "b".repeat(64)],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(buyer, "select public.consume_torn_data_budget($1,1)", [buyer]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(buyer, "select public.store_torn_data($1,$2,'fake','{}','{}')", [
        buyer,
        "b".repeat(64),
      ]),
    ).rejects.toThrow(/permission denied/);
  });
  it("counts request-only identity checks in the per-user request budget", async () => {
    for (let n = 0; n < 20; n++)
      expect(
        (
          await asService(
            "select public.consume_torn_data_budget($1,3) allowed",
            [seller],
          )
        ).rows[0].allowed,
      ).toBe(true);
    expect(
      (
        await asService(
          "select public.consume_torn_data_budget($1,3) allowed",
          [seller],
        )
      ).rows[0].allowed,
    ).toBe(false);
  });
  it("bounds retained observations and allows owners to clear them", async () => {
    await asService(
      "insert into public.torn_data_cache(user_id,request_hash,endpoint_id,payload) select $1,lpad(n::text,64,'0'),'v2-user-money','{}'::jsonb from generate_series(1,101) n",
      [other],
    );
    await asService(
      "select public.store_torn_data($1,$2,'v2-user-money','{}','{}')",
      [other, "c".repeat(64)],
    );
    expect(
      (await asUser(other, "select * from public.torn_data_cache")).rows,
    ).toHaveLength(100);
    expect(
      (await asUser(other, "delete from public.torn_data_cache returning *"))
        .rows,
    ).toHaveLength(100);
  });
});
