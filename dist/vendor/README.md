# Molecular visualization dependencies

Loaded on demand when the completed-screening reveal or compound details open. All files are served locally; no compound or SMILES is sent to an external service. Approximately 8.9 MB on first use, normally browser-cached afterward. One shared worker prepares conformers sequentially; up to six accepted conformers are cached in memory. The detail viewer and three preview slots retain their renderers across openings. Previews load when visible, stop rotating when hidden, and clear their molecular models on close. The chemistry worker is released after 30 seconds idle.

- **3Dmol.js 2.5.5** (BSD): molecular WebGL rendering, spheres/cylinders, Jmol element colours, van der Waals atom radii, rotation and zoom. Source: https://github.com/3dmol/3Dmol.js/tree/2.5.5 . License: `3dmol/LICENSE.txt`.
- **Open Babel WebAssembly distributed in Kekule 1.0.4**: browser-only 3D conformer generation with the exposed MMFF94 generation wrapper. Open Babel is GPL v2; `openbabel/COPYING.txt` is included. Source and build bindings: https://github.com/partridgejiang/Kekule.js/tree/v1.0.4/src/_extras/OpenBabel ; upstream source: https://github.com/openbabel/openbabel . Kekule wrapper MIT license is included separately.
- `openbabel/conformer-worker.js` is fairuz's own integration, placed beside the engine because this packaged loader resolves its data file relative to the worker. The vendored engine files are unmodified. Exact npm archive URLs, sizes and SHA-256 hashes are in `sources.json`.

## Scientific scope

Coordinates are a generated, illustrative conformer of the existing SMILES, including explicit hydrogens. They are not measured coordinates, a docked pose, a lowest-energy guarantee, or evidence of target binding or antiviral activity. Screening results and exports never use these coordinates.

The worker requires successful parsing, matching Open Babel canonical SMILES before and after generation, finite coordinates, plausible bond lengths and no gross atom overlap. Failure or timeout produces an unavailable state. These checks do not establish physical accuracy or stability. Unspecified stereochemistry remains unspecified in the source data.

The frontend can be served using the existing buildless HTTP setup. WebGL and WebAssembly are required for 3D; original details remain usable when either is unavailable. No package installation or backend service is required.


## Statistics charts

**Chart.js 4.6.1** (MIT) provides the browser-only Statistics charts. Its pinned 210 KB UMD build and license are under `chartjs/`. Source archive: https://registry.npmjs.org/chart.js/-/chart.js-4.6.1.tgz ; project: https://github.com/chartjs/Chart.js . The file hashes and exact archive URL are recorded in `sources.json`.

This library loads only when a populated Statistics workspace is opened. It reads current screening values; histogram counts and summary averages are descriptive UI aggregates. No scientific model, probability model, screening calculation, dataset or exported schema is modified. Keyboard interactions and HTML data tables accompany the canvas charts.
