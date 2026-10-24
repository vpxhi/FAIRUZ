import fs from 'node:fs';
import assert from 'node:assert/strict';
import {predictForest,rankCandidates,tanimoto} from '../dist/inference.mjs';
const study=JSON.parse(fs.readFileSync('dist/research-data.json','utf8'));
const fixtures=JSON.parse(fs.readFileSync('data/validation-fixtures.json','utf8'));
const labels=JSON.parse(fs.readFileSync('data/synthetic-labels.json','utf8'));
let tested=0;
for(const key of Object.keys(study.models)){
 const raw=fs.readFileSync(`dist/models/${key}.json`,'utf8');const model=JSON.parse(raw);
 const {createHash}=await import('node:crypto');assert.equal(createHash('sha256').update(raw).digest('hex'),study.models[key].artifactSha256);
 for(const f of fixtures[key]){const c=study.library.find(c=>c.id===f.id);const p=predictForest(model,c.features);assert.ok(Math.abs(p.mean-f.mean)<1e-6,`${key} ${f.id} mean mismatch`);assert.ok(Math.abs(p.sd-f.sd)<1e-6,`${key} ${f.id} SD mismatch`);tested++}
 const train=new Set(labels[key].train.map(x=>x[0]));const valid=new Set(labels[key].validation.map(x=>x[0]));assert.equal(train.size,1680);assert.equal(valid.size,360);for(const c of study.library){assert.ok(!train.has(c.id)&&!valid.has(c.id),'Candidate leaked into training/validation')}
 const ranked=rankCandidates(model,study.library,study.trainingReferences);assert.equal(ranked.length,360);for(let i=1;i<ranked.length;i++)assert.ok(ranked[i-1].prediction>=ranked[i].prediction);assert.ok(ranked.every(c=>Number.isFinite(c.treeSd)&&c.similarity>=0&&c.similarity<=1));assert.ok(study.models[key].rmse<study.models[key].baselineRmse,'Model should learn synthetic signal');
 console.log(`${key}: ranked 360 unseen compounds; top ${ranked[0].id}; synthetic pIC50 ${ranked[0].prediction.toFixed(3)}; RMSE ${study.models[key].rmse}`);
}
assert.equal(tanimoto([1,0,1],[1,1,0]),1/3);assert.throws(()=>predictForest(JSON.parse(fs.readFileSync('dist/models/sars.json')),[NaN]));
console.log(`PASS: ${tested} Python/JavaScript prediction parity checks; model hashes; disjoint partitions; ranking; uncertainty; validation baseline.`);
