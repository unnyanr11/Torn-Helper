# Stock model research, accuracy and latency

The application does not promise 99% successful trades or 99% correct price directions. Price-level error, direction accuracy, error-band coverage and realized profit are different measurements. Counting Wait as a correct trade would inflate accuracy.

## Research and model choice

- [LightGBM original NeurIPS paper](https://papers.neurips.cc/paper/2017/hash/6449f44a102fde848669bdd9eb6b76fa-Abstract.html): efficient gradient-boosted trees are a useful candidate for numerical market features.
- [NeurIPS tabular-data benchmark](https://proceedings.neurips.cc/paper_files/paper/2022/file/0378c7692da36807bdec87ab043cdadc-Paper-Datasets_and_Benchmarks.pdf): tree models performed strongly on the benchmark's medium-sized tabular datasets. This does not demonstrate superiority on Torn prices.
- [AAAI linear-versus-Transformer forecasting study](https://ojs.aaai.org/index.php/AAAI/article/view/26317): simple linear models beat the tested Transformers on its forecasting benchmarks. Model complexity alone is not evidence of accuracy.
- [Time-series validation guidance](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit): train before the test period, with a gap for overlapping forecast labels.

A local experiment used seven days of recorded market prices for all 35 stocks and the 1-, 5-, 15- and 60-minute horizons. It compared fixed LightGBM, ridge, momentum, mean reversion and no-change candidates. The final day was withheld from training; earlier labels could not cross the evaluation boundary. Features were available at the observed origin, including only gap averages whose right neighbour had already arrived. No synthetic origin or target was scored.

| Candidate | Non-flat direction correct | Mean relative absolute error |
|---|---:|---:|
| No change | Not applicable | 0.02920% |
| Momentum | 48.46% | 0.02983% |
| Mean reversion | 50.79% | 0.02926% |
| Ridge | 51.73% | 0.02946% |
| LightGBM | 50.79% | 0.03006% |

These aggregate direction results are not Buy/Sell win rates. Personalized Sell also depends on actual recorded ownership and cost. Different stocks/horizons have different performance. One test day and overlapping observations cannot establish long-term accuracy.

LightGBM did not outperform the no-change error baseline or ridge's directional result in this experiment. It is therefore not promoted to production. Production retains the existing per-stock selector: no change, ridge, momentum and mean reversion compete on earlier tuning observations, followed by separate holdout checks. Weak results produce Wait. The existing owned-profit and dip/rebound rules remain in force.

Machine-readable results and methodology: [2026-11-19 benchmark](stock-benchmarks/2026-11-19.json).

## Fast backend path

Weekly model fitting runs in the background, normally every 15 minutes. Fitted coefficients, empirical error margins, dip statistics and historical validation figures are saved on the server. Minute updates fetch only recent observations plus these saved models, apply all 140 forecasts together and publish one complete batch. No fitting or ML worker starts when the Stocks screen opens.

Models older than 30 minutes, missing observations, unavailable fits or unstable returns produce Wait. Initial warmup is separate from the steady-state prediction budget. Model fit time is shown separately from the fresh prediction timestamp; historical validation belongs to the saved fit.

On the recorded 35-stock dataset, local sequential fitting took 2.897 seconds. Cached inference for all 140 forecasts had a median of 2.72 ms and a 95th percentile of 3.90 ms over 20 runs. These are CPU measurements, not network promises. The live application measures scheduled request start through database publication, displays the observed batch duration and explicitly flags batches exceeding the 10-second target. Hosting and upstream outages can still delay a batch.

A live production request for the 17:18 UTC price minute on 19 November 2026 published all 35 stocks / 140 forecasts in 1.198 seconds and returned in 1.211 seconds. This demonstrates the warm path on that request; it is not a guarantee against future hosting or network delays.

## Reproduction

Use a JSONL export with one object per stock: `{"stock_id":1,"history":{"points":[[unix_minute,price],...]}}`. Use observed minute prices, not generated examples. Keep credentials out of the dataset and repository.

```sh
python -m pip install -r scripts/stock-benchmark-requirements.txt
python scripts/benchmark-stock-models.py recorded-week.jsonl model-results.json
node --experimental-strip-types scripts/benchmark-stock-inference.mjs recorded-week.jsonl inference-results.json
```

The Python benchmark is an offline evaluation tool. It does not change public predictions or issue trades. Current quote collection continues to use the dedicated backend key and shared cache.

## Optional Hugging Face experiments

[Chronos-2](https://huggingface.co/amazon/chronos-2) and [TimesFM 2.5](https://huggingface.co/google/timesfm-2.5-200m-pytorch) are time-series foundation-model candidates to benchmark on the same chronological splits. Their published results on other datasets do not establish Torn trading accuracy. A complex model must beat the current baseline after fees and meet the full 35-stock latency budget before promotion.

For a consistent latency target, use an always-running authenticated endpoint and batch all stocks together. [Scale-to-zero introduces a cold start](https://huggingface.co/docs/inference-endpoints/en/autoscaling). Scheduled predictions should still be saved in Supabase and served from cache to the UI. Training stays separate from page loads. No Hugging Face resource or paid hardware is created by this change.
