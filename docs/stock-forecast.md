# Stock timing lab

The Stocks page trains a small ridge-regression model locally from actual official
Torn `/torn/{stockId}/stocks` chart history. No AI provider or paid service is
required. Predictions are experimental estimates, not guaranteed profits.

## Collection and privacy

No Torn stock call is made on mounting the screen or by its local clock. A user
can refresh one selected stock, or compare the 35 named stocks. Comparison
reuses observations fetched in the last 15 minutes and loads only missing or old
histories, sequentially, with 3.4 seconds between network requests. The scan stops
on errors without retries and can be cancelled. Unmounting or changing account
aborts outstanding work. All requests use the existing authenticated Torn proxy,
owner-specific query cache, server permission checks and cache persistence. No
credentials enter the model and no external prediction service receives data.
The feature makes no changes to startup's existing request budget.

The model accepts only positive, finite prices with valid nonfuture timestamps
from the selected stock's `chart.history`. Quotes, screenshot prices, performance
summaries and personal holdings are not training data. Duplicate timestamps are
collapsed, history is sorted, and only the latest 600 observations are used.
At least 80 regularly spaced observations are required. Uneven intervals produce
Wait instead of interpolation. The horizon is the actual chart interval, rather
than assuming all charts contain minute or daily bars.

## Model and evaluation

Five inputs at each origin: latest return, three-interval mean return,
twelve-interval mean return, twelve-interval return volatility, and deviation
from the twelve-price mean. The target is the next interval's simple return.
Standardization uses the current training window only. Ridge uses a fixed L2
penalty of 1 with an unpenalized intercept. No hyperparameters are selected using
the test window. The last 30% of samples (maximum 40) are evaluated with expanding
walk-forward retraining. Each evaluated forecast sees only prices available at
that origin. Validation predictions are retained for inspection/tests. The final
model then trains on all observed samples to forecast the next unseen interval.

A model must beat the no-price-change baseline's mean absolute return error by
5%, have at least 20 tests, and correctly predict direction at least 55% of the
time. Constant series cannot pass by claiming ties as correct. Extreme (20% or
more per interval) or nonfinite forecasts are rejected. This is a minimal
historical evidence gate, not proof of future trading profitability. Results from
many stocks are not independent discoveries and selection can overfit.

The error range adds/subtracts the 90th percentile of absolute walk-forward
return errors. It is a historical empirical band, not a calibrated 90% future
coverage guarantee. No made-up confidence or win probability is shown.

## Signals and fees

Official Torn rules: https://wiki.torn.com/wiki/Stock_Market
Buying has no fee; selling costs 0.1%. Forecast estimates exclude dividends,
slippage, benefit-block progress and execution constraints.

- Buy candidate: lower estimated future price × 0.999 exceeds last chart price.
  The displayed entry ceiling is lower estimated future price × 0.999.
- Sell / rebuy watch: upper estimated future price is below last chart price ×
  0.999. This considers selling already owned trading shares and later buying
  back; it does not imply short selling. The rebuy ceiling is the current
  proceeds per share after fees, not a promised future execution price.
- Wait: insufficient, invalid, uneven or stale history; unsupported model; or a
  move that fails to clear both costs and the historical error range.

A forecast expires at its target timestamp. A local clock re-evaluates displayed
signals every 30 seconds without making API requests. Comparison lists prioritize
buy candidates, then sell/rebuy watch, then Wait; within groups they use stock
ID, not a claim of globally optimal returns. Different intervals should not be
compared as equivalent investments. Refresh the selected chart before trading,
especially after a longer comparison scan. All trades remain manual in Torn;
benefit holdings should be preserved unless the user decides otherwise.

## Verification

Tests cover schema extraction, chronology and future-price exclusion, walk-forward
leakage, cost gates, stale forecasts, weak/flat series, bounded collection,
cache reuse, failure/cancellation and explicit frontend actions. Synthetic prices
exist only in tests; no synthetic training history is shown in the product.

## Shared minute lab (v2)

The Stocks page now has a separate **Minute-by-minute stock lab**, above the
existing official-chart lab. It offers 1, 5, 15 and 60 minute forecast horizons.
It does not claim that increasing sample frequency guarantees higher accuracy.

### Collection and spreadsheet access

`collect-stock-minutes` is scheduled every minute using the existing private
scheduler token. It waits 12 seconds for publication, then reads Tornsy's public
watchlist once for all 35 known tickers. No user's key, identity, or holdings are
sent to Tornsy. Source: <https://tornsy.com/api> (checked 2026-11-16). Tornsy is an
independent provider collecting Torn prices, not a direct Torn API response.
The market index is excluded. A second bounded request loads up to 2,000 real
historical minutes for one stock per run. Warmup takes roughly 35 successful
runs; afterwards one stock is reconciled per run to recover provider-recorded
gaps. This stays at two upstream requests per scheduled minute, not 35.

Each point retains its source timestamp, price, share count when supplied,
source and collection time. Duplicates never overwrite the first observation.
Stale/incomplete batches, unknown stocks, invalid prices and future timestamps
are rejected. Missing minutes are not interpolated or copied from another time.
A failed run retains previous data and exposes its status. A lease prevents
concurrent or repeat collection in the same scheduled minute.

`stock_minute_prices` is an online table readable by signed-in users; client
inserts, updates and deletes are denied. Only service-authorized collector RPCs
can record observations. The archive is pruned to a rolling 30 days. At 35 stocks
this is about 50,400 rows per complete day. No Google account or public spreadsheet
is created. The website exposes the latest 120 table rows for the selected stock
and a CSV export of its latest 2,000 loaded observations, compatible with Excel
and Google Sheets. The full rolling archive is accessible to the database owner.
CSV exports should be saved separately for longer retention.

### Minute model validation

The model uses the latest consecutive segment of up to 2,000 recorded minute
observations. At least 240 observations are required for one-minute forecasts;
longer horizons require additional history. Features include 1–60 minute returns,
volatility and deviation from 5/20/60-price averages. Candidates are a fixed ridge
regression, recent momentum, mean reversion, and no change. Ridge keeps the fixed
L2 penalty; training windows are bounded to 360 samples.

Selection uses an earlier tuning window of up to 40 origins. Its winner is frozen
before a later, separate walk-forward holdout of up to 80 origins. For horizons
longer than one minute, overlapping future labels are purged from both training
and the end of the tuning window. Each holdout prediction sees only labels that
would already have been known at its origin. Models are not selected using the
reported holdout errors. Final fitting then uses all observed labels to predict
the chosen future interval.

A signal still requires at least 40 holdout predictions, 5% lower return MAE than
no change, 55% directional accuracy, and a move exceeding both the empirical
error margin and the configured 0.1% selling fee. Flat-series ties are not counted
as direction successes. Nonfinite/extreme forecasts, stale data or missing
history yield Wait. These gates do not establish statistically significant
profitability. Overlapping horizons and repeated stock/model comparisons are
correlated; do not treat each result as an independent discovery.

The error interval is empirical. Its displayed historical coverage is scored
sequentially using only residuals available at that origin, with the first 20
available errors used for calibration. It is not a promised 90% future coverage.
The interface also retains up to 240 genuinely forward predictions per
stock/horizon during the current open page session. Once exact target-minute
prices arrive, their direction/error are scored separately from historical
tests. That prospective score resets on reload and does not modify shared data.

The page checks shared collection status every 20 seconds while mounted and
loads history when its source minute changes. New history retrains the selected
stock/horizon in a dedicated Web Worker. Navigation terminates the worker.
No new Torn calls are made by these refreshes. Forecasts are not computed while
the page is closed, but collection continues. No trades are placed automatically.

### Analysis latency budget

Minute analysis runs in a dedicated browser worker with a 10,000 ms deadline,
including worker startup and message delivery. A deadline stops the worker,
ignores late results, ends the spinner and shows Wait without fabricating a new
prediction. Navigation cancels outstanding work. Browser scheduling/throttling
can delay UI updates, so this is a processing safeguard, not a successful-result
guarantee on every device or an end-to-end network SLA. Initial history download
is separate. The UI displays measured model runtime. A bounded 12-result cache
reuses unchanged stock/horizon/history inputs only while their forecast remains
fresh. Every input price/timestamp participates in the cache key.

A reproducible local benchmark on 2,000 real TCI observations (12 runs for each
of four horizons) measured median processing times of 12.6–25.4 ms and a slowest
run of 60.5 ms in the development environment. These are computation measurements,
not mobile-device or network latency guarantees. This lightweight model does not
require Hugging Face, GPUs, or separately hosted per-stock instances. Its input
window is up to 2,000 minutes (about 33h20m), with 1–60-minute features and the
latest 360 training samples used by ridge. The 30-day archive is not all fitted
at once. No universally optimal history duration has been established.
