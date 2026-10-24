# Fairouz

Interactive antiviral research dashboard for the Leeds AI in Healthcare hackathon.

Open dist/index.html in a browser. This static site requires no build or dependencies. It contains fictional compounds, arbitrary screening scores, a scripted assistant, persistent local shortlists, target selection, filtering, candidate detail views and JSON report export.

No DeepPurpose model, live AI, compound database or assay service is connected. Virus choices identify example protein targets only. It does not infer antiviral activity or provide treatment recommendations.

## Real integration

Deploy DeepPurpose separately in a Python environment; a static website cannot run its PyTorch inference stack. Use validated compound SMILES and verified protein sequences. Return checkpoint identifier, training endpoint, units, applicability assessment, calibrated uncertainty where available and evidence provenance. Evaluate held-out targets and compounds before presenting performance claims. Laboratory outcomes are necessary for an active learning loop; repeated predictions alone are not experimental trial and error.

Upstream: https://github.com/kexinhuang12345/DeepPurpose . This project links to the toolkit; it does not bundle or modify its code.
