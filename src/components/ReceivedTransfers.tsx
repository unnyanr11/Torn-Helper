import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { functionError } from "../lib/function-error";
import { useItemCatalogue } from "../hooks/useItemCatalogue";
import { depositLabel } from "../lib/lucky-draw";
import type { Campaign, DrawDetails, ReceiptPage } from "../lib/lucky-draw";
export default function ReceivedTransfers({
  campaign: c,
  isHost,
  sync,
}: {
  campaign: Campaign;
  isHost: boolean;
  sync: DrawDetails["sync"];
}) {
  const closed =
    !!c.drawn_at ||
    !!c.cancelled_at ||
    !!(c.closes_at && Date.parse(c.closes_at) <= Date.now());
  const client = useQueryClient(),
    catalogue = useItemCatalogue();
  const [offset, setOffset] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [notes, setNotes] = useState<Record<string, string>>({});
  const [automatic, setAutomatic] = useState(
    isHost &&
      c.entry_verification === "token" &&
      !c.drawn_at &&
      !c.cancelled_at,
  );
  const mounted = useRef(true),
    running = useRef(false),
    controller = useRef(new AbortController());
  useEffect(() => {
    mounted.current = true;
    if (controller.current.signal.aborted)
      controller.current = new AbortController();
    return () => {
      mounted.current = false;
      controller.current.abort();
    };
  }, []);
  const receipts = useQuery<ReceiptPage>({
    queryKey: ["lucky-draw", c.id, "receipts", offset],
    queryFn: async () => {
      const r = await supabase.rpc("lucky_draw_action", {
        action: "receipts",
        campaign: c.id,
        payload: { offset },
      });
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const synchronize = useCallback(
    async (pages: number) => {
      if (running.current) return;
      const signal = controller.current.signal;
      running.current = true;
      setBusy(true);
      setError("");
      setNotice("");
      try {
        let more = false;
        for (let n = 0; n < pages; n++) {
          if (signal.aborted) return;
          const r = await supabase.functions.invoke("sync-lucky-draw", {
            body: { campaign: c.id },
            signal,
          });
          if (r.error || r.data?.error)
            throw await functionError(
              r.data,
              r.error,
              "Unable to read received logs. A Full-access key or Custom key with user/log access is required.",
            );
          more = !!r.data.has_more;
          if (!more) break;
          if (n + 1 < pages)
            await new Promise((resolve) => setTimeout(resolve, 1200));
        }
        if (mounted.current) {
          setNotice(
            more
              ? "History scan is still in progress. Continue syncing to include all pages."
              : "Available log pages synced. New matching transfers become entries automatically.",
          );
          await client.invalidateQueries({ queryKey: ["lucky-draw", c.id] });
        }
      } catch (e) {
        if (mounted.current && !signal.aborted) {
          setError(
            e instanceof Error ? e.message : "Unable to sync received logs.",
          );
          setAutomatic(false);
        }
      } finally {
        running.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [c.id, client],
  );
  useEffect(() => {
    if (!automatic || !isHost) return;
    void synchronize(1);
    const timer = setInterval(() => void synchronize(1), 60000);
    return () => clearInterval(timer);
  }, [automatic, isHost, synchronize]);
  async function exclude(logId: string) {
    setError("");
    try {
      const r = await supabase.rpc("lucky_draw_action", {
        action: "exclude_receipt",
        campaign: c.id,
        payload: { log_id: logId, note: notes[logId] },
      });
      if (r.error) throw r.error;
      await client.invalidateQueries({ queryKey: ["lucky-draw", c.id] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to exclude receipt.");
    }
  }
  const names = new Map(catalogue.data?.items.map((i) => [i.id, i.name]));
  return (
    <div className="draw-preview">
      <h4>Transfer token and received logs</h4>
      {!isHost && closed && (
        <p role="status" className="badge warn">
          Entries are closed. Do not send more money or items; later transfers
          will not count.
        </p>
      )}
      <label className="draw-field">
        <span>Campaign token — paste this into the Torn transfer message</span>
        <input
          readOnly
          value={c.entry_token ?? ""}
          onFocus={(e) => e.target.select()}
        />
      </label>
      <p>
        Send to{" "}
        <strong>
          {c.host_name} [{c.host_torn_id}]
        </strong>
        . {depositLabel(c)}. Include the token as a separate word in the
        message. Matching is case-insensitive. Each verified transfer counts as
        one entry, up to {c.max_tickets_per_player} per player.
      </p>
      <p role="alert" className="badge warn">
        Warning: any entry without the token will be lost. Only received
        transfers with the campaign token in the message count. Each transfer
        within the configured deposit bounds gives one entry. Amounts outside
        the rule do not count.
      </p>
      {isHost && (
        <>
          <p>
            The server automatically syncs active campaigns every minute, even
            when this page is closed. Only matching received-transfer records
            are shown here. The host key must allow user/log access. All
            matching cash receipts are listed even when they do not qualify; no
            item or cash transfer is automated.
          </p>
          <div className="draw-actions">
            <button
              className="nu-btn"
              disabled={busy}
              onClick={() => void synchronize(5)}
            >
              {busy
                ? "Reading received logs…"
                : sync?.has_more
                  ? "Continue syncing received logs"
                  : "Sync received transfers"}
            </button>
            <label>
              <input
                type="checkbox"
                checked={automatic}
                onChange={(e) => setAutomatic(e.target.checked)}
              />{" "}
              Automatically refresh every minute while this view is open
            </label>
          </div>
          <p>
            Complete coverage through:{" "}
            {sync?.checked_through
              ? new Date(sync.checked_through * 1000).toLocaleString()
              : "Not synced yet"}
            . {sync?.has_more ? "More history pages remain." : ""} Token draws
            require a completed scan through the closing deadline.
          </p>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {receipts.error && (
        <p role="alert">
          Unable to load received transfers. {receipts.error.message}
        </p>
      )}
      {receipts.data && (
        <>
          <p>
            <strong>
              {receipts.data.total} matching received logs ·{" "}
              {receipts.data.counted_entries} counted entries · $
              {Number(receipts.data.money_received).toLocaleString()} cash
              received with this token
            </strong>
          </p>
          <small>
            Cash received includes ineligible matching payments. Only approved
            entry contributions form the prize pool.{" "}
            {isHost
              ? "Showing all senders."
              : "Showing your received-transfer records."}
          </small>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Sender</th>
                  <th>Amount / items received</th>
                  <th>Message token</th>
                  <th>Entries</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {receipts.data.rows.map((r) => (
                  <tr key={r.log_id}>
                    <td>
                      {new Date(r.received_at).toLocaleString()}
                      <small style={{ display: "block" }}>
                        Log: {r.log_id}
                      </small>
                    </td>
                    <td>
                      <a
                        href={`https://www.torn.com/profiles.php?XID=${r.sender_torn_id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {r.sender_torn_id}
                      </a>
                    </td>
                    <td>
                      {r.assets.map((a, i) => (
                        <div key={i}>
                          {r.kind === "cash"
                            ? `$${a.quantity.toLocaleString()}`
                            : `${a.quantity} × ${names.get(a.item_id!) ?? `Item #${a.item_id}`}`}
                        </div>
                      ))}
                    </td>
                    <td style={{ overflowWrap: "anywhere", maxWidth: 240 }}>
                      {r.message}
                    </td>
                    <td>{r.tickets}</td>
                    <td>
                      <strong>{r.state.replace(/_/g, " ")}</strong>
                      <p>{r.reason}</p>
                      {isHost &&
                        r.state === "awaiting_eligibility" &&
                        !c.drawn_at && (
                          <>
                            <label className="draw-field">
                              <span>Reason to exclude this receipt</span>
                              <input
                                value={notes[r.log_id] ?? ""}
                                maxLength={2000}
                                onChange={(e) =>
                                  setNotes({
                                    ...notes,
                                    [r.log_id]: e.target.value,
                                  })
                                }
                              />
                            </label>
                            <button
                              className="nu-btn"
                              disabled={!notes[r.log_id]?.trim() || busy}
                              onClick={() => void exclude(r.log_id)}
                            >
                              Exclude from draw
                            </button>
                            <small>
                              Return received funds or items manually if
                              required.
                            </small>
                          </>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {receipts.data.total === 0 && (
            <p>No matching received transfers in the synced history.</p>
          )}
          <div className="draw-actions">
            <button
              className="nu-btn"
              disabled={offset === 0 || receipts.isFetching}
              onClick={() => setOffset(Math.max(0, offset - 100))}
            >
              Previous 100
            </button>
            <span>
              Showing {receipts.data.total ? offset + 1 : 0}–
              {Math.min(offset + 100, receipts.data.total)} of{" "}
              {receipts.data.total}
            </span>
            <button
              className="nu-btn"
              disabled={
                offset + 100 >= receipts.data.total || receipts.isFetching
              }
              onClick={() => setOffset(offset + 100)}
            >
              Next 100
            </button>
          </div>
        </>
      )}
    </div>
  );
}
