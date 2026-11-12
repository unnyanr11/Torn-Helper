# Timer tracking — 12 November 2026

Timer baselines and absolute deadlines are stored in owner-protected `torn_timer_baselines`, independently of the 24-hour general API cache. Cooldowns, travel, supported education/OC/status/chain deadlines and refill estimates are derived from actual returned values. No duration or player perk is guessed. Race snapshots participate in event invalidation; only supported deadline fields are displayed.

The login preparation pass reuses timer baselines. Its 95-section request target remains, but a saved timer no longer forces a new Torn request. Normal tools reuse the baseline; explicit Refresh actions can obtain a new one. Existing client-side minute/5-minute polling of bars, cooldowns, travel and profile has been removed.

A scheduled `sync-timers` worker checks incremental activity logs roughly once a minute, even with the browser closed. It processes at most two pages per account per run and coalesces new events into one request per affected endpoint. Drug/medical/booster use, travel, education, organized crime, racing, gym/attack/refill and status-changing actions invalidate the relevant existing baselines. An ordinary countdown reaching zero does not cause another request. Money transfers and other unrelated logs do not refresh timers.

Log coverage uses a durable cursor, overlap for same-second events, validated Torn continuation URLs and nanosecond cursors. Unfinished pages and failed endpoint refreshes remain queued. A leased job cannot finish another account's work. Paused tracking and revoked links are excluded. Quota failures back off; missing log permissions back off for an hour and show a status message. Changing a key or resuming tracking wakes processing. Background processing uses existing encrypted credentials and shared upstream quotas.

Database Realtime updates changed baselines in the browser. A once-a-minute database-only fallback restores updates if a Realtime event is missed. Per-second rendering only subtracts the local clock from saved deadlines; it does not request either Torn or Supabase. Saved cooldown alerts use the stored expiry and deduplicate each deadline rather than re-fetching cooldowns to find zero.

Limitations: logs require Full Access or appropriate Custom selections and may omit categories. Changes made by other faction members, unsupported log types, API delays and incomplete pages cannot guarantee current game state. Expiry is labelled estimated. Manual refresh remains available. Timers whose deadline meaning is not documented are left as observations rather than fabricated countdowns.

Validation covers deadline derivation, expiry without network access, cache eviction survival, owner RLS, denied writes/job controls, leases, tracking pause, selective invalidation, duplicate-event coalescing, pagination continuation, permission/quota backoff, failed-refresh retry, and initial setup cache reuse. No test inserts fake timer records into production.
