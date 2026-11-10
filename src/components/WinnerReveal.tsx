import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import "./winner-reveal.css";
/** Cosmetic unsealing only: this component never fetches or selects winners. */
export default function WinnerReveal({
  campaignId,
  children,
}: {
  campaignId: string;
  children: ReactNode;
}) {
  const [complete, setComplete] = useState(false);
  useEffect(() => {
    const key = `torn-reveal-played:${campaignId}`;
    let played = false;
    try {
      played = sessionStorage.getItem(key) === "yes";
    } catch {}
    const reduced =
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (played || reduced) {
      setComplete(true);
      return;
    }
    const timer = setTimeout(() => {
      setComplete(true);
      try {
        sessionStorage.setItem(key, "yes");
      } catch {}
    }, 3200);
    return () => clearTimeout(timer);
  }, [campaignId]);
  return (
    <section
      className={`winner-reveal ${complete ? "winner-reveal-complete" : "winner-reveal-unsealing"}`}
      aria-label="Winner reveal"
    >
      {!complete ? (
        <div className="reveal-ceremony" role="status" aria-live="polite">
          <div className="reveal-halo" aria-hidden="true" />
          <div className="reveal-emblem" aria-hidden="true">
            <svg viewBox="0 0 80 80" fill="none">
              <path
                d="M23 14h34v17c0 14-8 22-17 27-9-5-17-13-17-27V14Z"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                d="M23 22H12v8c0 11 8 15 16 15m29-23h11v8c0 11-8 15-16 15M40 58v10m-12 0h24"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="m40 25 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <span className="reveal-eyebrow">THE MOMENT HAS ARRIVED</span>
          <h3>Unsealing the winners</h3>
          <p>The saved result has been released.</p>
          <div className="reveal-progress" aria-hidden="true">
            <span />
          </div>
        </div>
      ) : (
        <div className="winner-reveal-content">
          <div className="reveal-confetti" aria-hidden="true">
            {Array.from({ length: 24 }, (_, i) => (
              <i
                key={i}
                style={
                  {
                    "--x": `${(i * 41) % 100}%`,
                    "--delay": `${(i % 6) * 0.07}s`,
                    "--rotation": `${i * 43}deg`,
                    "--fall": `${150 + (i % 5) * 22}px`,
                    "--color": ["#e2b758", "#65c5bd", "#a693df"][i % 3],
                  } as CSSProperties
                }
              />
            ))}
          </div>
          <p className="reveal-verified">
            <span aria-hidden="true">✓</span> Official results revealed
          </p>
          {children}
        </div>
      )}
    </section>
  );
}
