/* Presentation-only analytics. Scientific model outputs and screening order are read-only. */
const section=document.createElement('section');section.id='statisticsSection';section.hidden=true;
section.innerHTML=`<div class="statistics-heading"><div><div class="eyebrow"><span class="live-dot"></span> THE SHAPE OF YOUR SCREENING</div><h1>Screening statistics.<br><em>Every prediction, in perspective.</em></h1><p>Explore the patterns, compare candidates, and keep the uncertainty in view.</p></div><span class="statistics-context">CURRENT RUN</span></div>
<div id="statisticsEmpty" class="panel statistics-empty"><span class="empty-chart-icon" aria-hidden="true">▥</span><h2>No Screening Results Yet</h2><p>Run a screening from the Overview page to explore compound statistics and visualisations.</p><button class="button light" id="statisticsOverview">Go to Overview <span aria-hidden="true">↗</span></button></div>
<div id="statisticsContent" hidden><div id="statisticsRun" class="statistics-run"></div><div class="statistics-metrics">
<article><span>Total Compounds Screened</span><strong id="statisticsCount">—</strong><small>Current completed screening</small></article>
<article><span>Highest Predicted Activity</span><strong id="statisticsHighest">—</strong><small>Synthetic pIC50 · not measured</small></article>
<article><span>Average Predicted Activity</span><strong id="statisticsMean">—</strong><small>Mean of available predictions</small></article>
<article><span>Average Model Uncertainty</span><strong id="statisticsUncertainty">—</strong><small>Tree disagreement · not confidence</small></article></div>
<div class="statistics-toolbar"><div><label for="statisticsTopN">Compare top compounds</label><select id="statisticsTopN"><option value="5">Top 5</option><option value="10" selected>Top 10</option><option value="20">Top 20</option></select></div><p>Chart controls never change the screening order.</p><button id="statisticsReset" class="button light">Reset chart filters</button></div>
<div class="statistics-chart-grid"></div>
<section class="panel statistics-reliability"><h2>Screening Priority</h2><p>In this demonstration, priority follows the existing activity ranking. Uncertainty and similarity are shown alongside it without creating a new score.</p><div class="statistics-table-wrap"><table><thead><tr><th>Rank</th><th>Compound</th><th>Predicted activity</th><th>Model uncertainty</th><th>Training similarity</th></tr></thead><tbody id="statisticsPriority"></tbody></table></div><p class="statistics-caveat">These predictions can help prioritise compounds for further investigation, but they do not establish the probability of real-world success. All structures and activity labels here are synthetic; no safety or efficacy conclusions can be drawn.</p></section>
<section class="panel statistics-insights"><div class="panel-heading"><div><span class="agent-icon" aria-hidden="true">⌁</span><h2>What Do These Results Tell Us?</h2></div><button class="button light" id="statisticsAskAI">Ask fairuz AI <span aria-hidden="true">↗</span></button></div><p class="muted">Plain-English observations calculated from this run. No new AI system or biological interpretation.</p><div id="statisticsObservations"></div></section>
<p class="statistics-footnote">Source: the current screening results and its existing model card. Summary averages and histogram counts are descriptive frontend aggregates, not new model outputs.</p></div><div class="visually-hidden" id="statisticsAnnounce" role="status" aria-live="polite"></div>`;
document.querySelector('main footer').before(section);
const $=selector=>section.querySelector(selector);
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=Number.isFinite;
const format=value=>finite(value)?value.toFixed(3):'Not available';
let latest=null,visible=false,callbacks={},libraryPromise,version=0,selectedBin=null;
const charts=new Map(),series={scatter:[true,true],profile:[true,true]};
const specs=[
 ['activity','Top 10 Compounds',"Compare the AI’s highest-ranked predictions.",'Horizontal bar chart'],
 ['histogram','Activity Score Distribution',"See how the AI’s predictions vary across the screened compounds.",'Histogram'],
 ['scatter','Activity vs Uncertainty',"Explore predicted activity alongside disagreement between the model’s trees.",'Scatter plot'],
 ['similarity','Similarity to Training Data',"See how closely the compounds resemble structures the AI encountered during training.",'Bar chart'],
 ['profile','Prediction by Screening Rank','Follow existing activity predictions and tree disagreement across the full ranking. The two series use separate labelled axes.','Line chart']
];
for(const [key,title,description,type] of specs){
 const card=document.createElement('article');card.className='panel statistics-chart-card';card.dataset.chart=key;
 card.innerHTML=`<div class="statistics-chart-top"><h2 id="statisticsTitle-${key}">${title}</h2><span class="tag">${type}</span></div><p class="statistics-chart-description">${description}</p><div class="statistics-series" data-series-for="${key}"></div><div class="statistics-chart-box"><canvas id="statisticsChart-${key}" role="img" tabindex="0" aria-label="${title}. Arrow keys explore values; Enter opens compound details or a histogram range." aria-keyshortcuts="ArrowLeft ArrowRight Enter"></canvas><p class="statistics-chart-status" role="status">Chart loads when Statistics is opened.</p></div><p class="statistics-chart-note"></p><details class="learn-more statistics-chart-data"><summary>View data &amp; keyboard-accessible compound links</summary><div class="statistics-table-wrap"><table><thead></thead><tbody></tbody></table></div></details>`;
 $('.statistics-chart-grid').append(card);
 const canvas=card.querySelector('canvas');canvas.addEventListener('keydown',event=>chartKey(key,event));
}
$('[data-chart=scatter] .statistics-chart-note').textContent='Tree SD measures disagreement among trees. It is not a calibrated probability or a confidence interval. Highlighted diamonds identify the top three ranks.';
$('[data-chart=similarity] .statistics-chart-note').textContent='Training similarity is the existing Morgan Tanimoto value (0–1). Structural resemblance does not prove biological activity or prediction reliability.';
$('[data-chart=profile] .statistics-chart-note').textContent='Lines connect recorded values in rank order; no extra predictions or confidence bands are generated. Use the legend controls to show or hide either series.';
$('[data-chart=activity] .statistics-chart-note').textContent='Predicted activity uses the original synthetic pIC50. Higher values rank first; this is not measured antiviral activity.';
for(const [key,labels] of [['scatter',['Other compounds','Top 3 ranks']],['profile',['Predicted activity','Model disagreement']]]){
 const group=$(`[data-series-for=${key}]`);
 labels.forEach((label,i)=>{const item=document.createElement('label');item.innerHTML=`<input type="checkbox" data-chart-series="${key}" data-index="${i}" checked> ${label}`;group.append(item)});
}
export function configureStatistics(options){callbacks=options}
$('#statisticsOverview').onclick=()=>callbacks.onOverview?.();$('#statisticsAskAI').onclick=()=>callbacks.onAssistant?.();
$('#statisticsTopN').onchange=()=>render();
$('#statisticsReset').onclick=()=>{selectedBin=null;$('#statisticsTopN').value='10';for(const key of Object.keys(series))series[key]=[true,true];section.querySelectorAll('[data-chart-series]').forEach(el=>el.checked=true);render()};
section.addEventListener('change',event=>{const input=event.target.closest('[data-chart-series]');if(!input)return;series[input.dataset.chartSeries][Number(input.dataset.index)]=input.checked;const chart=charts.get(input.dataset.chartSeries);if(chart){chart.setDatasetVisibility(Number(input.dataset.index),input.checked);chart.update('none')}});
function loadChartLibrary(){
 if(globalThis.Chart)return Promise.resolve(globalThis.Chart);
 if(!libraryPromise)libraryPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('./vendor/chartjs/chart.umd.js',import.meta.url).href;script.onload=()=>resolve(globalThis.Chart);script.onerror=()=>{script.remove();libraryPromise=null;reject(new Error('The local chart library could not load.'))};document.head.append(script)});
 return libraryPromise;
}
function average(rows,key){const values=rows.map(c=>c[key]).filter(finite);return values.length?values.reduce((a,b)=>a+b,0)/values.length:null}
function histogram(rows){
 const values=rows.filter(c=>finite(c.prediction));if(!values.length)return [];
 let low=Math.min(...values.map(c=>c.prediction)),high=Math.max(...values.map(c=>c.prediction));if(low===high){low-=.5;high+=.5}
 const width=(high-low)/10;
 const bins=Array.from({length:10},(_,i)=>({low:low+i*width,high:low+(i+1)*width,compounds:[]}));
 for(const c of values){const index=Math.max(0,Math.min(9,Math.floor((c.prediction-low)/width)));bins[index].compounds.push(c)}
 return bins;
}
function compoundButton(c){return `<button class="compound-link" data-detail="${escape(c.id)}"><strong>${escape(c.id)}</strong></button>`}
function table(key,heads,rows){const node=$(`[data-chart=${key}] .statistics-chart-data`);node.querySelector('thead').innerHTML='<tr>'+heads.map(x=>`<th scope="col">${escape(x)}</th>`).join('')+'</tr>';node.querySelector('tbody').innerHTML=rows.map(c=>'<tr>'+c.map(value=>`<td>${value}</td>`).join('')+'</tr>').join('')||'<tr><td>No values available for this chart.</td></tr>'}
function summaries(){
 const rows=latest.rows,top=rows.slice(0,Number($('#statisticsTopN').value)),predictions=rows.filter(c=>finite(c.prediction));
 $('#statisticsCount').textContent=String(rows.length);$('#statisticsCount').parentElement.title=`${rows.length} compounds in the current completed run. Chart filters do not change this count.`;
 const highest=predictions.length?Math.max(...predictions.map(c=>c.prediction)):null,mean=average(rows,'prediction'),uncertainty=average(rows,'treeSd');
 for(const [id,value,text] of [['statisticsHighest',highest,'Highest existing synthetic pIC50; not a measured effect'],['statisticsMean',mean,'Arithmetic mean of available predicted synthetic pIC50 values'],['statisticsUncertainty',uncertainty,'Arithmetic mean of available tree SD values; model disagreement, not confidence']]){const element=$('#'+id);element.textContent=format(value);element.parentElement.title=`${text}. Exact value: ${value??'not available'}.`;element.parentElement.tabIndex=0;element.parentElement.setAttribute('aria-label',element.parentElement.title)}
 $('#statisticsCount').parentElement.tabIndex=0;
 $('#statisticsRun').textContent=`${latest.run.virus} / ${latest.run.target} · ${rows.length} compounds · ${latest.run.id}`;
 $('#statisticsPriority').innerHTML=top.map(c=>`<tr><td>#${c.rank}</td><td>${compoundButton(c)}</td><td>${format(c.prediction)}</td><td>${format(c.treeSd)}</td><td>${format(c.similarity)}</td></tr>`).join('');
 const bins=histogram(rows),mode=bins.reduce((best,b)=>!best||b.compounds.length>best.compounds.length?b:best,null),first=rows[0],second=rows[1],observations=[];
 if(first&&finite(first.prediction)){observations.push(`<strong>${escape(first.id)} ranks first.</strong> Its predicted synthetic activity is ${format(first.prediction)} pIC50${second&&finite(second.prediction)?`, ${format(first.prediction-second.prediction)} above the next candidate`:''}. This is a model ranking, not evidence of antiviral effectiveness.`)}
 if(first&&finite(first.treeSd)&&finite(uncertainty)){const comparison=first.treeSd>uncertainty?'higher than':first.treeSd<uncertainty?'lower than':'equal to';observations.push(`<strong>Read the disagreement alongside the rank.</strong> The first candidate’s tree SD is ${format(first.treeSd)}, ${comparison} the run average of ${format(uncertainty)}. This does not give a probability of success.`)}
 if(mode)observations.push(`<strong>The most populated score range.</strong> ${mode.compounds.length} of ${predictions.length} available predictions fall between ${mode.low.toFixed(3)} and ${mode.high.toFixed(3)} synthetic pIC50.`);
 $('#statisticsObservations').innerHTML=observations.map((text,i)=>`<article><span>${String(i+1).padStart(2,'0')}</span><p>${text}</p></article>`).join('')||'<p>No numerical observations are available for this run.</p>';
 $('#statisticsTitle-activity').textContent=`Top ${top.length} Compounds`;
 table('activity',['Rank','Compound','Predicted activity (synthetic pIC50)'],top.map(c=>['#'+c.rank,compoundButton(c),format(c.prediction)]));
 table('similarity',['Rank','Compound','Training similarity (Tanimoto)'],top.map(c=>['#'+c.rank,compoundButton(c),format(c.similarity)]));
 table('scatter',['Compound','Predicted activity','Model disagreement (tree SD)'],rows.map(c=>[compoundButton(c),format(c.prediction),format(c.treeSd)]));
 table('profile',['Rank','Compound','Predicted activity','Tree SD'],rows.map(c=>['#'+c.rank,compoundButton(c),format(c.prediction),format(c.treeSd)]));
 table('histogram',['Synthetic pIC50 range','Count'],bins.map((b,i)=>[`${b.low} ≤ value ${i===bins.length-1?'≤':'<'} ${b.high}`,String(b.compounds.length)]));
 $(`[data-chart=histogram] .statistics-chart-note`).textContent=`${predictions.length} available activity values across ${rows.length} screened compounds. Ranges include the lower boundary; only the final range includes its upper boundary.`;
 return {rows,top,bins};
}
function describe(chart,datasetIndex,index){const dataset=chart.data.datasets[datasetIndex],raw=dataset.data[index],compound=raw?.compound||dataset.compounds?.[index];if(compound)return chart.config.type==='scatter'?`${compound.id} · synthetic pIC50: ${compound.prediction}; tree SD: ${compound.treeSd}`:`${compound.id} · ${dataset.label}: ${raw&&typeof raw==='object'?raw.y:raw}`;const bin=dataset.bins?.[index];return bin?`${bin.low} to ${bin.high} synthetic pIC50: ${bin.compounds.length} compounds`:String(raw)}
function selected(chart,datasetIndex,index){const dataset=chart.data.datasets[datasetIndex],raw=dataset.data[index],compound=raw?.compound||dataset.compounds?.[index];if(compound)callbacks.onDetails?.(compound.id);else if(dataset.bins){selectedBin=index;const bin=dataset.bins[index];let node=$('#statisticsBinSelection');if(!node){node=document.createElement('div');node.id='statisticsBinSelection';node.className='statistics-bin-selection';$('[data-chart=histogram] .statistics-chart-note').after(node)}node.innerHTML=`<p>${bin.compounds.length} compounds in this range (${bin.low.toFixed(3)}–${bin.high.toFixed(3)} synthetic pIC50).</p><div>${bin.compounds.slice(0,5).map(compoundButton).join('')}</div><small>${bin.compounds.length>5?'Showing links to the first five by existing rank. ':''}Reset chart filters to clear this selection.</small>`;chart.data.datasets[0].backgroundColor=dataset.bins.map((_,i)=>i===index?'#a2edc0':'#3c9b8f');chart.update('none')}}
function chartKey(key,event){
 if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(event.key))return;
 const chart=charts.get(key);if(!chart)return;
 const items=[];chart.data.datasets.forEach((dataset,datasetIndex)=>{if(chart.isDatasetVisible(datasetIndex))dataset.data.forEach((raw,index)=>{if(raw!==null&&!(typeof raw==='object'&&raw.y===null))items.push({datasetIndex,index})})});if(!items.length)return;
 event.preventDefault();let index=chart.$keyboardIndex??-1;
 if(['Enter',' '].includes(event.key)){const item=items[Math.max(0,index)];selected(chart,item.datasetIndex,item.index);return}
 index=(index+(event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1)+items.length)%items.length;chart.$keyboardIndex=index;const item=items[index],element=chart.getDatasetMeta(item.datasetIndex).data[item.index];
 chart.setActiveElements([item]);chart.tooltip?.setActiveElements([item],element.getCenterPoint());chart.update('none');$('#statisticsAnnounce').textContent=describe(chart,item.datasetIndex,item.index);
}
function axis(title,extra={}){return {title:{display:true,text:title,color:'#aec8b6',font:{size:11}},ticks:{color:'#a4bcad',font:{size:10}},grid:{color:'#35503e55'},border:{color:'#45614d'},...extra}}
function destroy(){charts.forEach(chart=>chart.destroy());charts.clear()}
async function render(){
 const token=++version;if(!latest?.rows.length||!visible)return;
 const {rows,top,bins}=summaries();destroy();$('#statisticsBinSelection')?.remove();
 section.querySelectorAll('.statistics-chart-status').forEach(node=>{node.hidden=false;node.textContent='Loading interactive chart…'});
 try{
  const Chart=await loadChartLibrary();if(token!==version||!visible)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function create(key,type,data,extra={}){
   const canvas=$('#statisticsChart-'+key),card=canvas.closest('.statistics-chart-card');const hasValues=data.datasets.some(d=>d.data.some(value=>finite(value)||value&&typeof value==='object'&&finite(value.y)));
   if(!hasValues){card.querySelector('.statistics-chart-status').textContent='This metric is unavailable for the current results. See available data below.';return}
   const options={responsive:true,maintainAspectRatio:false,devicePixelRatio:Math.min(devicePixelRatio||1,1.5),animation:reduced?false:{duration:180},interaction:{mode:'nearest',intersect:true},plugins:{legend:{display:false},tooltip:{backgroundColor:'#14291f',borderColor:'#658a70',borderWidth:1,titleColor:'#e6f7eb',bodyColor:'#c9e4d1',padding:12,callbacks:{title:items=>{const item=items[0],c=item?.raw?.compound||item?.dataset.compounds?.[item?.dataIndex];return c?c.id:'Screening values'},label:context=>describe(context.chart,context.datasetIndex,context.dataIndex)}}},onHover:(event,items,chart)=>{chart.canvas.style.cursor=items.length?'pointer':'default'},onClick:(event,items,chart)=>{if(items[0])selected(chart,items[0].datasetIndex,items[0].index)},...extra};
   const chart=new Chart(canvas,{type,data,options});charts.set(key,chart);card.querySelector('.statistics-chart-status').hidden=true;
   if(series[key])series[key].forEach((shown,i)=>{const available=data.datasets[i].data.some(value=>finite(value)||value&&typeof value==='object'&&finite(value.y));chart.setDatasetVisibility(i,shown&&available);const input=$(`[data-chart-series=${key}][data-index="${i}"]`);input.disabled=!available;input.checked=shown&&available});chart.update(reduced?'none':undefined);
  }
  const activeTop=top.filter(c=>finite(c.prediction));
  create('activity','bar',{labels:activeTop.map(c=>c.id),datasets:[{label:'Predicted synthetic pIC50',compounds:activeTop,data:activeTop.map(c=>c.prediction),backgroundColor:activeTop.map(c=>c.rank===1?'#9be8b2':'#46a17b'),borderRadius:5,borderSkipped:false}]},{indexAxis:'y',scales:{x:axis('Predicted activity (synthetic pIC50)',{beginAtZero:true}),y:axis('Compound ID',{grid:{display:false}})}});
  create('histogram','bar',{labels:bins.map(b=>`${b.low.toFixed(2)}–${b.high.toFixed(2)}`),datasets:[{label:'Compounds',bins,data:bins.map(b=>b.compounds.length),backgroundColor:bins.map((_,i)=>i===selectedBin?'#a2edc0':'#3c9b8f'),borderRadius:4,barPercentage:.98,categoryPercentage:1}]},{scales:{x:axis('Predicted activity ranges (synthetic pIC50)',{ticks:{color:'#a4bcad',font:{size:9},maxRotation:40}}),y:axis('Number of compounds',{beginAtZero:true,ticks:{color:'#a4bcad',precision:0}})}});
  const points=rows.filter(c=>finite(c.prediction)&&finite(c.treeSd));
  create('scatter','scatter',{datasets:[{label:'Other compounds · synthetic pIC50',data:points.filter(c=>c.rank>3).map(c=>({x:c.treeSd,y:c.prediction,compound:c})),pointRadius:3.5,pointHoverRadius:7,backgroundColor:'#45a69a99',borderColor:'#71cabb55',borderWidth:1},{label:'Top 3 ranks · synthetic pIC50',data:points.filter(c=>c.rank<=3).map(c=>({x:c.treeSd,y:c.prediction,compound:c})),pointStyle:'rectRot',pointRadius:7,pointHoverRadius:10,backgroundColor:'#b5e7a3',borderColor:'#f0ffe4',borderWidth:1}]},{scales:{x:axis('Model disagreement (tree SD)',{beginAtZero:true}),y:axis('Predicted activity (synthetic pIC50)')}});
  const similar=top.filter(c=>finite(c.similarity));
  create('similarity','bar',{labels:similar.map(c=>c.id),datasets:[{label:'Training Tanimoto similarity',compounds:similar,data:similar.map(c=>c.similarity),backgroundColor:similar.map(c=>c.rank===1?'#92d9dc':'#458f9f'),borderRadius:5,borderSkipped:false}]},{scales:{x:axis('Compound ID',{grid:{display:false}}),y:axis('Training similarity (0–1)',{min:0,max:1})}});
  create('profile','line',{datasets:[{label:'Predicted synthetic pIC50',data:rows.map(c=>({x:c.rank,y:finite(c.prediction)?c.prediction:null,compound:c})),borderColor:'#85d9a4',backgroundColor:'#85d9a4',pointRadius:0,pointHitRadius:8,pointHoverRadius:5,borderWidth:2,tension:0,spanGaps:false,yAxisID:'y'},{label:'Tree SD · model disagreement',data:rows.map(c=>({x:c.rank,y:finite(c.treeSd)?c.treeSd:null,compound:c})),borderColor:'#62b8ca',backgroundColor:'#62b8ca',pointRadius:0,pointHitRadius:7,pointHoverRadius:5,borderWidth:1.5,tension:0,spanGaps:false,yAxisID:'uncertainty'}]},{scales:{x:axis('Existing screening rank',{type:'linear'}),y:axis('Predicted synthetic pIC50',{position:'left'}),uncertainty:axis('Tree SD · separate scale',{position:'right',beginAtZero:true,grid:{drawOnChartArea:false}})}});
 }catch(error){if(token!==version)return;section.querySelectorAll('.statistics-chart-status').forEach(node=>{node.hidden=false;node.textContent='Interactive chart unavailable. The exact data remains available below.'})}
}
export function updateStatistics(run,rows){latest=run&&Array.isArray(rows)?{run,rows:rows.slice()}:null;selectedBin=null;$('#statisticsEmpty').hidden=!!latest?.rows.length;$('#statisticsContent').hidden=!latest?.rows.length;if(!latest?.rows.length){version++;destroy()}if(visible)render()}
export function showStatistics(){visible=true;$('#statisticsEmpty').hidden=!!latest?.rows.length;$('#statisticsContent').hidden=!latest?.rows.length;if(latest?.rows.length)render()}
export function hideStatistics(){visible=false;version++;destroy()}
