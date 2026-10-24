# Fairouz — synthetic computational research workspace

Fairouz is a research demonstration built for the Leeds AI in Healthcare hackathon. It now performs real machine-learning inference on an explicitly artificial dataset. It does not assess real antiviral compatibility, safety or treatment efficacy.

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
- Workflow inspiration: https://github.com/kexinhuang12345/DeepPurpose . Fairouz does not bundle or run DeepPurpose code or checkpoints.

All data are generated fixtures for this prototype. Do not use this synthetic study to nominate real treatments or claim compound activity.

Evidence selection uses cosine similarity between neural sentence embeddings. Question answering extracts a span from the retrieved source text. A retrieval score below 0.2 or answer-span score below 0.04 causes abstention; both are prototype heuristics, not calibrated confidence thresholds. Clinical-treatment questions are restricted to study-scope evidence. The assistant does not browse the web, retrieve patient data, or make therapeutic decisions.
