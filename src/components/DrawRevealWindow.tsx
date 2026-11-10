import { useEffect, useRef, useState } from "react";
import type { Campaign, DrawDetails } from "../lib/lucky-draw";
export function revealCountdown(revealAt: string, now = Date.now()) {
  const seconds = Math.max(0, Math.ceil((Date.parse(revealAt) - now) / 1000));
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${seconds % 60}s`;
}
export default function DrawRevealWindow({
  campaign: c,
  data,
  onReveal,
}: {
  campaign: Campaign;
  data: DrawDetails;
  onReveal: () => void;
}) {
  const [now, setNow] = useState(Date.now),
    refresh = useRef(onReveal);
  refresh.current = onReveal;
  const revealAt =
    data.reveal_at ??
    (c.closes_at
      ? new Date(Date.parse(c.closes_at) + 48 * 3600000).toISOString()
      : null);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    if (!revealAt || data.result_state === "revealed") return;
    const delay = Date.parse(revealAt) - Date.now();
    if (delay <= 0) {
      refresh.current();
      return;
    }
    if (delay > 2147483000) return;
    const timer = setTimeout(() => refresh.current(), delay + 150);
    return () => clearTimeout(timer);
  }, [revealAt, data.result_state]);
  return (
    <div className="draw-preview">
      <h4>Automatic draw and 48-hour reveal</h4>
      {!c.closes_at ? (
        <p>
          The draw runs automatically after the required entry count and final
          entry window. Winners are stored on the backend, then revealed 48
          hours after entry closing.
        </p>
      ) : (
        <>
          <p>Entry closing: {new Date(c.closes_at).toLocaleString()}.</p>
          <p>
            Results reveal:{" "}
            <strong>{new Date(revealAt!).toLocaleString()}</strong> — 48 hours
            after entry closing.
          </p>
          {!c.drawn_at ? (
            <p>
              {now < Date.parse(c.closes_at)
                ? "Entries are still open. The server will complete the draw automatically after closing."
                : "The server is completing final transfer verification and eligibility checks before saving the random draw. No manual draw is required."}
            </p>
          ) : data.result_state === "sealed" ? (
            <>
              <p>
                The backend has saved the random result. Winner identities
                remain sealed.
              </p>
              <p role="timer" aria-label="Time until winner reveal">
                {revealCountdown(revealAt!, now)} remaining
              </p>
            </>
          ) : (
            <p>Results are revealed below.</p>
          )}
        </>
      )}
      <small>
        Automatic processing checks every minute. Missing log access or
        unresolved eligibility can delay the draw. Admin display-name
        corrections retain the original winning Torn ID and appear with the
        revealed result.
      </small>
    </div>
  );
}
