# Stronger stock models: measured accuracy and latency

All results below are offline measurements on the same saved market-data snapshot. No production model is replaced by this benchmark.

## Matched evaluation

- 35 stocks; 1-, 5-, 15- and 60-minute horizons; 12 common origins two hours apart in the final held-out day.
- Each profile produced 1,680 scored forecasts. Direction scores use the 1,481 non-flat outcomes. Wait does not count as a correct direction.
- Classical models fit only labels whose timestamps precede the final-day boundary. Foundation models use pretrained weights with no Torn-specific fine-tuning.
- Inputs for a prediction stop at its origin. All selected origins and targets are observed prices. Internal gaps use surrounding-observation averages, with the right neighbour already available at the observed origin.
- The models are tested on the same origins; each foundation model is limited by its native context length.
- This is one saved evaluation day with correlated stocks/horizons. It is exploratory, not independent forward evidence of reliable trading profitability.

## Results

Times are warm model-computation medians for all 35 stocks / 140 horizon outputs. They exclude training, loading, data preparation, network and database work. Trees have five timing runs; neural profiles have three. CPU threads and precision differ as listed. These are CPU measurements; no GPU or hosted Hugging Face endpoint is measured.

| Model | CPU threads | Direction correct | Warm batch | Relative price MAE |
|---|---:|---:|---:|---:|
| CatBoost-256 | 2 | 54.49% | 0.020 s | 0.02874% |
| Chronos-2 (BF16) | 2 | 54.22% | 14.934 s | 0.02888% |
| Chronos-2 (BF16) | 8 | 54.22% | 4.726 s | 0.02888% |
| LightGBM-256 | 2 | 54.02% | 0.029 s | 0.02891% |
| RandomForest-96 | 2 | 53.41% | 1.782 s | 0.02863% |
| ExtraTrees-96 | 2 | 52.67% | 1.814 s | 0.02842% |
| Chronos-Bolt-small (BF16) | 2 | 51.92% | 0.593 s | 0.02958% |
| Ridge | 2 | 51.52% | 0.009 s | 0.02850% |
| XGBoost-256 | 2 | 51.05% | 0.011 s | 0.02866% |
| TimesFM-2.5 (BF16) | 8 | 50.51% | 15.896 s | 0.02887% |
| Chronos-2-joint (BF16) | 8 | 49.76% | 4.781 s | 0.02920% |
| No change | 2 | — | 0.000 s | 0.02829% |

The no-change baseline has no directional forecast. Its low price error is a necessary baseline to beat; small price-level error must not be presented as 99% successful trading.

## Interpretation

CatBoost-256 is the most promising speed/direction candidate in this sample: 54.49% and about 20 ms. LightGBM-256 reached 54.02% in about 29 ms. Both need stronger evidence, particularly cost-aware forward evaluation, before replacing the live selector. Neither beat the no-change baseline on mean absolute price error.

Chronos-2 reached 54.22%. Increasing CPU threads from two to eight reduced the observed warm median from 14.934 s to 4.726 s with identical scored predictions. Its joint 35-stock variant reached 49.76% in 4.781 s, so cross-stock attention did not help this particular evaluation.

Chronos-Bolt Small reached 51.92% in 0.593 s. TimesFM 2.5 reached 50.51% in 15.896 s on eight CPU threads, missing the 10-second computation target in that configuration.

The current backend architecture can cache predictions regardless of model family. Candidate model time alone does not establish hosted end-to-end latency or profitable Buy/Sell decisions. Keep the ownership, net-profit, fee, dip/rebound, stale-data and validation gates in force. No candidate demonstrated 99% directional accuracy.

## Loading, fitting and context

| Model/profile | Task-specific fitting | Loading | First prediction batch | Context |
|---|---:|---:|---:|---|
| CatBoost-256 / 2 threads | 46.278 s | Not measured | Not measured | Six-day fitting; 60-minute indicators |
| Chronos-2-bf16 / 2 threads | Zero-shot | 9.606 s | 13.489 s | Up to 8,192 minute points |
| Chronos-2-bf16 / 8 threads | Zero-shot | 10.014 s | 5.304 s | Up to 8,192 minute points |
| LightGBM-256 / 2 threads | 10.421 s | Not measured | Not measured | Six-day fitting; 60-minute indicators |
| RandomForest-96 / 2 threads | 168.784 s | Not measured | Not measured | Six-day fitting; 60-minute indicators |
| ExtraTrees-96 / 2 threads | 18.995 s | Not measured | Not measured | Six-day fitting; 60-minute indicators |
| Chronos-Bolt-small-bf16 / 2 threads | Zero-shot | 41.345 s | 0.750 s | Up to 2,048 minute points |
| Ridge / 2 threads | 0.902 s | Not measured | Not measured | Six-day fitting; 60-minute indicators |
| XGBoost-256 / 2 threads | 8.387 s | Not measured | Not measured | Six-day fitting; 60-minute indicators |
| TimesFM-2.5-bf16 / 8 threads | Zero-shot | 11.031 s | 17.009 s | Up to 10,240 minute points |
| Chronos-2-joint-bf16 / 8 threads | Zero-shot | 10.643 s | 5.464 s | Up to 8,192 minute points |

Loading includes package/checkpoint setup and Hub lookup; the first Bolt Small run also downloaded weights. It is not a controlled deployment cold-start comparison. Initial FP32 CPU attempts were much slower: roughly 31 s for a Chronos-2 first batch and 88 s for TimesFM. Those interrupted attempts are recorded as timing observations only, with no invented accuracy figures. Completed neural profiles use BF16 CPU acceleration.

Chronos-2 uses 8,192 minutes (about 5.7 days), Bolt Small 2,048 (about 34 hours), and TimesFM is configured for 10,240, enough for the available week. The previous full-grid benchmark uses different origins and a 64-tree LightGBM; do not interpret score differences between reports as controlled accuracy gains.

## Reproduction

The input is the observed-price JSONL format documented in [STOCK_MODELS.md](STOCK_MODELS.md). Public market data and pinned model revisions are recorded in [methodology.json](stock-benchmarks/advanced-2026-11-19/methodology.json); package versions and every measured run are retained alongside the summary.

```sh
python -m venv --system-site-packages /tmp/stock-bench
/tmp/stock-bench/bin/pip install --index-url https://download.pytorch.org/whl/cpu "torch==2.15.0+cpu"
/tmp/stock-bench/bin/pip install -r scripts/advanced-stock-benchmark-requirements.txt
/tmp/stock-bench/bin/python scripts/benchmark-advanced-stocks.py recorded-week.jsonl catboost.json --model CatBoost-256
TORN_BENCH_THREADS=8 /tmp/stock-bench/bin/python scripts/benchmark-advanced-stocks.py recorded-week.jsonl chronos.json --model Chronos-2-bf16
TORN_BENCH_THREADS=8 /tmp/stock-bench/bin/python scripts/benchmark-advanced-stocks.py recorded-week.jsonl joint.json --model Chronos-2-joint-bf16
TORN_BENCH_THREADS=8 /tmp/stock-bench/bin/python scripts/benchmark-advanced-stocks.py recorded-week.jsonl timesfm.json --model TimesFM-2.5-bf16
```

Neural runs save `.progress.json` and `.pred.npy` checkpoints. Resume with the same input, output path, model and CPU-thread setting. Choose a new output path for a changed configuration. Downloaded model weights and raw prices are not committed.

Model references: [Chronos-2](https://huggingface.co/amazon/chronos-2), [Chronos-Bolt Small](https://huggingface.co/amazon/chronos-bolt-small), [TimesFM 2.5](https://huggingface.co/google/timesfm-2.5-200m-pytorch).

Machine-readable [summary](stock-benchmarks/advanced-2026-11-19/summary.json) includes results for every horizon.
