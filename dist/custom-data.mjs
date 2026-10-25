import {validateAdditionalData} from './custom-virus.mjs';
export const CSV_LIMIT=65536;
const COLUMNS={virus_name:'virusName',virus_type:'genomeType',virus_structure:'envelope',target_description:'description',virus_family:'family',compound_library:'library'};
const MAX={virusName:100,targetProtein:160,description:1000,family:100};
const ENUMS={genomeType:['RNA','DNA','unknown'],envelope:['enveloped','non-enveloped','unknown'],targetClass:['unspecified','protease','polymerase','surface-enzyme','other'],assayContext:['unspecified','biochemical','cell-based','binding'],library:['all','focused']};
export function parseCsv(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>CSV_LIMIT)throw new Error('CSV files must be no larger than 64 KB.');
 if(text.includes('\0'))throw new Error('CSV must contain plain text.');
 text=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
 const rows=[];let row=[],cell='',quoted=false,closed=false;
 const field=()=>{row.push(cell);cell='';closed=false;};
 const line=()=>{field();if(row.some(value=>value.trim()))rows.push(row);row=[];if(rows.length>22)throw new Error('CSV may contain one configuration or at most 20 descriptive data rows.');};
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quoted){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=ch;continue;}
  if(ch===','){field();continue;}if(ch==='\n'){line();continue;}
  if(closed){if(ch===' '||ch==='\t')continue;throw new Error('Unexpected text after a quoted CSV value.');}
  if(ch==='"'){if(cell)throw new Error('CSV quotes must enclose an entire value.');quoted=true;}else cell+=ch;
 }
 if(quoted)throw new Error('CSV contains an unclosed quoted value.');
 if(cell||row.length||closed)line();
 if(rows.length<2)throw new Error('CSV needs a header row and at least one data row.');
 return rows;
}
export function parseConfigurationCsv(text){
 const rows=parseCsv(text),headers=rows.shift().map(h=>h.trim().toLowerCase().replace(/[ -]/g,'_'));
 if(headers.some(h=>!h)||new Set(headers).size!==headers.length)throw new Error('CSV headers must be non-empty and unique.');
 if(rows.some(row=>row.length!==headers.length))throw new Error('Each CSV row must have the same number of columns as the header.');
 const descriptive=headers.includes('property');
 if(descriptive){
  if(!headers.includes('value')||headers.some(h=>!['property','value','unit'].includes(h)))throw new Error('Descriptive CSV headers must be property,value,unit (unit is optional).');
  if(rows.length>20)throw new Error('Import at most 20 descriptive data rows.');
  const additionalData=validateAdditionalData(rows.map(row=>({name:row[headers.indexOf('property')],value:row[headers.indexOf('value')],unit:headers.includes('unit')?row[headers.indexOf('unit')]:''})));
  if(!additionalData.length)throw new Error('No descriptive data values were found.');
  return {kind:'descriptive',patch:{additionalData},preview:additionalData.map(r=>({field:r.name,value:r.value+(r.unit?' '+r.unit:'')}))};
 }
 if(headers.some(h=>!Object.hasOwn(COLUMNS,h)))throw new Error('Unsupported CSV columns. Import configuration metadata or use property,value,unit. Compound features and prediction files are not supported as custom-virus input.');
 if(rows.length!==1)throw new Error('A configuration CSV must contain exactly one data row.');
 const patch={};headers.forEach((h,i)=>{const key=COLUMNS[h],value=rows[0][i].trim();if(MAX[key]&&value.length>MAX[key])throw new Error(`${h} is too long.`);if(ENUMS[key]&&value&&!ENUMS[key].includes(value))throw new Error(`Invalid ${h}. Allowed values: ${ENUMS[key].join(', ')}.`);patch[key]=value;});
 return {kind:'configuration',patch,preview:headers.map(h=>({field:h,value:patch[COLUMNS[h]]||'(empty)'}))};
}
export const CSV_TEMPLATE='virus_name,virus_type,virus_structure,target_description,compound_library\r\nExample virus,RNA,enveloped,Descriptive configuration only,all\r\n';
