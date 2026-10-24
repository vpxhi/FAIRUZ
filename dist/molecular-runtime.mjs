/* Shared presentation-only chemistry runtime: one worker, a bounded cache, one render path. */
let rendererPromise, worker, active, timeout, idleTimer, sequence=0;
const queue=[], cache=new Map();
export function loadMolecularRenderer() {
  if(globalThis.$3Dmol)return Promise.resolve(globalThis.$3Dmol);
  if(!rendererPromise)rendererPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=new URL('./vendor/3dmol/3Dmol-min.js',import.meta.url).href;
    script.onload=()=>resolve(globalThis.$3Dmol);
    script.onerror=()=>{script.remove();rendererPromise=null;reject(new Error('The local 3D renderer could not load.'))};
    document.head.append(script);
  });
  return rendererPromise;
}
function stopWorker(){clearTimeout(timeout);clearTimeout(idleTimer);worker?.terminate();worker=null}
function finish(error,result){
  const task=active;if(!task)return;
  clearTimeout(timeout);active=null;task.signal?.removeEventListener('abort',task.abort);
  if(error)task.reject(error);
  else{
    if(cache.size>=6&&!cache.has(task.smiles))cache.delete(cache.keys().next().value);
    cache.set(task.smiles,result);task.resolve(result);
  }
  pump();
}
function pump(){
  if(active)return;
  clearTimeout(idleTimer);
  active=queue.shift();
  if(!active){idleTimer=setTimeout(stopWorker,30000);return}
  if(!worker){
    worker=new Worker(new URL('./vendor/openbabel/conformer-worker.js',import.meta.url));
    worker.onerror=()=>{stopWorker();finish(new Error('The browser chemistry engine is unavailable.'))};
    worker.onmessage=({data})=>{
      if(!active||data.id!==active.id)return;
      if(data.type==='progress'){active.onProgress?.(data.text);return}
      if(data.type==='error')finish(new Error(data.error));
      else if(data.type==='result'&&data.sourceSmiles===active.smiles)finish(null,data);
      else finish(new Error('The conformer does not match the selected compound.'));
    };
  }
  timeout=setTimeout(()=>{stopWorker();finish(new Error('Preparing a reliable conformer took too long. You can retry.'))},45000);
  worker.postMessage({id:active.id,smiles:active.smiles});
}
export function requestConformer(smiles,{signal,onProgress}={}){
  if(signal?.aborted)return Promise.reject(new DOMException('Cancelled','AbortError'));
  if(cache.has(smiles))return Promise.resolve(cache.get(smiles));
  return new Promise((resolve,reject)=>{
    const task={id:++sequence,smiles,signal,onProgress,resolve,reject};
    task.abort=()=>{
      signal?.removeEventListener('abort',task.abort);
      if(active===task){stopWorker();active=null}
      else {const i=queue.indexOf(task);if(i>=0)queue.splice(i,1)}
      reject(new DOMException('Cancelled','AbortError'));pump();
    };
    signal?.addEventListener('abort',task.abort,{once:true});
    onProgress?.(active?'Queued for 3D preparation…':'Preparing this compound’s 3D structure…');
    queue.push(task);pump();
  });
}
export function applyMoleculeStyle(viewer,mode='ball'){
  viewer.setStyle({},mode==='space'?{sphere:{colorscheme:'Jmol'}}:{stick:{radius:.16,colorscheme:'Jmol'},sphere:{scale:.28,colorscheme:'Jmol'}});viewer.render();
}
export function renderMolecule(library,host,result,reuse){
  const viewer=reuse||library.createViewer(host,{backgroundColor:'#0b1510',backgroundAlpha:0,antialias:true});
  if(!viewer)throw new Error('WebGL molecular rendering is unavailable.');
  viewer.spin(false);viewer.clear();viewer.resize();viewer.setView([0,0,0,0,0,0,0,1]);
  const model=viewer.addModel(result.molblock,'mol',{keepH:true});
  if(model.selectedAtoms({}).length!==result.atomCount)throw new Error('The renderer could not read every atom in the conformer.');
  applyMoleculeStyle(viewer);viewer.zoomTo();viewer.zoom(.88);viewer.render();
  return {viewer,defaultView:[...viewer.getView()]};
}
export function molecularKey(viewer,event,reset,onInteract){
  if(!viewer||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(event.key))return;
  event.preventDefault();onInteract();
  if(event.key==='Home')reset();
  else if(['+','=','-'].includes(event.key))viewer.zoom(event.key==='-'?1/1.15:1.15);
  else viewer.rotate(event.key==='ArrowLeft'||event.key==='ArrowUp'?-12:12,event.key==='ArrowLeft'||event.key==='ArrowRight'?'y':'x');
  viewer.render();
}
/* Compact reusable surface; each slot retains one empty renderer across popup openings. */
export class MolecularPreview {
  constructor(slot){
    this.slot=slot;this.epoch=0;this.visible=false;this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
    this.element=document.createElement('div');this.element.className='top3-molecule';
    this.element.innerHTML=`<div class="top3-molecule-stage"><div class="top3-canvas" tabindex="0" role="img"></div><p class="top3-molecule-status" role="status"></p><button class="button light top3-retry" hidden>Retry 3D</button></div><p class="top3-instructions">Drag to rotate · Scroll or pinch to zoom</p><div class="top3-view-controls"><button data-camera="reset" title="Reset orientation and zoom (Home)">Reset</button><button data-camera="spin" aria-pressed="false">Auto rotate</button><button data-camera="in" title="Zoom in (+)">＋</button><button data-camera="out" title="Zoom out (-)">−</button></div>`;
    this.host=this.element.querySelector('.top3-canvas');this.status=this.element.querySelector('.top3-molecule-status');
    this.element.querySelector('.top3-view-controls').addEventListener('click',event=>{
      const action=event.target.closest('[data-camera]')?.dataset.camera;if(!this.viewer||this.element.dataset.state!=='ready')return;
      if(action==='reset')this.reset();
      if(action==='spin'){this.auto=!this.auto;this.interacting=false;this.spin()}
      if(action==='in'||action==='out'){this.pause();this.viewer.zoom(action==='in'?1.15:1/1.15);this.viewer.render()}
    });
    this.element.querySelector('.top3-retry').onclick=()=>{if(this.compound)this.start()};
    this.host.addEventListener('keydown',event=>molecularKey(this.viewer,event,()=>this.reset(),()=>this.pause()));
    this.host.addEventListener('pointerdown',()=>this.pause(),{passive:true});
    this.host.addEventListener('pointermove',event=>{if(event.buttons)this.pause()},{passive:true});
    this.host.addEventListener('wheel',()=>this.pause(),{passive:true});
    this.reduced.addEventListener('change',()=>{if(this.reduced.matches)this.auto=false;this.spin()});
    document.addEventListener('visibilitychange',()=>this.spin());
  }
  attach(container,compound){
    this.deactivate();this.compound=compound;this.element.dataset.compoundId=compound.id;delete this.element.dataset.identity;delete this.element.dataset.atomCount;this.auto=!this.reduced.matches;this.interacting=false;
    this.host.setAttribute('aria-label',`3D structure for ${compound.id}. Arrow keys rotate, plus and minus zoom, Home resets.`);
    for(const button of this.element.querySelectorAll('[data-camera]'))button.setAttribute('aria-label',`${{reset:'Reset view of',spin:'Toggle automatic rotation of',in:'Zoom into',out:'Zoom out of'}[button.dataset.camera]} ${compound.id}`);
    container.append(this.element);this.setStatus('Preparing this compound’s 3D structure…');
    this.resize=new ResizeObserver(()=>this.viewer?.resize());this.resize.observe(this.host);
    this.intersection=new IntersectionObserver(entries=>{
      this.visible=!!entries[0]?.isIntersecting;
      if(this.visible&&!this.started)this.start();this.spin();
    },{threshold:.05});this.intersection.observe(this.host);
  }
  setStatus(text,state='loading'){
    this.element.dataset.state=state;this.status.textContent=text;this.status.hidden=state==='ready';
    this.element.querySelector('.top3-retry').hidden=state!=='error';
    this.element.querySelector('.top3-instructions').hidden=state!=='ready';
    for(const button of this.element.querySelectorAll('[data-camera]'))button.disabled=state!=='ready';
  }
  async start(){
    this.started=true;const epoch=++this.epoch;this.abort?.abort();this.abort=new AbortController();
    this.setStatus('Preparing this compound’s 3D structure…');
    try{
      const [library,result]=await Promise.all([loadMolecularRenderer(),requestConformer(this.compound.smiles,{signal:this.abort.signal,onProgress:text=>{if(epoch===this.epoch)this.setStatus(text)}})]);
      if(epoch!==this.epoch||!this.compound)return;
      const scene=renderMolecule(library,this.host,result,this.viewer);this.viewer=scene.viewer;this.defaultView=scene.defaultView;
      this.element.dataset.compoundId=this.compound.id;this.element.dataset.identity=result.identity;this.element.dataset.atomCount=result.atomCount;
      this.setStatus('3D structure ready.','ready');this.spin();
    }catch(error){if(epoch===this.epoch&&error.name!=='AbortError'){this.abort?.abort();this.viewer?.spin(false);this.viewer?.clear();this.setStatus('3D structure unavailable. '+error.message,'error')}}
  }
  pause(){this.interacting=true;this.spin();clearTimeout(this.idle);this.idle=setTimeout(()=>{this.interacting=false;this.spin()},4000)}
  reset(){if(!this.viewer||!this.defaultView)return;this.pause();this.viewer.setView([...this.defaultView]);this.viewer.render()}
  spin(){
    const enabled=this.auto&&!this.reduced.matches;
    this.viewer?.spin(enabled&&this.visible&&!this.interacting&&!document.hidden&&this.element.dataset.state==='ready'?'y':false,.2,true);
    const button=this.element.querySelector('[data-camera=spin]');button.setAttribute('aria-pressed',String(enabled));button.textContent=this.reduced.matches?'Motion reduced':enabled?'Pause rotation':'Auto rotate';button.disabled=this.reduced.matches||this.element.dataset.state!=='ready';
  }
  deactivate(){
    this.epoch++;this.abort?.abort();this.abort=null;clearTimeout(this.idle);this.resize?.disconnect();this.intersection?.disconnect();this.viewer?.spin(false);this.viewer?.clear();this.compound=null;this.defaultView=null;this.started=false;this.visible=false;
  }
}
