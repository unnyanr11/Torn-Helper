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
