import {MolecularPreview} from './molecular-runtime.mjs';
const manual=document.querySelector('#viewTop3');
const popup=document.createElement('dialog');popup.id='top3Results';popup.className='top3-dialog';popup.setAttribute('aria-labelledby','top3Heading');popup.setAttribute('aria-describedby','top3Description');
popup.innerHTML=`<header class="top3-heading"><div><div class="eyebrow"><span class="live-dot"></span> SCREENING COMPLETE</div><h2 id="top3Heading">Your Top 3 Compounds</h2></div><button class="top3-close" data-top3-close aria-label="Close top compounds">×</button></header><div class="top3-body"><p id="top3Description">Here are the highest-ranked compounds from your AI screening.</p><p class="top3-explanation">These compounds received the highest predictions from the AI model in this demonstration.</p><div class="top3-notice"><strong>Synthetic demonstration</strong> These predictions are not experimentally verified antiviral activity and do not establish clinical effectiveness or safety.</div><p class="top3-context"></p><div class="top3-cards"></div><p class="top3-structure-note">Structures show possible conformers generated from each compound’s SMILES, not measured or protein-bound shapes. Unspecified stereochemistry is illustrative.</p></div><div class="top3-footer"><span>Curiosity starts here. Explore the evidence next.</span><div><button class="button light" data-top3-close>Close</button><button class="button primary" id="top3Explore">Explore all results <span aria-hidden="true">↗</span></button></div></div>`;
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
  if(popup.open)return true;
  const detail=document.querySelector('#detail');if(detail?.open)detail.close();
  returnFocus=document.activeElement instanceof HTMLElement&&document.activeElement!==document.body&&!document.activeElement.disabled?document.activeElement:manual;
  const count=latest.compounds.length;
  popup.dataset.runId=latest.id;popup.dataset.resultCount=String(count);
  popup.querySelector('#top3Heading').textContent=count===1?'Your Top Compound':`Your Top ${count} Compounds`;
  popup.querySelector('#top3Description').textContent=count===1?'Here is the highest-ranked compound from your AI screening.':'Here are the highest-ranked compounds from your AI screening.';
  popup.querySelector('.top3-context').textContent=`${latest.virus} · ${latest.candidateCount} compounds screened · ${latest.id}`;
  const cards=popup.querySelector('.top3-cards');cards.replaceChildren();
  for(const [index,compound] of latest.compounds.entries()){
    const card=document.createElement('article');card.className='top3-card';card.dataset.compoundId=compound.id;card.style.setProperty('--reveal-delay',`${index*70}ms`);
    card.innerHTML=`<div class="top3-card-heading"><span class="top3-rank"></span><span class="top3-rank-label"></span></div><h3 class="top3-compound-name"></h3><div class="top3-molecule-slot"></div><div class="top3-score"><div><span>Predicted activity</span><strong></strong></div><small>Synthetic pIC50<br>Higher values rank first.</small></div><p class="top3-score-note">A model prediction from artificial data, not a measured antiviral effect.</p><div class="top3-uncertainty"></div><button class="button light top3-details">View details <span aria-hidden="true">↗</span></button>`;
    card.querySelector('.top3-rank').textContent=`#${compound.rank}`;
    card.querySelector('.top3-rank-label').textContent=['Highest ranked','Second highest','Third highest'][compound.rank-1]||'Ranked candidate';
    card.querySelector('h3').id=`top3Compound-${index}`;card.querySelector('h3').textContent=compound.id;card.setAttribute('aria-labelledby',`top3Compound-${index}`);
    card.querySelector('.top3-score strong').textContent=compound.prediction.toFixed(3);
    card.querySelector('.top3-uncertainty').textContent=Number.isFinite(compound.treeSd)?`Model uncertainty: ${compound.treeSd.toFixed(3)} tree SD · not a confidence interval.`:'Model uncertainty is available in compound details.';
    const button=card.querySelector('.top3-details');button.dataset.top3Detail=compound.id;button.setAttribute('aria-label',`View details for ${compound.id}`);
    cards.append(card);slots[index].attach(card.querySelector('.top3-molecule-slot'),compound);
  }
  for(let i=count;i<slots.length;i++)slots[i].deactivate();
  document.body.classList.add('top3-open');popup.showModal();popup.scrollTop=0;
  popup.querySelector('.top3-close').focus({preventScroll:true});
  return true;
}
manual.onclick=show;
/* Called only from the completed-success path, never from table rendering. */
export function screeningCompleted(run,ranked){
  if(!run?.id||!Array.isArray(ranked))return false;
  const compounds=ranked.filter(c=>c&&typeof c.id==='string'&&c.id.trim()&&Number.isFinite(c.prediction)&&Number.isInteger(c.rank)&&c.rank>0).slice(0,3);
  if(!compounds.length)return false;
  latest={id:run.id,virus:run.virus||'Demonstration context',candidateCount:run.candidateCount,compounds};
  manual.disabled=false;manual.textContent=compounds.length===1?'View top compound':`View Top ${compounds.length}`;
  if(lastAutomaticRun===run.id)return false;
  lastAutomaticRun=run.id;
  return show();
}
