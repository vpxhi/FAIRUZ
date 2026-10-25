import {nearestReferences} from './inference.mjs';
// Category names are real metadata terms. Label relationships below are invented fixtures.
export const TARGET_PARAMETERS=[
 {key:'family',id:'Family',name:'Virus family',description:'Taxonomic family supplied for this synthetic target.',options:[{value:'Coronaviridae',label:'Coronaviridae'},{value:'Orthomyxoviridae',label:'Orthomyxoviridae'},{value:'Flaviviridae',label:'Flaviviridae'}]},
 {key:'targetClass',id:'TargetClass',name:'Target protein class',description:'The type of protein being described; no sequence or structure is inferred.',options:[{value:'protease',label:'Protease'},{value:'polymerase',label:'Polymerase'},{value:'surface-enzyme',label:'Surface enzyme'}]},
 {key:'assayContext',id:'Assay',name:'Assay context',description:'The kind of evaluation being represented, not a report that an assay was performed.',options:[{value:'biochemical',label:'Biochemical enzyme assay'},{value:'cell-based',label:'Cell-based assay'},{value:'binding',label:'Binding assay'}]}
];
export const DEFAULT_TARGET={family:'Coronaviridae',targetClass:'protease',assayContext:'cell-based'};
export const VALIDATION_TARGET={...DEFAULT_TARGET};
export function validateTarget(target){
 if(!target||typeof target!=='object'||Array.isArray(target))throw new Error('Choose a virus family, target protein class and assay context.');
 for(const p of TARGET_PARAMETERS)if(!p.options.some(o=>o.value===target[p.key]))throw new Error(`Choose a supported ${p.name.toLowerCase()}.`);
 return Object.fromEntries(TARGET_PARAMETERS.map(p=>[p.key,target[p.key]]));
}
export function targetDescription(target){return TARGET_PARAMETERS.map(p=>`${p.name}: ${p.options.find(o=>o.value===target[p.key])?.label||'Unknown'}`).join(' / ');}
export const TRAIN_TARGETS=[];
for(const family of TARGET_PARAMETERS[0].options)for(const protein of TARGET_PARAMETERS[1].options)for(const assay of TARGET_PARAMETERS[2].options){
 const t={family:family.value,targetClass:protein.value,assayContext:assay.value};
 if(!TARGET_PARAMETERS.every(p=>t[p.key]===DEFAULT_TARGET[p.key]))TRAIN_TARGETS.push(t);
}
const SCALE=[500,5,150,5,10,10,1,5];
function compoundFeatures(c){
 if(!Array.isArray(c.features)||c.features.length<8||c.features.slice(0,8).some(v=>!Number.isFinite(v)))throw new Error('Compound descriptors are missing or invalid.');
 return c.features.slice(0,8).map((v,i)=>v/SCALE[i]);
}
function categoryIndicators(target){return TARGET_PARAMETERS.flatMap(p=>p.options.slice(0,-1).map(o=>o.value===target[p.key]?1:0));}
function design(c,target){const x=compoundFeatures(c),base=[1,...x,...x.map(v=>v*v)];return [1,...categoryIndicators(target)].flatMap(w=>base.map(v=>w*v));}
// The fixture imposes arbitrary category effects. They are not biological relationships.
export function syntheticLabel(c,target){
 const x=compoundFeatures(c),[family,protein,assay]=TARGET_PARAMETERS.map(p=>p.options.findIndex(o=>o.value===target[p.key]));
 const profiles=[4.5+1.8*x[0]-1.1*x[1]+.8*x[2]-.6*x[0]**2+.4*x[6],5.3-.9*x[0]+1.7*x[1]-.7*x[2]+.5*x[2]**2+.5*x[3],4.8+.5*x[0]-.8*x[1]+1.6*x[2]-.4*x[2]**2+.6*x[7]];
 const proteinEffect=[.3*x[3]-.2*x[5],.4*x[4]-.25*x[6],.35*x[7]-.1*x[2]][protein];
 const assayEffect=[-.2*x[1]+.1*x[2],.25*x[6]-.15*x[0],.1*x[1]-.2*x[3]][assay];
 let hash=2166136261;for(const ch of c.id)hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;
 return profiles[family]+proteinEffect+assayEffect+.12*Math.sin(3*x[1]+family*.4-protein*.2)+((hash%10001)/10000-.5)*.24;
}
function solve(matrix,rhs){
 const a=matrix.map((row,i)=>[...row,rhs[i]]),n=rhs.length;
 for(let k=0;k<n;k++){
  let pivot=k;for(let i=k+1;i<n;i++)if(Math.abs(a[i][k])>Math.abs(a[pivot][k]))pivot=i;
  [a[k],a[pivot]]=[a[pivot],a[k]];const divisor=a[k][k];if(Math.abs(divisor)<1e-12)throw new Error('Training matrix is singular.');
  for(let j=k;j<=n;j++)a[k][j]/=divisor;
  for(let i=0;i<n;i++)if(i!==k){const factor=a[i][k];for(let j=k;j<=n;j++)a[i][j]-=factor*a[k][j];}
 }
 return a.map(row=>row[n]);
}
export function splitCompounds(library){
 if(!Array.isArray(library)||library.length<360)throw new Error('This experiment requires 360 compounds.');
 const sorted=library.slice().sort((a,b)=>a.id.localeCompare(b.id));
 if(new Set(sorted.map(c=>c.id)).size!==sorted.length||new Set(sorted.map(c=>c.smiles)).size!==sorted.length)throw new Error('Compound identities must be unique.');
 return {train:sorted.slice(0,240),validation:sorted.slice(240,300),test:sorted.slice(300,360)};
}

export function trainJointModel(compounds){
 const n=119,gram=Array.from({length:n},()=>Array(n).fill(0)),rhs=Array(n).fill(0);let total=0,count=0;
 for(const c of compounds)for(const target of TRAIN_TARGETS){
  const x=design(c,target),y=syntheticLabel(c,target);total+=y;count++;
  for(let i=0;i<n;i++){if(!x[i])continue;rhs[i]+=x[i]*y;for(let j=0;j<=i;j++)if(x[j])gram[i][j]+=x[i]*x[j];}
 }
 for(let i=0;i<n;i++){for(let j=0;j<i;j++)gram[j][i]=gram[i][j];gram[i][i]+=.05;}
 return {id:'fairuz-categorical-target-ridge-v2',algorithm:'Categorical target-conditioned ridge regression',weights:solve(gram,rhs),baseline:total/count,ridgePenalty:.05,nTrain:count,nTrainingProfiles:TRAIN_TARGETS.length,trainingTargets:TRAIN_TARGETS,featureScale:SCALE,categoryEncoding:'Reference-category one-hot indicators with compound descriptor interactions; no ordinal category values',categorySchema:TARGET_PARAMETERS,synthetic:true};
}
export function predictJoint(model,c,target){return design(c,target).reduce((sum,v,i)=>sum+v*model.weights[i],0);}
export function isTrainingTarget(target){return TRAIN_TARGETS.some(t=>TARGET_PARAMETERS.every(p=>t[p.key]===target[p.key]));}
export function evaluateJoint(model,compounds,target){
 validateTarget(target);
 const rows=compounds.map(c=>({id:c.id,prediction:predictJoint(model,c,target),syntheticLabel:syntheticLabel(c,target)}));
 const mean=rows.reduce((s,c)=>s+c.syntheticLabel,0)/rows.length;
 const mse=rows.reduce((s,c)=>s+(c.prediction-c.syntheticLabel)**2,0)/rows.length,variance=rows.reduce((s,c)=>s+(c.syntheticLabel-mean)**2,0)/rows.length;
 return {rows:rows.sort((a,b)=>b.prediction-a.prediction||a.id.localeCompare(b.id)),metrics:{rmse:Math.sqrt(mse),mae:rows.reduce((s,c)=>s+Math.abs(c.prediction-c.syntheticLabel),0)/rows.length,r2:variance?1-mse/variance:null,baselineRmse:Math.sqrt(rows.reduce((s,c)=>s+(model.baseline-c.syntheticLabel)**2,0)/rows.length)}};
}
export function fitDisagreementModels(compounds){return Array.from({length:5},(_,fold)=>trainJointModel(compounds.filter((c,i)=>i%5!==fold)).weights);}
export function makeJointScreening(report,library){
 const parts=splitCompounds(library),target=validateTarget(report.profile.scientificDetails),byId=new Map(parts.test.map(c=>[c.id,c]));
 const references=parts.train.map(c=>({id:c.id,smiles:c.smiles,fingerprint:c.features.slice(8),labels:{joint:syntheticLabel(c,target)}}));
 const rows=report.test.rows.map((entry,i)=>{
  const c=byId.get(entry.id);if(!c)throw new Error('Unknown held-out compound.');
  const values=report.model.disagreementWeights.map(weights=>predictJoint({weights},c,target)),mean=values.reduce((a,b)=>a+b,0)/values.length;
  const sd=Math.sqrt(values.reduce((sum,v)=>sum+(v-mean)**2,0)/values.length),neighbors=nearestReferences(c.features,references);
  return {...c,...entry,rank:i+1,treeSd:sd,equivalentNm:null,similarity:neighbors[0]?.similarity??0,neighbors};
 });
 return {rows,metadata:{id:report.model.id,virus:report.profile.name,target:targetDescription(target),algorithm:report.model.algorithm,nTrain:report.model.nTrain,nTrainingCompounds:240,nTrainingProfiles:TRAIN_TARGETS.length,nValidation:60,nCandidates:60,...report.validation.metrics,units:report.scoreUnits,uncertainty:'SD across five ridge fits on deterministic training subsets; uncalibrated',parameterNames:TARGET_PARAMETERS.map(p=>p.name)}};
}
