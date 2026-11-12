# Assigned war targets and hospital alerts

Open **War Room → Choose / edit my targets**. The gateway verifies the signed-in Torn identity, current faction and active ranked/raid/territory wars using the stored encrypted key. Choose a war, select opponents and save. The attack view contains only saved target IDs; attack links appear only for a fresh `Okay` status. Attacks require an explicit click in Torn.

The actual `basic.leader_id` from Torn may assign targets to another current roster member who has linked their Torn account here. Position labels, editable app rosters, client flags and co-leader status grant no override. Every load/save verifies current membership/leadership; all writes go through the authenticated gateway. A member can edit their own list. Concurrent changes require reloading instead of overwriting another edit.

One active war list is stored per app user. The table is owner-readable through RLS and cannot be written directly by browser roles. Leader edits appear through owner-scoped Realtime; a 30-second database fallback covers missed events. No private credentials or unrelated member data are included in the target list. A new faction, ended war or removed enemy invalidates the relevant targets on refresh.

Alerts use the absolute `status.until` returned for `Hospital`, scheduled locally at `until - 20 seconds`. A changed hospital stay replaces the old deadline; each owner/war/target/deadline is deduplicated across reloads. Removed targets, paused alerts and ended wars cancel pending popups. Verification expires after two minutes if refresh fails. Ordinary countdown ticks and the popup itself make no API requests.

While the app is open, an active saved list with alerts enabled refreshes about once a minute, across all workspace pages. Refresh verifies own faction and current wars, then fetches just the chosen enemy roster. Repeated refreshes within 30 seconds reuse the saved snapshot. Personal logs cannot observe every enemy hospitalization/revive, so this limited status refresh is necessary. No war endpoints are added to startup preparation.

In-app popups work without browser notification permission. The optional **Enable desktop popups** button requests permission on click. Closed tabs have no push service; browser sleep, network/API delays, early discharge, revives and new attacks can make a recorded deadline inaccurate. A late wakeup never announces an already-expired hospital. Check current Torn status before attacking.

Validation: gateway tests for authentication, self/leader/member boundaries, enemy membership, ended wars, alert preferences and optimistic revisions; local Postgres tests for owner RLS and forbidden browser writes; fake-clock tests for exact 20-second scheduling, deduplication, cancellation, changed stays and browser sleep; rendered-page checks for assigned-only attack links. No production player API probes or test assignments are created.
