# fairuz — synthetic computational research workspace

The current frontend runs all installed synthetic reference targets automatically. The entered virus name, type and envelope label the demo session; they do not change predictions or create genuine activity predictions for a custom virus. Results remain separate for each original reference target.

fairuz is a research demonstration built for the Leeds AI in Healthcare hackathon. It now performs real machine-learning inference on an explicitly artificial dataset. It does not assess real antiviral compatibility, safety or treatment efficacy.

## What runs

- Three fitted scikit-learn random-forest regressors score generated molecular structures in synthetic SARS-CoV-2/Mpro, influenza/neuraminidase and hepatitis-C/NS3-4A contexts.
- A ranked table reports predicted synthetic pIC50, its mathematical equivalent IC50 in nM, uncalibrated tree disagreement and nearest-training-structure Tanimoto similarity.
- Two open-source neural evidence models provide the explanation layer: MiniLM selects exact study statements for an extractive summary, and DistilBERT extracts answers from semantically retrieved study evidence. They run on-device in a Web Worker via Transformers.js, with source excerpts visible for verification. First use downloads approximately 25 MB for summary embeddings and 70 MB more for question answering. No API key or remote inference server is required. This is extractive AI, not a free-form conversational language model.
- Shortlists and audit logs remain in browser local storage. JSON/CSV exports include model identifiers, artifact hashes, units and synthetic-data flags.

## Dataset and methodology

`scripts/train_synthetic.py` generates 2,400 RDKit-valid canonical SMILES by combining six structural templates and substituents. Valid SMILES do not establish synthetic feasibility or availability. Eight physicochemical descriptors and 256 radius-2 Morgan bits form the input features. Three artificial descriptor-response functions with Gaussian noise generate synthetic pIC50 labels. These functions are software fixtures; they are not models of viral biology.

A seeded molecule-disjoint random split uses 1,680 fitting records, 360 validation structures and 360 unseen candidate structures. Each random forest has 64 trees and depth at most 10. Reported RMSE/MAE/R2 describe recovery of artificial labels only, not performance against biological assays. No scaffold, temporal, external, experimental or clinical validation is claimed.

`dist/inference.mjs` evaluates the exported fitted trees in the browser. Model JSON is checked against its SHA-256 before use. Higher predicted synthetic pIC50 ranks first; no arbitrary compatibility percentage is displayed. Equivalent synthetic IC50 = 10^(9 − pIC50) nM. Tree SD is disagreement, not a calibrated confidence interval. The low-similarity flag (<0.4 maximum Morgan Tanimoto) is a heuristic, not a validated applicability threshold.

No model supports arbitrary new viruses, sequences, or uploaded compounds. Unsupported target selection disables inference rather than inventing results. No active-learning or retraining occurs during screening. A real experimental feedback loop requires measured outcomes and a separate training protocol.

## Run and reproduce

The deployed application is buildless static HTML/CSS/ES modules. Serve `dist` over HTTP rather than opening index.html as a file:

    python -m http.server 8765 --bind 127.0.0.1 --directory dist

To reproduce training in an isolated Python environment:

    python -m venv .venv
    .venv/Scripts/python.exe -m pip install -r requirements-training.txt
    .venv/Scripts/python.exe scripts/train_synthetic.py

The seed and training artifacts are recorded in `data/model-card.json`; synthetic train/validation labels are in `data/synthetic-labels.json`. The public inference dataset includes fitting references and unseen candidates. No measured data, credentials or patient data are included.

With Node.js 22+:

    npm ci
    npm test

Model verification checks Python/JavaScript prediction agreement, artifact hashes, disjoint partitions, sorted rankings and the synthetic validation baseline. The optional `scripts/browser-check.mjs` expects the local HTTP server and Windows Edge at its documented executable path. It checks the user workflow, downloads the actual neural evidence models, and asserts that the summary and answer name the correct first-ranked compound and preserves the synthetic scope. Local tools and model caches are ignored under `.runtime`, `.venv` and `node_modules`.

## Provenance and credits

- Random forest: scikit-learn 1.9.1, BSD-3-Clause — https://scikit-learn.org/
- Chemistry descriptors: RDKit 2026.9.1, BSD-3-Clause — https://www.rdkit.org/
- Semantic retrieval: Xenova/all-MiniLM-L6-v2 (Apache-2.0). Extractive question answering: Xenova/distilbert-base-cased-distilled-squad (Apache-2.0). Model cards: https://huggingface.co/Xenova/all-MiniLM-L6-v2 and https://huggingface.co/Xenova/distilbert-base-cased-distilled-squad .
- Browser inference: @huggingface/transformers 3.8.1, Apache-2.0 — https://huggingface.co/docs/transformers.js/

All data are generated fixtures for this prototype. Do not use this synthetic study to nominate real treatments or claim compound activity.

Evidence selection uses cosine similarity between neural sentence embeddings. Question answering extracts a span from the retrieved source text. A retrieval score below 0.2 or answer-span score below 0.04 causes abstention; both are prototype heuristics, not calibrated confidence thresholds. Clinical-treatment questions are restricted to study-scope evidence. The assistant does not browse the web, retrieve patient data, or make therapeutic decisions.

## Assay display placeholders

The Assay placeholders tab and candidate detail views include deterministic fabricated IC50, EC50 and CC50 values in micromolar units, three simulated values per endpoint, sample SD and SI = CC50/EC50. They are independent UI fixtures, not model outputs, experimental replicates, validation data or biological evidence. Every record has dataOrigin=synthetic_placeholder, measurementStatus=not_performed and biologicalEvidence=false. Separate placeholder CSV exports preserve those flags and simulated values; JSON result reports embed the same records. The ranking model and its validation metrics are unaffected.


## Interactive molecular exploration

Selecting a compound now opens a docked 3D structure panel beside the results on large screens, or a large modal on smaller screens. Rotate by dragging or using arrow keys, zoom by scrolling/pinching or with the controls, reset with Home or Reset view, and switch between ball-and-stick and space-filling representations. Automatic rotation respects reduced motion and pauses during interaction, off screen, and when the page is hidden.

The existing dataset has SMILES but no 3D coordinates. Open Babel WebAssembly generates an illustrative MMFF94 conformer in a separate browser worker, and 3Dmol.js renders it. The selected compound's SMILES stays on the device; no new API or backend service is used. Libraries are pinned and vendored under `dist/vendor`, with licenses and archive hashes. About 9 MB loads on first use only. The detail renderer and three results-preview slots are reused across openings, and the shared in-memory conformer cache is capped at six entries. One worker prepares conformers sequentially.

Generated coordinates are not measured structures, protein-bound poses, verified stereochemical assignments, or evidence of activity. They never enter model inputs, rankings, scientific metrics, AI evidence, saved data, or exports. Failed parsing, identity/geometry checks, a timeout, or unavailable rendering produces an explicit unavailable state while retaining the original compound details. WebAssembly and WebGL are required for 3D.

With the local server running, `node scripts/viewer-check.mjs` exercises actual conformer generation, rotations, zoom/reset, representations, rapid switching, desktop/mobile modes, reduced motion, and failure states. It uses the same Windows Edge executable as the existing browser tests. Library provenance and licenses: `dist/vendor/README.md`.


## Top compounds reveal

Each successful screening (including the initial automatic demonstration) opens a results reveal once, showing up to three actual ranked compounds with their unchanged predicted activity. Search, filters, saving and pagination do not trigger it. Failed or partial screenings do not trigger it. Use **View Top 3** in the screening summary to reopen the latest completed run.

Each card has an interactive SMILES-derived conformer with drag/keyboard rotation, scroll/pinch/button zoom, reset, and optional automatic rotation. The cards share the existing Open Babel/3Dmol runtime and six-entry conformer cache; the original detailed viewer remains available through **View details**. **Explore all results** returns to the existing table. Closing or pressing Escape preserves results and restores keyboard focus. Smaller result sets adjust the title and card count; unavailable 3D structures retain the actual scores and navigation.

The synthetic-data limitation is visible inside the reveal. Generated conformers are illustrative and never enter screening inputs, rankings, AI evidence or exports. No new dependencies or backend services were added. With the server running, use `node scripts/top3-check.mjs` for reveal-specific completion, 3D interaction, navigation, boundary-case, failure, and responsive-layout checks. Existing browser tests dismiss the intentional reveal before continuing their original workflows.


## Workspaces and screening targets

Visible application branding is **fairuz**. Existing storage keys, export formats and filenames, repository/configuration identifiers, and model IDs are retained for compatibility.

Overview contains one simple setup: virus name, genome type and envelope structure, followed by Start AI Screening. There is no Screening Type or Target Protein selection. The frontend automatically runs the existing reference models and keeps their target-specific results separate. No arbitrary real-virus or sequence inference is supported.

Results, Saved compounds, Statistics and AI assistant have dedicated workspaces. Testing plan, AI performance and History remain accessible under secondary navigation. Navigation preserves the current screening, saved IDs and assistant state. The previous screening destination is an internal alias to Overview, without a separate sidebar page or duplicated setup.

## Statistics workspace

Statistics reads the latest completed run, independently of table search/filter settings. Five interactive charts show top predicted activity (horizontal bars), the activity distribution (histogram), activity versus tree disagreement (scatter), training similarity (bars), and the full ranking profile (two labelled line-series axes). Top 5/10/20 controls affect comparisons only. Exact original values are available in hover tooltips; keyboard arrows inspect points and Enter opens compound details. Accessible data tables provide the same compounds and values. Histogram ranges show counts and links to their contained compounds; series toggles and reset affect charts only.

Summary averages and bin counts are descriptive frontend calculations of the latest completed screening. Screening Priority preserves its prediction ranking without an invented probability or confidence percentage. Units, model uncertainty and training references follow the current model. Empty or missing metrics do not receive fabricated values.

Chart.js 4.6.1 (MIT), approximately 210 KB, is pinned under `dist/vendor/chartjs` with its license and hash. It loads only when Statistics has current results. No new API or backend service is used. The site remains buildless and has no build/lint script. Run `node scripts/statistics-check.mjs` with the local server running for exact chart-data comparisons, all supported targets, branding, exports, 3D links, chart controls, accessibility and responsive/empty-state coverage.

## Contributors

- Husain Haj Issa
- Ilyass jerrah
- Yusuf Khalaf
- Ziad Eid

## Simple hackathon screening demo

Overview has three essential fields: **Virus Name**, **Virus Type** (RNA, DNA or Not known), and **Virus Structure** (enveloped, non-enveloped or Not known). Click **Start AI Screening** once; no target selection or review confirmation is required. Optional notes, virus family, library size, local CSV import, descriptive data, reset and configuration preview are inside **Advanced Settings**. Neural summaries are optional and off by default to avoid delaying the demo with first-use model downloads.

The frontend discovers supported reference targets from the existing study metadata and evaluates each original model using unchanged compound features and inference. The current references are SARS-CoV-2 / Mpro, Influenza A / neuraminidase, and Hepatitis C / NS3/4A. Model files are SHA-256 verified before use. A fresh session retains a snapshot of the entered configuration. If a target fails, it is reported and excluded; successful targets remain available. If all fail, no new predictions are created.

These are **synthetic reference demonstrations**, not activity predictions against the user's custom virus. Virus details label the session and do not enter the compound feature vectors. Each target has its own ranking, Top 3, uncertainty and validation measurements. Scores are never pooled or used to fabricate an overall Top 3. Genuine new-virus prediction still requires measured target-specific data, a compatible validated model and a separately authorised integration.

The Top 3 popup opens once after a completed demo session. Its reference-target filter and the shared **View results by reference target** selector update the same active run. Results, Statistics, compound details, saved compounds, assistant evidence and exports use that target's original outputs and immutable session configuration. Filtering or changing pages does not reopen the popup. Manual View Top 3 reopens the current target. Each compound retains its exact SMILES-derived 3D structure, rotation, zoom and reset controls. Missing molecular data is never replaced with an unrelated molecule.

### Optional data and exports

Drafts are saved on the device. Additional property/value/unit rows and uploaded CSV data are descriptive metadata only; uploads never train a model. Configuration CSV supports `virus_name`, `virus_type`, `virus_structure`, `target_description`, `virus_family` and `compound_library`, with one data row. Alternatively import up to 20 rows with `property,value,unit`. Files are limited to 64 KB and previewed before applying. Protein-selection columns are no longer accepted. Clear configuration preserves saved compounds and screening history.

JSON and CSV result exports remain scoped to the active reference target. JSON includes both the original model identity and the entered session configuration, `mode: synthetic-reference-batch`, and `customVirusInference: false`. Configuration export is separate from result export and records reference-session completion without claiming custom-virus inference.

### Run and verify locally

From the repository root in PowerShell, serve the app:

    python -m http.server 8765 --bind 127.0.0.1 --directory dist

Open http://127.0.0.1:8765/ . Enter **Hackathon virus**, select **RNA** and **Enveloped**, and click **Start AI Screening**. The three existing reference models run automatically, followed by the Top 3 popup. Change the viewed reference target to inspect separate rankings and Statistics. Drag a molecule to rotate it, scroll or use the zoom buttons, and select Reset to restore its view. View Full Details opens the exact compound.

For the automated browser harness, serve the repository root in another terminal:

    python -m http.server 8766 --bind 127.0.0.1

Open http://127.0.0.1:8766/scripts/simple-demo-check.html . Existing check-page URLs redirect to this harness. It currently passes **94 checks** covering the removed selections, single-click start, all three original models, 30 Python/JavaScript parity fixtures, exact ranked predictions, separate target context, actual 3D rendering and controls, full compound details, Statistics, saved compounds, exports, and partial/all-target failures. Assistant evidence wiring is checked with a worker stub; neural model downloads are not part of this test. The site is buildless with no build script; checks load its real ES modules in the browser.
