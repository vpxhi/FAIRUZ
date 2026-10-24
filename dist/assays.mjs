// Deterministic UI fixtures only. These are not model outputs or assay measurements.
export function makeAssayPlaceholder(compoundId,targetKey){
 let state=2166136261;for(const ch of `${targetKey}:${compoundId}:assay-fixture-v1`){state^=ch.charCodeAt(0);state=Math.imul(state,16777619)>>>0}
 const random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296};
 const replicate=centre=>{const values=Array.from({length:3},()=>Number((centre*(.88+.24*random())).toFixed(3)));const mean=values.reduce((a,b)=>a+b,0)/3;const sd=Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/2);return {replicates:values,mean,sd,unit:'uM',n:3}};
 const ic=10**(-1.3+2.7*random()),ec=Math.min(80,Math.max(.15,ic*(1.5+7*random()))),cc=12+168*random();
 const ic50=replicate(ic),ec50=replicate(ec),cc50=replicate(cc);
 return {version:'assay-fixture-v1',compoundId,targetKey,dataOrigin:'synthetic_placeholder',measurementStatus:'not_performed',biologicalEvidence:false,ic50,ec50,cc50,selectivityIndex:cc50.mean/ec50.mean,selectivityDefinition:'CC50 / EC50; dimensionless; placeholder only',note:'Generated display fixtures, independent of the ranking model. Replicates are simulated values, not experimental replicates.'};
}
export function assayCsv(rows){const quote=x=>'"'+String(x).replaceAll('"','""')+'"';return [['compound_id','target_context','data_origin','measurement_status','IC50_placeholder_uM','IC50_sample_SD_uM','EC50_placeholder_uM','EC50_sample_SD_uM','CC50_placeholder_uM','CC50_sample_SD_uM','selectivity_index_placeholder','simulated_values_per_endpoint','IC50_simulated_values_uM','EC50_simulated_values_uM','CC50_simulated_values_uM'].join(','),...rows.map(c=>{const p=c.assayPlaceholder;return [c.id,p.targetKey,p.dataOrigin,p.measurementStatus,p.ic50.mean,p.ic50.sd,p.ec50.mean,p.ec50.sd,p.cc50.mean,p.cc50.sd,p.selectivityIndex,3,p.ic50.replicates.join(';'),p.ec50.replicates.join(';'),p.cc50.replicates.join(';')].map(quote).join(',')})].join('\r\n')}
