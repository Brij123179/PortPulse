# Data Sources for Model Calibration & Validation
### PortPulse — Increment 2 (Prediction Core)

Increment 1's synthetic generator (F-101) remains the **system of record** for the live demo — real AIS access is out of hackathon scope and would blow past the i3/8GB budget (some of the datasets below run into the hundreds of millions of rows). What changes in I2 is *how the synthetic engine and models are calibrated*: instead of picking dwell-time distributions and ETA-bias numbers by guesswork, we ground them in small, real, publicly available datasets. This is what separates "our numbers are made up" from "our numbers are grounded, at hackathon scale" — a distinction judges scoring Technical Implementation Quality will notice.

**Rule for all of the below**: download once, preprocess into a small derived CSV/Parquet under ~10–20MB, commit *that* (or regenerate it via a documented script), and never load the full raw source into memory or into git. Full source files stay outside the repo.

---

## 1. Datasets and What They're For

| Dataset | Size (usable slice) | License / Access | Feeds Into |
|---|---|---|---|
| **Kaggle: AIS Dataset — Kattegat Strait** (`eminserkanerdonmez/ais-dataset`) | ~5MB zipped, Jan 1–Mar 10 2022 | Kaggle open dataset, free | Real vessel kinematic + static fields including reported **ETA**, speed, and destination — use this to compute a real-world distribution of "reported ETA vs. actual arrival" drift, which becomes the calibration target for `baselines.py`'s carrier-bias baseline and `eta_model.py`'s training target shape (F-201) |
| **NOAA Marine Cadastre — AccessAIS** (marinecadastre.gov/ais) | Custom order, filter to **one US port area + 1–2 weeks** to keep it under ~50MB | US government, public domain, free | A second, independent real-AIS source to cross-check the ETA-drift and vessel-speed patterns above aren't an artifact of one dataset — pull a small slice (e.g., Port of Long Beach vicinity, 2 weeks) rather than a full-year/full-coast order |
| **World Port Index (NGA Pub 150)**, via Kaggle mirror (`marwaashraf5814/ports-ais`) or the Hugging Face mirror `ronnieaban/world-seaports` | ~3.5MB CSV, ~2,900 ports globally | Public domain (NGA), free | Real port names, harbor size classes, channel/anchorage/cargo-pier depths, and max vessel length/beam/draft per port — use this to make F-101's synthetic berth generator produce **realistic draft/length constraint combinations** instead of arbitrary numbers, and to give the demo real port names for credibility |
| **Event Log Dwelling Time Dataset** (Mendeley, Prasetyo et al., DOI `10.17632/yvp2b4rtp3.2`) | Small event-log CSV, 3 months of real container dwell-time process data | Open access (Data in Brief journal), free | Real distribution shape of container/vessel dwell time at a terminal — use this to validate that F-103's synthetic historical turnaround store (currently modeled as 65% on-time / 15% yard / 10% crane / 10% weather) produces a plausible dwell-time *distribution*, not just plausible category proportions |
| **Academic reference (no data download needed)**: Tianjin Port berth utilization study (Univ. of Southampton) | N/A — reference numbers only | Cite as a benchmark | Reports real berth utilization ranging 1%–88% over a year — use as a sanity bound: if your synthetic/forecast occupancy probabilities never leave a narrow band, your shock-event injection (F-101) isn't varied enough |

**Explicitly out of scope for this hardware**: the Piraeus AIS dataset (244M+ records) and any full-country/full-year NOAA AIS bulk order — these are mentioned in `06_ml_engineering.md`'s "future roadmap" framing only, never to be downloaded to this machine.

## 2. How This Plugs Into the I2 Plan You Already Have

Referencing the file/module layout from the Increment 2 implementation plan:

- **`services/ml/baselines.py`**: the naive ETA baseline ("carrier ETA + historical mean bias") gets its mean-bias constant from the real Kattegat AIS slice, not an assumed value — compute it once in a small offline notebook/script and store the resulting constant(s) in a config file, not recomputed at runtime.
- **`services/ml/feature_store.py`**: add a one-time preprocessing step (run manually, not on every app startup) that reads the small derived CSVs above and produces:
  - a `carrier_eta_bias_distribution.csv` (from the AIS ETA-vs-actual-arrival slice)
  - a `dwell_time_reference_distribution.csv` (from the Mendeley dwell-time event log)
  - a `port_reference_specs.csv` (from World Port Index, filtered to a manageable ~50–100 port sample) that F-101's generator samples from when creating synthetic berths, so lengths/drafts/harbor sizes are drawn from real combinations instead of independently randomized (which can otherwise create physically implausible berths — e.g., a very short berth with an oil-terminal-depth channel).
- **`services/ingestion` (F-101, from I1)**: update the generator to optionally sample berth specs from `port_reference_specs.csv` when a "realistic mode" flag is set — keep the fully-synthetic mode as the default/fallback so nothing in I1 breaks.
- **`tests/test_forecast.py`**: add one test asserting the trained ETA model's error is meaningfully smaller than the pre-calibration naive baseline (this was already planned) — now also add a distribution sanity check: synthetic dwell times should fall within a plausible range of the real Mendeley reference distribution (e.g., median within the same order of magnitude), not compared value-for-value.

## 3. Practical Steps (run once, outside the main app)

```bash
# from a throwaway scripts/ folder, NOT part of the running app
mkdir -p data/external data/derived

# 1. Download the small Kaggle AIS slice and the World Port Index CSV manually
#    (Kaggle requires an account; NGA Pub 150 mirrors are public-domain CSV downloads)
#    Place raw files in data/external/ — this folder is gitignored, not committed.

# 2. Run a one-off preprocessing script (add this as scripts/prepare_reference_data.py)
python scripts/prepare_reference_data.py
#    → writes the three small derived CSVs into data/derived/
#    → data/derived/*.csv IS committed (small, deterministic, documents provenance)

# 3. feature_store.py reads only from data/derived/ at runtime — never touches
#    data/external/ directly, keeping the running app's memory footprint unaffected
#    by how large the original raw downloads were.
```

Document `scripts/prepare_reference_data.py`'s exact commands and source URLs in `src/README.md` so a judge (or teammate) can reproduce the derived files from scratch if needed — this is what keeps `docs/setup-guide.md` honest per its own rule about staying accurate.

## 4. Why This Approach, Not "Just Use Real Data"
Switching the whole pipeline to live/raw real data would (a) exceed the i3/8GB budget, (b) require paid AIS access the problem statement explicitly says is out of scope, and (c) make F-101's shock-event injection (crane outages, mega-ship surges) impossible to control for a repeatable demo. Using small, real reference distributions to **calibrate** the synthetic engine gets the credibility benefit — "our numbers are grounded in real port behavior" — without any of those costs. Say this explicitly in `docs/solution-overview.md` or the pitch deck; it's a design decision worth defending out loud, not a compromise to hide.
