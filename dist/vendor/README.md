# Molecular visualization dependencies

Loaded only when a compound is opened. All files are served locally; no compound or SMILES is sent to an external service. Approximately 8.9 MB on first use, normally browser-cached afterward. Only the selected molecule is rendered; up to six accepted conformers are kept in memory.

- **3Dmol.js 2.5.5** (BSD): molecular WebGL rendering, spheres/cylinders, Jmol element colours, van der Waals atom radii, rotation and zoom. Source: https://github.com/3dmol/3Dmol.js/tree/2.5.5 . License: `3dmol/LICENSE.txt`.
- **Open Babel WebAssembly distributed in Kekule 1.0.4**: browser-only 3D conformer generation with the exposed MMFF94 generation wrapper. Open Babel is GPL v2; `openbabel/COPYING.txt` is included. Source and build bindings: https://github.com/partridgejiang/Kekule.js/tree/v1.0.4/src/_extras/OpenBabel ; upstream source: https://github.com/openbabel/openbabel . Kekule wrapper MIT license is included separately.
- `openbabel/conformer-worker.js` is Fairouz's own integration, placed beside the engine because this packaged loader resolves its data file relative to the worker. The vendored engine files are unmodified. Exact npm archive URLs, sizes and SHA-256 hashes are in `sources.json`.

## Scientific scope

Coordinates are a generated, illustrative conformer of the existing SMILES, including explicit hydrogens. They are not measured coordinates, a docked pose, a lowest-energy guarantee, or evidence of target binding or antiviral activity. Screening results and exports never use these coordinates.

The worker requires successful parsing, matching Open Babel canonical SMILES before and after generation, finite coordinates, plausible bond lengths and no gross atom overlap. Failure or timeout produces an unavailable state. These checks do not establish physical accuracy or stability. Unspecified stereochemistry remains unspecified in the source data.

The frontend can be served using the existing buildless HTTP setup. WebGL and WebAssembly are required for 3D; original details remain usable when either is unavailable. No package installation or backend service is required.
