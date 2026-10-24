# fairuz — synthetic computational research workspace

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

Overview contains the only screening setup. Its dropdown offers exactly the original supported contexts: SARS-CoV-2 / Mpro (`sars`), Influenza A / neuraminidase (`flu`), and Hepatitis C / NS3/4A (`hcv`). The selected target card updates from the existing model metadata. No import or unsupported-virus choice is exposed. Model definitions, training artifacts and inference behavior are unchanged.

Results, Saved compounds, Statistics and AI assistant have dedicated workspaces. Testing plan, AI performance and History remain accessible under secondary navigation. Navigation preserves the current screening, saved IDs and assistant state. The previous screening destination is an internal alias to Overview, without a separate sidebar page or duplicated setup.

## Statistics workspace

Statistics reads the latest completed run, independently of table search/filter settings. Five interactive charts show top predicted activity (horizontal bars), the activity distribution (histogram), activity versus tree disagreement (scatter), training similarity (bars), and the full ranking profile (two labelled line-series axes). Top 5/10/20 controls affect comparisons only. Exact original values are available in hover tooltips; keyboard arrows inspect points and Enter opens compound details. Accessible data tables provide the same compounds and values. Histogram ranges show counts and links to their contained compounds; series toggles and reset affect charts only.

Summary averages and bin counts are descriptive frontend calculations. No model input, prediction, rank, AI evidence or export format is changed. Existing model validation metrics remain explicitly synthetic. Probability of success is labelled **Not available**; existing ranks provide Screening Priority without an invented probability or confidence percentage. Empty or missing metrics do not receive fabricated values.

Chart.js 4.6.1 (MIT), approximately 210 KB, is pinned under `dist/vendor/chartjs` with its license and hash. It loads only when Statistics has current results. No new API or backend service is used. The site remains buildless and has no build/lint script. Run `node scripts/statistics-check.mjs` with the local server running for exact chart-data comparisons, all supported targets, branding, exports, 3D links, chart controls, accessibility and responsive/empty-state coverage.
