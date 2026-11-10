import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useItemCatalogue } from "../hooks/useItemCatalogue";
import {
  campaignStatus,
  prizePreview,
  type Campaign,
  type DrawDetails,
  type Prize,
} from "../lib/lucky-draw";
import "./lucky-draws.css";
import {
  DRAW_AUDIENCES,
  DRAW_ASSETS,
  PRIZE_SPLITS,
  splitPrizes,
  audienceLabel,
  type DrawAudience,
} from "../lib/lucky-draw-presets";
import { invokeTornData } from "../lib/torn-data-client";
import { functionError } from "../lib/function-error";
import ReceivedTransfers from "../components/ReceivedTransfers";
import type { QueryClient } from "@tanstack/react-query";
async function refreshEligibility(client: QueryClient, audience: DrawAudience) {
  if (audience === "all") return;
  const r = await invokeTornData(client, {
    body: {
      endpoint_id:
        audience === "new_players" ? "v2-user-profile" : "v2-user-faction",
      parameters: {},
    },
  });
  if (r.error || r.data?.error)
    throw await functionError(
      r.data,
      r.error,
      "Unable to verify campaign eligibility.",
    );
}

async function action(
  name: string,
  campaign: string | null = null,
  payload: Record<string, unknown> = {},
) {
  const r = await supabase.rpc("lucky_draw_action", {
    action: name,
    campaign,
    payload,
  });
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="draw-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
const dateLabel = (s: string) => new Date(s).toLocaleString();
function selectedCampaign() {
  const value = new URLSearchParams(location.hash.split("?")[1] ?? "").get(
    "campaign",
  );
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : "";
}
export default function LuckyDraws() {
  const cache = useQueryClient();
  const [selected, setSelected] = useState(selectedCampaign),
    [creating, setCreating] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const catalogue = useItemCatalogue();
  const campaigns = useQuery<Campaign[]>({
    queryKey: ["lucky-draws"],
    queryFn: async () => {
      const r = await supabase
        .from("lucky_draw_campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });
  const details = useQuery<DrawDetails>({
    queryKey: ["lucky-draw", selected],
    enabled: !!selected,
    queryFn: () => action("details", selected),
  });
  const me = useQuery({
    queryKey: ["draw-viewer"],
    queryFn: async () => {
      const r = await supabase.auth.getUser();
      if (r.error) throw r.error;
      return r.data.user?.id;
    },
  });
  useEffect(() => {
    const changed = () => setSelected(selectedCampaign());
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  function open(id: string) {
    setSelected(id);
    setCreating(false);
    setError("");
    setNotice("");
    location.hash = `Lucky%20Draws?campaign=${id}`;
  }
  async function run(task: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["lucky-draws"] }),
        cache.invalidateQueries({ queryKey: ["lucky-draw"] }),
      ]);
      setNotice(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="draw-page">
      <div className="draw-heading">
        <div>
          <h2>Lucky Draws</h2>
          <p className="muted">
            Host a campaign, collect eligible entries and draw your winners.
          </p>
        </div>
        <button
          className="nu-btn"
          onClick={() => {
            setCreating(!creating);
            setError("");
            setNotice("");
          }}
        >
          {creating ? "Close campaign form" : "Create campaign"}
        </button>
      </div>
      <p className="draw-disclosure">
        Send items or cash directly in Torn. Campaign tokens identify received
        transfers for automatic entry detection. Prizes are sent manually; Torn
        Helper does not move assets or hold the pool.
      </p>
      {error && (
        <p role="alert" className="badge warn">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <datalist id="draw-item-options">
        {catalogue.data?.items.map((i) => (
          <option key={i.id} value={i.name} />
        ))}
      </datalist>
      {creating && (
        <CampaignForm
          busy={busy}
          onSave={(payload) =>
            run(async () => {
              if (payload.audience === "faction")
                await refreshEligibility(cache, "faction");
              const c = await action("create", null, payload);
              open(c.id);
            }, "Campaign published. Its terms are now locked.")
          }
        />
      )}
      <div className="draw-columns">
        <div>
          <h3>Campaigns</h3>
          {campaigns.isPending && <p role="status">Loading campaigns…</p>}
          {campaigns.error && (
            <p role="alert">
              Campaigns are unavailable. {campaigns.error.message}
              <button
                className="nu-btn"
                onClick={() => void campaigns.refetch()}
              >
                Retry
              </button>
            </p>
          )}
          {campaigns.data?.length === 0 && (
            <p>No campaigns yet. Create the first one.</p>
          )}
          {campaigns.data?.map((c) => (
            <button
              key={c.id}
              className={`card draw-campaign ${selected === c.id ? "draw-selected" : ""}`}
              onClick={() => open(c.id)}
              aria-pressed={selected === c.id}
            >
              <span className="badge">{campaignStatus(c)}</span>
              <strong>{c.title}</strong>
              <span>
                {c.quantity_per_ticket} × {c.entry_item} per ticket
              </span>
              <small>
                {c.prizes.length} prizes · Closes {dateLabel(c.closes_at)}
              </small>
              <small>
                Hosted by {c.host_name} [{c.host_torn_id}]
                {c.host_user_id === me.data ? " · You" : ""}
              </small>
            </button>
          ))}
          <small className="muted">
            Showing the latest 100 campaigns. Shared campaign links open older
            campaigns directly.
          </small>
        </div>
        <div aria-live="polite">
          {!selected && (
            <article className="card">
              <h3>Choose a campaign</h3>
              <p>
                See the entry rules, submit transfer evidence or manage your own
                draw.
              </p>
            </article>
          )}
          {selected && details.isPending && (
            <p role="status">Loading campaign…</p>
          )}
          {selected && details.error && (
            <p role="alert">
              {details.error.message}
              <button className="nu-btn" onClick={() => void details.refetch()}>
                Retry
              </button>
            </p>
          )}
          {selected && details.data && (
            <CampaignDetail
              key={selected}
              data={details.data}
              viewer={me.data}
              busy={busy}
              run={run}
            />
          )}
        </div>
      </div>
    </section>
  );
}
export function CampaignForm({
  busy,
  onSave,
}: {
  busy: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [audience, setAudience] = useState<DrawAudience>("all");
  const recommended = DRAW_AUDIENCES.find((a) => a.id === audience)!;
  const [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [item, setItem] = useState("Xanax"),
    [quantity, setQuantity] = useState("1"),
    [cap, setCap] = useState("1"),
    [days, setDays] = useState("7");
  const [mode, setMode] = useState<"pool" | "fixed">("pool"),
    [prizes, setPrizes] = useState<Prize[]>(() => splitPrizes("tiered")),
    [previewPool, setPreviewPool] = useState("100"),
    [review, setReview] = useState(false),
    [localError, setLocalError] = useState("");
  const preview = prizePreview(Number(previewPool) || 0, prizes);
  function update(index: number, patch: Prize) {
    setReview(false);
    setPrizes(prizes.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }
  function check(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError("");
    if (mode === "pool" && preview.percentage > 100) {
      setLocalError("Prize percentages cannot exceed 100%.");
      return;
    }
    setReview(true);
  }
  return (
    <article className="card">
      <h3>Create a lucky draw</h3>
      <form onSubmit={check} onChange={() => setReview(false)}>
        <Field label="Who can enter?">
          <select
            value={audience}
            onChange={(e) => {
              setAudience(e.target.value as DrawAudience);
              setReview(false);
            }}
          >
            {DRAW_AUDIENCES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>
        <p className="muted">
          {recommended.description} Restricted campaigns verify eligibility from
          official Torn data before accepting an entry. Send items only after
          checking that you qualify.
        </p>
        <div className="draw-preview">
          <h4>Prize ideas for {recommended.label}</h4>
          <p>
            Use an idea for a fixed prize, then choose its quantity. Specific
            weapon bonuses and armor quality should be described in your
            campaign rules.
          </p>
          <div className="draw-actions">
            {recommended.items.map((name) => (
              <button
                className="nu-btn"
                type="button"
                key={name}
                onClick={() => {
                  setMode("fixed");
                  setPrizes([
                    { item: name, quantity: name === "Points" ? 50 : 1 },
                  ]);
                  setReview(false);
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
        <div className="draw-form-grid">
          <Field label="Campaign title">
            <input
              required
              minLength={3}
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="Entry item or cash">
            <select
              required
              value={item}
              onChange={(e) => setItem(e.target.value)}
            >
              {DRAW_ASSETS.map((name) => (
                <option key={name} value={name}>
                  {name === "Cash" ? "Cash (Torn dollars)" : name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={item === "Cash" ? "Cash per entry ($)" : "Items per entry"}
          >
            <input
              required
              type="number"
              min="1"
              max="1000000000000"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </Field>
          <Field label="Maximum tickets per player">
            <input
              required
              type="number"
              min="1"
              max="10000"
              step="1"
              value={cap}
              onChange={(e) => setCap(e.target.value)}
            />
          </Field>
          <Field label="Open for this many days">
            <input
              required
              type="number"
              min="1"
              max="365"
              step="1"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </Field>
          <Field label="Prize type">
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as "pool" | "fixed");
                setPrizes(
                  e.target.value === "pool"
                    ? splitPrizes("tiered")
                    : [{ item: "Xanax", quantity: 1 }],
                );
              }}
            >
              <option value="pool">Percentage of collected entry items</option>
              <option value="fixed">Fixed item prizes supplied by host</option>
            </select>
          </Field>
        </div>
        <p className="muted">
          Cash means in-game Torn dollars. Percentage prizes use the entry
          asset; choose fixed prizes to give a different item or cash.{" "}
          {item === "Points"
            ? "Points transfers use manual evidence review; automatic receive-log verification currently supports cash and sendable items."
            : "A unique message token will be generated when you publish. Senders include it in the Torn transfer message for automatic entry detection."}
        </p>
        <Field label="Campaign description and extra rules">
          <textarea
            maxLength={4000}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        {mode === "pool" && (
          <div className="draw-preview">
            <h4>75% prize pool presets</h4>
            <div className="draw-actions">
              {PRIZE_SPLITS.map((split) => (
                <button
                  className="nu-btn"
                  type="button"
                  key={split.id}
                  onClick={() => {
                    setPrizes(splitPrizes(split.id));
                    setReview(false);
                  }}
                >
                  {split.label}
                </button>
              ))}
            </div>
            <p>
              Percentages are of all approved entry items. Both presets allocate
              75% to prizes and leave 25% with the host, plus whole-item
              rounding. You can edit every tier below.
            </p>
          </div>
        )}
        <h4>Prizes · {prizes.length} winners</h4>
        {prizes.map((p, i) => (
          <div key={i} className="draw-prize-row">
            <strong>#{i + 1}</strong>
            {mode === "pool" ? (
              <Field label="Pool share (%)">
                <input
                  required
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={p.percentage ?? ""}
                  onChange={(e) =>
                    update(i, { percentage: Number(e.target.value) })
                  }
                />
              </Field>
            ) : (
              <>
                <Field label="Prize item">
                  <select
                    required
                    value={p.item ?? ""}
                    onChange={(e) => update(i, { item: e.target.value })}
                  >
                    <option value="" disabled>
                      Choose prize asset…
                    </option>
                    {DRAW_ASSETS.map((name) => (
                      <option key={name} value={name}>
                        {name === "Cash" ? "Cash (Torn dollars)" : name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Prize quantity">
                  <input
                    required
                    type="number"
                    min="1"
                    max="1000000000000"
                    step="1"
                    value={p.quantity ?? ""}
                    onChange={(e) =>
                      update(i, { quantity: Number(e.target.value) })
                    }
                  />
                </Field>
              </>
            )}
            <button
              type="button"
              className="nu-btn"
              disabled={prizes.length === 1}
              aria-label={`Remove prize ${i + 1}`}
              onClick={() => {
                setReview(false);
                setPrizes(prizes.filter((_, n) => n !== i));
              }}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="nu-btn"
          disabled={prizes.length >= 50}
          onClick={() => {
            setReview(false);
            setPrizes([
              ...prizes,
              mode === "pool" ? { percentage: 1 } : { item, quantity: 1 },
            ]);
          }}
        >
          Add prize
        </button>
        {mode === "pool" && (
          <div className="draw-preview">
            <Field label="Preview total collected items (illustration only)">
              <input
                type="number"
                min="0"
                max="10000000000"
                step="1"
                value={previewPool}
                onChange={(e) => setPreviewPool(e.target.value)}
              />
            </Field>
            <p>
              {prizes
                .map(
                  (p, i) =>
                    `#${i + 1}: ${preview.quantities[i]} ${item} (${p.percentage}%)`,
                )
                .join(" · ")}
            </p>
            <p>
              Total prize share: {preview.percentage}%. Host remainder:{" "}
              {100 - preview.percentage}% plus whole-item rounding. For this
              preview: {preview.remainder} {item}.
            </p>
          </div>
        )}
        <p className="muted">
          One player can win once. More tickets increase their chances. All
          pending entries must be reviewed and there must be at least{" "}
          {prizes.length} eligible players before the host can draw after
          closing. Percentage prizes round down to whole items; small pools can
          produce a zero-item prize. Rejected transfers must be resolved
          manually by the host.
        </p>
        {localError && <p role="alert">{localError}</p>}
        <button className="nu-btn" type="submit" disabled={busy}>
          Review campaign
        </button>
        {review && (
          <div className="draw-preview">
            <h4>Ready to publish “{title}”?</h4>
            <p>
              Entry: {quantity} {item} per ticket · Up to {cap} tickets per
              player · Open for {days} days from publication.
            </p>
            <p>
              Audience: {audienceLabel(audience)}.{" "}
              {audience === "faction"
                ? "Your current verified faction will be locked at publication."
                : ""}
            </p>
            <p>
              The prize rules, ticket limits and deadline lock immediately.
              Fixed prizes are the host’s responsibility. Winners and the draw
              cannot be edited or rerolled.
            </p>
            <button
              type="button"
              className="nu-btn"
              disabled={busy}
              onClick={() =>
                void onSave({
                  title,
                  description,
                  audience,
                  entry_verification: item === "Points" ? "manual" : "token",
                  entry_item: item,
                  quantity_per_ticket: Number(quantity),
                  max_tickets_per_player: Number(cap),
                  prize_mode: mode,
                  prizes,
                  closes_at: new Date(
                    Date.now() + Number(days) * 86400000,
                  ).toISOString(),
                })
              }
            >
              {busy ? "Publishing…" : "Publish campaign"}
            </button>
          </div>
        )}
      </form>
    </article>
  );
}
function CampaignDetail({
  data,
  viewer,
  busy,
  run,
}: {
  data: DrawDetails;
  viewer: string | undefined;
  busy: boolean;
  run: (task: () => Promise<unknown>, message: string) => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const c = data.campaign,
    [quantity, setQuantity] = useState(String(c.quantity_per_ticket)),
    [reference, setReference] = useState(""),
    [evidence, setEvidence] = useState(""),
    [reviewNotes, setReviewNotes] = useState<Record<string, string>>({}),
    [paymentRefs, setPaymentRefs] = useState<Record<number, string>>({}),
    [confirmDraw, setConfirmDraw] = useState(false),
    [cancelNote, setCancelNote] = useState(""),
    [refundRefs, setRefundRefs] = useState<Record<string, string>>({});
  const status = campaignStatus(c),
    preview = prizePreview(data.pool_quantity, c.prizes);
  const used = data.submissions
    .filter((s) => s.status !== "rejected" && s.torn_id === data.viewer_torn_id)
    .reduce((sum, s) => sum + s.tickets, 0);
  const drawReady =
    status === "Awaiting draw" &&
    data.pending_count === 0 &&
    data.eligible_players >= c.prizes.length;
  return (
    <article className="card">
      <div className="draw-heading">
        <h3>{c.title}</h3>
        <span className="badge">{status}</span>
      </div>
      <p style={{ whiteSpace: "pre-wrap" }}>{c.description}</p>
      <p>
        <strong>{audienceLabel(c.audience)}</strong>
        {c.audience === "faction" ? ` · Faction ID ${c.faction_id}` : ""}.
        Eligibility is checked at submission; existing accepted entries keep
        their eligibility snapshot.
      </p>
      <p>
        Host:{" "}
        <a
          href={`https://www.torn.com/profiles.php?XID=${c.host_torn_id}`}
          target="_blank"
          rel="noreferrer"
        >
          {c.host_name} [{c.host_torn_id}]
        </a>
      </p>
      <button
        className="nu-btn"
        disabled={busy}
        onClick={() =>
          void run(() => action("details", c.id), "Campaign refreshed.")
        }
      >
        Refresh campaign
      </button>
      {c.cancelled_at && (
        <p role="status">
          Cancelled: {c.cancellation_reason}. The host must return received
          items directly in Torn.
        </p>
      )}
      <p>
        Closes {dateLabel(c.closes_at)} · Times shown in your local timezone.
      </p>
      <p>
        <strong>
          {c.quantity_per_ticket} {c.entry_item} per ticket
        </strong>{" "}
        · Maximum {c.max_tickets_per_player} tickets per player. Send only the
        stated item, in whole ticket quantities.
      </p>
      <Field label="Share campaign link (sign-in required)">
        <input
          readOnly
          value={`${location.origin}${location.pathname}#Lucky%20Draws?campaign=${c.id}`}
          onFocus={(e) => e.target.select()}
        />
      </Field>
      <div className="draw-preview">
        <p>
          <strong>
            {data.pool_quantity} {c.entry_item}
          </strong>{" "}
          approved · {data.eligible_players} eligible players ·{" "}
          {data.pending_count} pending submissions
        </p>
        <ol>
          {c.prizes.map((p, i) => (
            <li key={i}>
              {c.prize_mode === "pool"
                ? `${p.percentage}% of pool · currently ${preview.quantities[i]} ${c.entry_item}`
                : `${p.quantity} ${p.item} supplied by host`}
            </li>
          ))}
        </ol>
        {c.prize_mode === "pool" && (
          <p>
            Host remainder: {100 - preview.percentage}% plus rounding ·
            currently {preview.remainder} {c.entry_item}. Prizes round down;
            small pools can result in zero-item prizes.
          </p>
        )}
        <p>
          Each ticket contributes equal weight. Winners are distinct players.
          Entries are manually approved by the host, not automatically verified
          by Torn.
        </p>
      </div>
      <ReceivedTransfers campaign={c} isHost={data.is_host} sync={data.sync} />
      {c.entry_verification === "token" && !data.is_host && (
        <div className="draw-preview">
          <p>
            Send the required asset directly to the host with this campaign
            token in the transfer message. The host’s received logs verify the
            amount and create your entries; no manual submission is needed.
          </p>
          <button
            className="nu-btn"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await refreshEligibility(queryClient, c.audience ?? "all");
                await action("claim_received", c.id);
              }, "Your detected transfers were checked for eligibility.")
            }
          >
            Verify eligibility for my received transfers
          </button>
        </div>
      )}
      {!data.is_host &&
        c.entry_verification !== "token" &&
        status === "Open" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await refreshEligibility(queryClient, c.audience ?? "all");
                await action("submit", c.id, {
                  quantity: Number(quantity),
                  transfer_reference: reference,
                  evidence,
                });
                setReference("");
                setEvidence("");
              }, "Entry submitted for host review.");
            }}
          >
            <h4>Submit your transfer</h4>
            <button
              type="button"
              className="nu-btn"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await refreshEligibility(queryClient, c.audience ?? "all");
                  await action("eligibility", c.id);
                }, "You qualify for this campaign now. You can send the stated items to the host in Torn, then submit your transfer evidence.")
              }
            >
              Check eligibility before sending items
            </button>
            <p>
              {used} of {c.max_tickets_per_player} tickets used or pending. Send
              items to the host in Torn first, then provide the reference and
              evidence.
            </p>
            <Field label={`Quantity of ${c.entry_item} sent`}>
              <input
                type="number"
                required
                min={c.quantity_per_ticket}
                max={1000000}
                step={c.quantity_per_ticket}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </Field>
            <Field label="Unique Torn transfer/log reference">
              <input
                required
                minLength={3}
                maxLength={200}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </Field>
            <Field label="Transfer evidence (paste the event text, including item, quantity and time)">
              <textarea
                required
                minLength={5}
                maxLength={2000}
                rows={3}
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
              />
            </Field>
            <button
              className="nu-btn"
              disabled={busy || used >= c.max_tickets_per_player}
            >
              Submit entry for review
            </button>
          </form>
        )}
      <p>
        <strong>{data.entry_count ?? 0} total entries</strong> · Approved entry
        contributions: {c.entry_item === "Cash" ? "$" : ""}
        {data.pool_quantity.toLocaleString()}{" "}
        {c.entry_item === "Cash" ? "Torn dollars" : c.entry_item}
      </p>
      <h4>{data.is_host ? "Review entries" : "Your entries"}</h4>
      {data.submissions.length === 0 && <p>No entries to show.</p>}
      {data.submissions.map((s) => (
        <div key={s.id} className="draw-entry">
          <strong>
            {s.player_name} [{s.torn_id}] · {s.quantity} {c.entry_item} ·{" "}
            {s.tickets} tickets
          </strong>
          <p>
            {s.status} · {dateLabel(s.created_at)}
          </p>
          <p>Reference: {s.transfer_reference}</p>
          <p style={{ whiteSpace: "pre-wrap" }}>{s.evidence}</p>
          {s.review_note && <p>Host note: {s.review_note}</p>}
          {s.refunded_at && <p>Host recorded refund: {s.refund_reference}</p>}
          {data.is_host && c.cancelled_at && !s.refunded_at && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  () =>
                    action("refund", c.id, {
                      submission_id: s.id,
                      reference: refundRefs[s.id],
                    }),
                  "Refund recorded.",
                );
              }}
            >
              <Field label="Refund transfer reference (after returning received items in Torn)">
                <input
                  required
                  minLength={3}
                  maxLength={200}
                  value={refundRefs[s.id] ?? ""}
                  onChange={(e) =>
                    setRefundRefs({ ...refundRefs, [s.id]: e.target.value })
                  }
                />
              </Field>
              <button className="nu-btn" disabled={busy}>
                Record items refunded
              </button>
            </form>
          )}
          {data.is_host &&
            s.status === "pending" &&
            !c.drawn_at &&
            !c.cancelled_at && (
              <>
                <Field label="Review note (required for rejection)">
                  <input
                    maxLength={2000}
                    value={reviewNotes[s.id] ?? ""}
                    onChange={(e) =>
                      setReviewNotes({ ...reviewNotes, [s.id]: e.target.value })
                    }
                  />
                </Field>
                <div className="draw-actions">
                  <button
                    className="nu-btn"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          action("approve", c.id, {
                            submission_id: s.id,
                            note: reviewNotes[s.id] ?? "",
                          }),
                        "Entry approved after host review.",
                      )
                    }
                  >
                    Approve received transfer
                  </button>
                  <button
                    className="nu-btn"
                    disabled={busy || !reviewNotes[s.id]?.trim()}
                    onClick={() =>
                      void run(
                        () =>
                          action("reject", c.id, {
                            submission_id: s.id,
                            note: reviewNotes[s.id],
                          }),
                        "Entry rejected. Resolve any returned items directly in Torn.",
                      )
                    }
                  >
                    Reject
                  </button>
                </div>
              </>
            )}
        </div>
      ))}
      {data.is_host && !c.drawn_at && !c.cancelled_at && (
        <div className="draw-preview">
          <h4>Draw winners</h4>
          <p>
            {status === "Open"
              ? "Wait until the entry deadline."
              : data.pending_count
                ? "Review every pending entry first."
                : data.eligible_players < c.prizes.length
                  ? `Needs ${c.prizes.length} distinct eligible players; currently ${data.eligible_players}.`
                  : "The draw is ready."}
          </p>
          <p>
            Drawing saves one permanent result. Payouts remain manual in Torn.
          </p>
          <label>
            <input
              type="checkbox"
              checked={confirmDraw}
              onChange={(e) => setConfirmDraw(e.target.checked)}
            />{" "}
            I have checked the entries and am ready to finalize the draw.
          </label>
          <button
            className="nu-btn"
            disabled={busy || !drawReady || !confirmDraw}
            onClick={() =>
              void run(
                () => action("draw", c.id),
                "Winners drawn and saved. Send their prizes directly in Torn.",
              )
            }
          >
            Finalize draw
          </button>
        </div>
      )}
      {data.is_host && !c.drawn_at && !c.cancelled_at && (
        <details>
          <summary>Cancel campaign and return items</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                () => action("cancel", c.id, { note: cancelNote }),
                "Campaign cancelled. Return received items in Torn and record each refund.",
              );
            }}
          >
            <p>
              This stops entries permanently. Return any received items,
              including pending or rejected transfers that actually arrived. Use
              this if there are too few eligible players to draw.
            </p>
            <Field label="Cancellation reason">
              <textarea
                required
                minLength={3}
                maxLength={2000}
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
              />
            </Field>
            <button className="nu-btn" disabled={busy}>
              Cancel campaign
            </button>
          </form>
        </details>
      )}
      {c.drawn_at && (
        <div>
          <h4>Winners · {dateLabel(c.drawn_at)}</h4>
          <p>The result is final. No rerolls.</p>
          {data.winners.map((w) => (
            <div key={w.rank} className="draw-entry">
              <strong>
                #{w.rank} · {w.player_name} [{w.torn_id}] · {w.quantity}{" "}
                {w.prize_item}
              </strong>
              <p>
                {w.received_at
                  ? "Receipt confirmed"
                  : w.paid_at
                    ? "Host marked prize sent"
                    : "Awaiting manual payout"}
              </p>
              {w.payment_reference && (
                <p>Transfer reference: {w.payment_reference}</p>
              )}
              {data.is_host && !w.paid_at && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(
                      () =>
                        action("paid", c.id, {
                          rank: w.rank,
                          reference: paymentRefs[w.rank],
                        }),
                      "Prize marked sent.",
                    );
                  }}
                >
                  <Field label="Payout transfer reference">
                    <input
                      required
                      minLength={3}
                      maxLength={200}
                      value={paymentRefs[w.rank] ?? ""}
                      onChange={(e) =>
                        setPaymentRefs({
                          ...paymentRefs,
                          [w.rank]: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <button className="nu-btn" disabled={busy}>
                    Record prize sent in Torn
                  </button>
                </form>
              )}
              {data.viewer_torn_id === w.torn_id &&
                w.paid_at &&
                !w.received_at && (
                  <button
                    className="nu-btn"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => action("received", c.id, { rank: w.rank }),
                        "Prize receipt confirmed.",
                      )
                    }
                  >
                    Confirm I received this prize
                  </button>
                )}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
