export function predictForest(model,features){
  if(!Array.isArray(features)||features.length!==model.featureNames.length||features.some(v=>!Number.isFinite(v)))throw new Error('Invalid molecular feature vector');
  const values=model.trees.map(t=>{let n=0;while(t.l[n]!==-1)n=features[t.f[n]]<=t.t[n]?t.l[n]:t.r[n];return t.v[n]});
  const mean=values.reduce((a,b)=>a+b,0)/values.length;
  const sd=Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/values.length);
  return {mean,sd};
}
export function tanimoto(a,b){let intersection=0,union=0;for(let i=0;i<a.length;i++){if(a[i]||b[i])union++;if(a[i]&&b[i])intersection++}return union?intersection/union:0}
export function nearestReferences(features,references,n=3){const fp=features.slice(8);return references.map(r=>({id:r.id,smiles:r.smiles,labels:r.labels,similarity:tanimoto(fp,r.fingerprint)})).sort((a,b)=>b.similarity-a.similarity||a.id.localeCompare(b.id)).slice(0,n)}
export function rankCandidates(model,candidates,references){return candidates.map(c=>{const p=predictForest(model,c.features),neighbors=nearestReferences(c.features,references);return {...c,prediction:p.mean,treeSd:p.sd,equivalentNm:10**(9-p.mean),similarity:neighbors[0]?.similarity??0,neighbors}}).sort((a,b)=>b.prediction-a.prediction||a.id.localeCompare(b.id)).map((c,i)=>({...c,rank:i+1}))}
