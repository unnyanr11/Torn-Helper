# Assigned war targets and hospital alerts

Open **War Room → Choose / edit my targets**. The gateway verifies the signed-in Torn identity, current faction and active ranked/raid/territory wars using the stored encrypted key. Choose a war, select opponents and save. The attack view contains only saved target IDs; attack links appear only for a fresh `Okay` status. Attacks require an explicit click in Torn.

The actual `basic.leader_id` from Torn may assign targets to another current roster member who has linked their Torn account here. Position labels, editable app rosters, client flags and co-leader status grant no override. Every load/save verifies current membership/leadership; all writes go through the authenticated gateway. A member can edit their own list. Concurrent changes require reloading instead of overwriting another edit.

One active war list is stored per app user. The table is owner-readable through RLS and cannot be written directly by browser roles. Leader edits appear through owner-scoped Realtime; a 30-second database fallback covers missed events. No private credentials or unrelated member data are included in the target list. A new faction, ended war or removed enemy invalidates the relevant targets on refresh.

Alerts use the absolute `status.until` returned for `Hospital`, scheduled locally at `until - 20 seconds`. A changed hospital stay replaces the old deadline; each owner/war/target/deadline is deduplicated across reloads. Removed targets, paused alerts and ended wars cancel pending popups. Verification expires after two minutes if refresh fails. Ordinary countdown ticks and the popup itself make no API requests.

While the app is open, an active saved list with alerts enabled refreshes about once a minute, across all workspace pages. Refresh verifies own faction and current wars, then fetches just the chosen enemy roster. Repeated refreshes within 30 seconds reuse the saved snapshot. Personal logs cannot observe every enemy hospitalization/revive, so this limited status refresh is necessary. No war endpoints are added to startup preparation.

In-app popups work without browser notification permission. The optional **Enable desktop popups** button requests permission on click. Closed tabs have no push service; browser sleep, network/API delays, early discharge, revives and new attacks can make a recorded deadline inaccurate. A late wakeup never announces an already-expired hospital. Check current Torn status before attacking.

Validation: gateway tests for authentication, self/leader/member boundaries, enemy membership, ended wars, alert preferences and optimistic revisions; local Postgres tests for owner RLS and forbidden browser writes; fake-clock tests for exact 20-second scheduling, deduplication, cancellation, changed stays and browser sleep; rendered-page checks for assigned-only attack links. No production player API probes or test assignments are created.

## Coordination, claims and reports

Targets sort into observed available, hospital, and other status groups, then priority and release time. A fresh target requires an active owned claim to display its attack link. Claims are advisory app coordination; Torn itself does not reserve an opponent.

When claiming, choose **Release after attacks** (1–100). The server counts only the claimant’s completed attacks against that target which started after the claim, including wins and losses, excluding interrupted attacks. Attack IDs are deduplicated in a private table; a completed goal deletes the claim atomically and records a completion event. Progress is checked roughly once a minute while the app is open and a claim exists, even if hospital alerts are paused. **Check my claim progress** performs an explicit check. Each check reads at most two attack pages; continuations are saved and resumed. An idle claim expires after ten minutes without a newly confirmed attack, with a one-hour hard limit. Browser roles cannot claim directly or submit forged progress.

Shared claims are owner/faction/war scoped, atomic on the server, delivered by Realtime with a database fallback, and expire locally without a Torn request. Faction visibility relies on a short server-verified membership proof and an active linked Torn identity. Only the actual current leader can view the assignment board and change another current member’s target list. The board highlights unassigned opponents and records before/after target IDs and priorities transactionally.

The readiness panel uses existing saved energy, medical cooldown and own hospital/status snapshots. No new requests are added to startup.

Alert settings persist per account: advance warning 5–120 seconds, silent/soft/double sound, volume and desktop notifications. A test button previews the popup and saved sound. A bounded, deduplicated enemy-roster check runs about ten seconds before an alert; a recent regular roster snapshot can satisfy that check. An unverified old deadline is suppressed. Browser audio permissions, sleep and upstream caches still affect delivery.

Reports preserve each recorded war and use only the signed-in user’s authorized outgoing attacks against the recorded enemy in the matching war category and time window. Reports fetch at most two pages per explicit sync; partial coverage and unconfirmed end times are visible. Ranked war end times come from the official ranked-war report; other war types can retain an unconfirmed end rather than invent one. Results and respect are recorded values. Observed availability windows without a recorded own hit are labeled sampled observations, not guaranteed missed opportunities. Reports never infer private battle stats or expose another member’s private attack log.


## Rest and return

**I’m going to rest** releases all owned claims in one transaction, saves the original attack goal and confirmed progress, and pauses automatic war checks and hospital popups. For example, 1/3 completed saves two remaining attacks. Rest works without another Torn request, even when general tracking is paused, and persists across sign-ins. A repeated rest does not erase previously saved goals.

**I’m back** first verifies the current faction, war, enemy roster and assignments. It reconciles original-claim attacks that arrived late in the API, using the original deduplication IDs and only the interval before the break. Attacks made while resting do not consume the resumed goal. History is checked at most two pages per action; incomplete history offers a continuation rather than guessing progress. Missing permissions or network errors retain saved goals.

Returning creates a new reservation only when the target is free (including an expired reservation). It retains the original goal and completed count, starts a new claim interval, and cannot override a live claim held by anyone, including a newer own claim. Busy targets retain their saved goals for another return attempt. Completed goals, removed assignments, departed enemies and old wars/factions are discarded with an explanation. A manually chosen new claim replaces an old saved rest goal for that target.
