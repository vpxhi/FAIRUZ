import {MolecularPreview} from './molecular-runtime.mjs';
const manual=document.querySelector('#viewTop3');
const popup=document.createElement('dialog');popup.id='top3Results';popup.className='top3-dialog';popup.setAttribute('aria-labelledby','top3Heading');popup.setAttribute('aria-describedby','top3Description');
popup.innerHTML=`<header class="top3-heading"><div><div class="eyebrow"><span class="live-dot"></span> SCREENING COMPLETE</div><h2 id="top3Heading">Your Top 3 Compounds</h2></div><button class="top3-close" data-top3-close aria-label="Close top compounds">×</button></header><div class="top3-body"><p id="top3Description">Here are the highest-ranked compounds from your AI screening.</p><p class="top3-explanation">These compounds received the highest predictions from the AI model in this demonstration.</p><div class="top3-notice"><strong>Synthetic demonstration</strong> These predictions are not experimentally verified antiviral activity and do not establish clinical effectiveness or safety.</div><p class="top3-context"></p><label class="top3-target-filter" hidden>View reference target<select id="top3ReferenceTarget"></select></label><div class="top3-cards"></div><p class="top3-structure-note">Structures show possible conformers generated from each compound’s SMILES, not measured or protein-bound shapes. Unspecified stereochemistry is illustrative.</p></div><div class="top3-footer"><span>Curiosity starts here. Explore the evidence next.</span><div><button class="button light" data-top3-close>Close</button><button class="button primary" id="top3Explore">Explore all results <span aria-hidden="true">↗</span></button></div></div>`;
document.body.append(popup);
const slots=[0,1,2].map(i=>new MolecularPreview(i));
let latest, callbacks={}, lastAutomaticRun, returnFocus, navigating=false;
export function configureTopResults(options){callbacks=options}
function clean(){slots.forEach(slot=>slot.deactivate());document.body.classList.remove('top3-open')}
function dismiss(forNavigation=false){navigating=forNavigation;clean();if(popup.open)popup.close()}
popup.addEventListener('close',()=>{if(popup.open)return;clean();if(!navigating){const target=returnFocus?.isConnected&&!returnFocus.disabled?returnFocus:manual;target.focus({preventScroll:true})}navigating=false});
popup.addEventListener('cancel',()=>{navigating=false;clean()});
popup.addEventListener('click',event=>{
  if(event.target.closest('[data-top3-close]'))dismiss();
  const detail=event.target.closest('[data-top3-detail]');
  if(detail){const id=detail.dataset.top3Detail;dismiss(true);callbacks.onDetails?.(id)}
  if(event.target===popup){const rect=popup.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dismiss()}
});
popup.querySelector('#top3Explore').onclick=()=>{dismiss(true);callbacks.onExplore?.()};
function show(){
  if(!latest?.compounds.length)return false;
  if(popup.open)dismiss(true);
  const detail=document.querySelector('#detail');if(detail?.open)detail.close();
  returnFocus=document.activeElement instanceof HTMLElement&&document.activeElement!==document.body&&!document.activeElement.disabled?document.activeElement:manual;
  const count=latest.compounds.length;
  popup.dataset.runId=latest.id;popup.dataset.resultCount=String(count);
  popup.querySelector('#top3Heading').textContent=latest.customName?`Top ${count} ${count===1?'Compound':'Compounds'} \u2014 ${latest.customName}`:count===1?'Your Top Compound':`Your Top ${count} Compounds`;
  popup.querySelector('#top3Description').textContent=count===3?'These are the three highest-ranked compounds identified by the current AI screening model.':`These are the ${count} highest-ranked ${count===1?'compound':'compounds'} identified by the current AI screening model.`;
  popup.querySelector('.top3-context').textContent=`${latest.virus} / ${latest.target||'Reference target'} · ${latest.candidateCount} compounds screened · ${latest.id}`;
  const filter=popup.querySelector('.top3-target-filter'),select=popup.querySelector('#top3ReferenceTarget');filter.hidden=latest.availableTargets.length<2;select.replaceChildren();for(const target of latest.availableTargets){const option=document.createElement('option');option.value=target.key;option.textContent=target.label;select.append(option);}select.value=latest.key||'';
  popup.querySelector('.top3-explanation').textContent=latest.availableTargets.length?'Top compounds for the selected synthetic reference target. Other targets have separate rankings; your custom virus name is a session label.':'These compounds received the highest predictions from the AI model in this demonstration.';
  const cards=popup.querySelector('.top3-cards');cards.replaceChildren();
  for(const [index,compound] of latest.compounds.entries()){
    const card=document.createElement('article');card.className='top3-card';card.dataset.compoundId=compound.id;card.style.setProperty('--reveal-delay',`${index*70}ms`);
    card.innerHTML=`<div class="top3-card-heading"><span class="top3-rank"></span><span class="top3-rank-label"></span></div><h3 class="top3-compound-name"></h3><div class="top3-molecule-slot"></div><div class="top3-score"><div><span>Predicted activity</span><strong></strong></div><small>Synthetic pIC50<br>Higher values rank first.</small></div><p class="top3-score-note">A model prediction from artificial data, not a measured antiviral effect.</p><div class="top3-uncertainty"></div><button class="button light top3-details">View Full Details <span aria-hidden="true">↗</span></button>`;
    card.querySelector('.top3-rank').textContent=`#${compound.rank}`;
    card.querySelector('.top3-rank-label').textContent=['Highest ranked','Second highest','Third highest'][compound.rank-1]||'Ranked candidate';
    card.querySelector('h3').id=`top3Compound-${index}`;card.querySelector('h3').textContent=compound.id;card.setAttribute('aria-labelledby',`top3Compound-${index}`);
    card.querySelector('.top3-score small').textContent=(latest.scoreUnits||'Synthetic pIC50')+'; higher values rank first.';
    card.querySelector('.top3-score-note').textContent=`Rank #${compound.rank} follows this model's predicted activity. This is not experimentally verified effectiveness.`;
    card.querySelector('.top3-score strong').textContent=compound.prediction.toFixed(3);
    card.querySelector('.top3-uncertainty').textContent=Number.isFinite(compound.treeSd)?`Model uncertainty: ${compound.treeSd.toFixed(3)} ${latest.uncertaintyLabel||'Tree SD'} · not a confidence interval.`:'No uncertainty measurement was supplied for this compound.';
    const button=card.querySelector('.top3-details');button.dataset.top3Detail=compound.id;button.setAttribute('aria-label',`View full details for ${compound.id}`);
    cards.append(card);slots[index].attach(card.querySelector('.top3-molecule-slot'),compound);
  }
  for(let i=count;i<slots.length;i++)slots[i].deactivate();
  document.body.classList.add('top3-open');popup.showModal();popup.scrollTop=0;
  popup.querySelector('.top3-close').focus({preventScroll:true});
  return true;
}
popup.querySelector('#top3ReferenceTarget').onchange=event=>callbacks.onTargetChange?.(event.target.value);
manual.onclick=show;
/* Called only from the completed-success path, never from table rendering. */
export function screeningCompleted(run,ranked,{automatic=true}={}){
  if(!run?.id||!Array.isArray(ranked))return false;
  const compounds=ranked.filter(c=>c&&typeof c.id==='string'&&c.id.trim()&&Number.isFinite(c.prediction)&&Number.isInteger(c.rank)&&c.rank>0).slice().sort((a,b)=>a.rank-b.rank).slice(0,3);
  if(!compounds.length)return false;
  latest={id:run.id,key:run.key,target:run.target,availableTargets:run.availableTargets||[],customName:run.configuration?.virusName,virus:run.virus||'Demonstration context',candidateCount:run.candidateCount,scoreUnits:run.scoreUnits,uncertaintyLabel:run.uncertaintyLabel,compounds};
  manual.disabled=false;manual.textContent=compounds.length===1?'View top compound':`View Top ${compounds.length}`;
  if(!automatic)return popup.open?show():false;
  const automaticId=run.sessionId||run.id;if(lastAutomaticRun===automaticId)return false;
  lastAutomaticRun=automaticId;
  return show();
}
