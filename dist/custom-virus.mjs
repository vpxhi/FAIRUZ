// Metadata validation and compatibility checks only. No inference or training.
export const DRAFT_KEY='fairuz-custom-virus-draft-v1';
export const EMPTY_CONFIGURATION={virusName:'',genomeType:'',envelope:'',targetProtein:'',description:'',family:'',targetClass:'unspecified',assayContext:'unspecified',library:'all',additionalData:[]};
export function validateAdditionalData(rows=[]){
 if(!Array.isArray(rows)||rows.length>20)throw new Error('Add at most 20 descriptive data rows.');
 const clean=[],names=new Set();
 for(const [i,row] of rows.entries()){
  if(!row||['name','value','unit'].some(key=>typeof (row[key]??'')!=='string'))throw new Error(`Data row ${i+1} must contain text values.`);
  const item={name:row.name?.trim()||'',value:row.value?.trim()||'',unit:row.unit?.trim()||''};
  if(!item.name&&!item.value&&!item.unit)continue;
  if(!item.name||!item.value)throw new Error(`Enter a property name and value in data row ${i+1}.`);
  if(item.name.length>80||item.value.length>200||item.unit.length>30)throw new Error(`Data row ${i+1}: use up to 80 characters for the name, 200 for its value and 30 for units.`);
  const key=item.name.toLowerCase();if(names.has(key))throw new Error(`Duplicate property name: ${item.name}.`);names.add(key);clean.push(item);
 }
 return clean;
}
export function validateConfiguration(input){
 const c={...EMPTY_CONFIGURATION,...input};
 for(const key of ['virusName','targetProtein','description','family'])if(typeof c[key]!=='string')throw new Error('Enter text for the virus and target details.');else c[key]=c[key].trim();
 if(!c.virusName||c.virusName.length>100)throw new Error('Enter a virus name (up to 100 characters).');
 if(c.targetProtein.length>160)throw new Error('Target metadata must be under 160 characters.');
 if(!['RNA','DNA','unknown'].includes(c.genomeType))throw new Error('Choose RNA, DNA or Not known.');
 if(!['enveloped','non-enveloped','unknown'].includes(c.envelope))throw new Error('Choose an envelope structure or Not known.');
 if(c.description.length>1000||c.family.length>100)throw new Error('Keep the description under 1,000 characters and family under 100.');
 if(!['unspecified','protease','polymerase','surface-enzyme','other'].includes(c.targetClass))throw new Error('Choose a valid protein class.');
 if(!['unspecified','biochemical','cell-based','binding'].includes(c.assayContext))throw new Error('Choose a valid assay context.');
 if(!['all','focused'].includes(c.library))throw new Error('Choose an available compound library size.');
 c.additionalData=validateAdditionalData(c.additionalData);
 return Object.fromEntries(Object.keys(EMPTY_CONFIGURATION).map(key=>[key,c[key]]));
}
export function assessCompatibility(configuration,study){
 const c=validateConfiguration(configuration);
 // There is no approved measured-activity custom-target integration in this app.
 // Matching a name, category or synthetic model ID must never enable inference.
 return {supported:false,code:'NO_COMPATIBLE_CUSTOM_TARGET_MODEL',targetProtein:c.targetProtein,availableReferenceModels:Object.keys(study?.models||{}).length,reason:'No compatible custom-virus screening model is installed. The existing models learn generated activity labels, so they cannot establish compound activity against your virus.',descriptiveFields:['virusName','genomeType','envelope','targetProtein','description','family','targetClass','assayContext','additionalData'],predictiveVirusInputs:[],requirements:['Curated measured compound-target activity with consistent assay definitions.','A compatible target-specific model, or a model validated on entirely held-out targets.','An explicitly approved integration mapping supported inputs, units, validation and applicability limits.']};
}
export function configurationEvidence(c,compatibility){
 if(!c)return [];
 return [
  {id:'T01',text:`The configured virus name is ${c.virusName||'not entered'}. Genome type is ${c.genomeType||'not selected'} and envelope structure is ${c.envelope||'not selected'}. These are user-supplied descriptive properties, not predictive model inputs.`},
  {id:'T02',text:`Reference targets are selected automatically from the installed models. Virus family is ${c.family||'not supplied'}. Descriptive properties do not identify a compatible real-virus model.`},
  {id:'T03',text:`The user's description is: ${c.description||'No description supplied'}. This is unverified user-provided context, not experimental evidence.`},
  ...(c.additionalData||[]).filter(row=>row.name&&row.value).map((row,i)=>({id:'D'+String(i+1).padStart(2,'0'),text:`User-entered descriptive data: ${row.name} = ${row.value} ${row.unit||''}. This is unverified metadata, not an input to a validated custom-virus prediction model.`})),
  {id:'S01',scope:true,text:'No compounds have been ranked for this custom virus. No compatible model is installed, so there are no custom-virus activity predictions, confidence scores, success probabilities or experimentally supported recommendations.'},
  {id:'S02',scope:true,text:compatibility?.reason||'Custom-virus model compatibility has not yet been checked. Scientific metadata alone does not enable compound-activity prediction.'},
  {id:'M01',text:'The retained reference random forests use 264 compound features: eight physicochemical descriptors and 256 Morgan fingerprint bits. They predict artificial labels only. The separate categorical demonstration also uses generated labels. Neither is a validated custom-virus model.'},
  {id:'S03',scope:true,text:'Genuine custom-virus screening requires curated measured compound-target assay data, a compatible model, independent validation and a supported input integration. No real antiviral effectiveness, safety or treatment recommendation is established here.'}
 ];
}

export function referenceTargets(study){
 return Object.entries(study?.models||{}).filter(([key,m])=>/^[a-z0-9_-]+$/i.test(key)&&m&&typeof m.target==='string'&&typeof m.artifactSha256==='string').map(([key,model])=>({key,model}));
}
