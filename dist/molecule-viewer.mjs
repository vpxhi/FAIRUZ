/* One selected visualization only. No screening state, model outputs or exports are changed. */
const dialog = document.querySelector('#detail');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const dockWidth = matchMedia('(min-width: 1250px)');
let libraryPromise, viewer, canvas, rendererHost, panel, worker, timer, idleTimer, resizeObserver, visibilityObserver;
let returnFocus;
let selection = 0, currentCompound, defaultView, inView = true, interacting = false, autoRotate = !reducedMotion.matches;
const cache = new Map();
const $ = selector => panel?.querySelector(selector);
function loadRenderer() {
  if (globalThis.$3Dmol) return Promise.resolve(globalThis.$3Dmol);
  if (!libraryPromise) libraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('./vendor/3dmol/3Dmol-min.js', import.meta.url).href;
    script.onload = () => resolve(globalThis.$3Dmol);
    script.onerror = () => { script.remove(); libraryPromise = null; reject(new Error('The local 3D renderer could not load.')); };
    document.head.append(script);
  });
  return libraryPromise;
}
function updateSpin() {
  if (!viewer) return;
  const spinning = panel?.dataset.state === 'ready' && autoRotate && !reducedMotion.matches && inView && !interacting && !document.hidden && dialog.open;
  viewer.spin(spinning ? 'y' : false, .25, true);
  const button = $('#moleculeSpin');
  if (button) { button.setAttribute('aria-pressed', String(autoRotate && !reducedMotion.matches)); button.textContent = reducedMotion.matches ? 'Motion reduced' : autoRotate ? 'Pause rotation' : 'Auto rotate'; button.disabled = reducedMotion.matches; }
}
function stopWork() {
  selection++;
  clearTimeout(timer); clearTimeout(idleTimer);
  worker?.terminate(); worker = null;
  resizeObserver?.disconnect(); visibilityObserver?.disconnect();
  viewer?.spin(false); viewer?.clear();
  // Retain one empty renderer/host across selections. Native renderer listeners
  // and WebGL contexts must not accumulate as compounds are switched.
  defaultView = null;
}
function close() {
  stopWork();
  document.body.classList.remove('compound-open');
  document.querySelectorAll('[data-detail][aria-current]').forEach(el => el.removeAttribute('aria-current'));
  currentCompound = null;
  if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
  returnFocus=null;
}
dialog.addEventListener('close', () => { if (!dialog.open) close(); });
function chooseDialogMode() {
  const dock = dockWidth.matches && !!document.querySelector('.candidates')?.getClientRects().length;
  const previousFocus = document.activeElement;
  if (dialog.open && dialog.matches(':modal') === dock) {
    // Change only the presentation mode on responsive resize.
    dialog.close();
  }
  document.body.classList.toggle('compound-open', dock);
  dialog.classList.toggle('docked', dock);
  dialog.setAttribute('aria-modal', String(!dock));
  if (!dialog.open) dock ? dialog.show() : dialog.showModal();
  if (dock && previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
}
dockWidth.addEventListener('change', () => { if (dialog.open && currentCompound) { chooseDialogMode(); viewer?.resize(); } });
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) autoRotate = false; updateSpin(); });
document.addEventListener('visibilitychange', updateSpin);
function pauseForInteraction() {
  interacting = true; updateSpin(); clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { interacting = false; updateSpin(); }, 4000);
}
function setStatus(text, state = 'loading') {
  panel.dataset.state = state;
  $('.molecule-kind').textContent = state === 'ready' ? 'Generated conformer' : state === 'error' ? '3D unavailable' : 'Preparing structure';
  $('.atom-legend').hidden = state !== 'ready';
  $('.molecule-instructions').hidden = state !== 'ready';
  $('.conformer-note').hidden = state === 'error';
  $('#moleculeStatus').textContent = text;
  $('#moleculeStatus').hidden = state === 'ready';
  $('#moleculeRetry').hidden = state !== 'error';
  panel.querySelectorAll('.molecule-controls button,.molecule-controls select').forEach(el => el.disabled = state !== 'ready');
}
function applyStyle() {
  if (!viewer) return;
  const style = $('#moleculeStyle').value === 'space' ? {sphere:{colorscheme:'Jmol'}} : {stick:{radius:.16,colorscheme:'Jmol'},sphere:{scale:.28,colorscheme:'Jmol'}};
  viewer.setStyle({},style); viewer.render();
}
function reset() {
  if (!viewer || !defaultView) return;
  pauseForInteraction(); viewer.setView([...defaultView]); viewer.render();
}
function generate(smiles, id) {
  if (cache.has(smiles)) return Promise.resolve(cache.get(smiles));
  return new Promise((resolve,reject) => {
    worker = new Worker(new URL('./vendor/openbabel/conformer-worker.js',import.meta.url));
    timer = setTimeout(() => { worker?.terminate(); worker=null; reject(new Error('Preparing a reliable conformer took too long. You can retry.')); },45000);
    worker.onerror = () => { clearTimeout(timer); worker?.terminate(); worker=null; reject(new Error('The browser chemistry engine is unavailable.')); };
    worker.onmessage = ({data}) => {
      if (data.id !== id || id !== selection) return;
      if (data.type === 'progress') { setStatus(data.text); return; }
      clearTimeout(timer); worker?.terminate(); worker=null;
      if (data.type === 'error') reject(new Error(data.error));
      else if (data.type === 'result' && data.sourceSmiles === smiles) {
        if (cache.size >= 6) cache.delete(cache.keys().next().value);
        cache.set(smiles,data); resolve(data);
      } else reject(new Error('The conformer does not match the selected compound.'));
    };
    worker.postMessage({id,smiles});
  });
}
export async function openCompoundViewer(compound) {
  stopWork();
  currentCompound = compound; const id = selection;
  if(document.activeElement?.matches('[data-detail]'))returnFocus=document.activeElement;
  autoRotate = !reducedMotion.matches; interacting = false; inView = true;
  const content = document.querySelector('#detailContent');
  panel = document.createElement('section'); panel.className = 'molecule-panel'; panel.dataset.compoundId = compound.id;
  panel.setAttribute('aria-label','Molecular structure viewer');
  panel.innerHTML = `<div class="molecule-topline"><span class="eyebrow">STRUCTURE EXPLORER</span><span class="molecule-kind">Generated conformer</span></div>
    <div class="molecule-stage"><div id="moleculeCanvas" class="molecule-canvas" tabindex="0" role="img"></div><div id="moleculeStatus" class="molecule-status" role="status"></div><button class="button light molecule-retry" id="moleculeRetry" hidden>Retry 3D structure</button></div>
    <div class="molecule-instructions">Drag to rotate · Scroll or pinch to zoom</div>
    <div class="molecule-controls"><label class="visually-hidden" for="moleculeStyle">Molecular representation</label><select id="moleculeStyle" disabled><option value="ball">Ball and stick</option><option value="space">Space filling</option></select><button id="moleculeReset" title="Reset the orientation and zoom (Home key)" disabled>Reset view</button><button id="moleculeSpin" aria-pressed="false" disabled>Pause rotation</button><button id="moleculeZoomIn" aria-label="Zoom molecule in" title="Zoom in (+)" disabled>＋</button><button id="moleculeZoomOut" aria-label="Zoom molecule out" title="Zoom out (-)" disabled>−</button></div>
    <div class="atom-legend" aria-label="Atom colours"><span><i class="atom-c"></i>Carbon</span><span><i class="atom-n"></i>Nitrogen</span><span><i class="atom-o"></i>Oxygen</span><span><i class="atom-s"></i>Sulfur</span><span><i class="atom-h"></i>Hydrogen</span></div>
    <p class="conformer-note">One possible 3D shape, generated from this compound’s SMILES using Open Babel (MMFF94). Not an experimentally measured or protein-bound structure. Unspecified stereochemistry is illustrative. This view does not change the screening prediction.</p>
    <details class="learn-more molecule-help"><summary>Keyboard controls &amp; structure provenance</summary><p>Focus the molecule and use arrow keys to rotate, + / − to zoom, and Home to reset. Auto rotation pauses while you interact, when off screen, and when the page is hidden. Reduced-motion settings turn it off.</p><p>Geometry and molecular identity are checked before display. These checks do not establish conformer accuracy or stability. Space filling uses approximate van der Waals atom radii. Atom colours follow the Jmol element convention. The model includes generated hydrogens; unspecified stereochemistry is not an experimental assignment.</p><p><a href="vendor/README.md" target="_blank" rel="noopener">Visualization libraries &amp; licenses</a></p></details>`;
  const heading = content.querySelector('h2'); heading.id = 'detailTitle'; dialog.setAttribute('aria-labelledby','detailTitle');
  content.querySelector('.muted').after(panel);
  if (rendererHost) $('#moleculeCanvas').replaceWith(rendererHost);
  else rendererHost = $('#moleculeCanvas');
  $('#moleculeCanvas').setAttribute('aria-label',`Interactive 3D structure for ${compound.id}. Arrow keys rotate, plus and minus zoom, Home resets.`);
  document.querySelectorAll('[data-detail][aria-current]').forEach(el=>el.removeAttribute('aria-current'));
  document.querySelectorAll('[data-detail]').forEach(el=>{if(el.dataset.detail===compound.id)el.setAttribute('aria-current','true')});
  chooseDialogMode();
  dialog.querySelector('.close').focus({preventScroll:true});
  $('#moleculeRetry').onclick=()=>{ panel.remove(); openCompoundViewer(compound); };
  $('#moleculeStyle').onchange=()=>{pauseForInteraction();applyStyle()};
  $('#moleculeReset').onclick=reset;
  $('#moleculeSpin').onclick=()=>{autoRotate=!autoRotate;interacting=false;updateSpin()};
  $('#moleculeZoomIn').onclick=()=>{pauseForInteraction();viewer?.zoom(1.15);viewer?.render()};
  $('#moleculeZoomOut').onclick=()=>{pauseForInteraction();viewer?.zoom(1/1.15);viewer?.render()};
  if (!rendererHost.dataset.interactionsBound) {
  rendererHost.dataset.interactionsBound='true';
  $('#moleculeCanvas').addEventListener('keydown',event=>{
    if (!viewer) return;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(event.key)) {
      event.preventDefault(); pauseForInteraction();
      if(event.key==='Home')reset();
      else if(['+','=','-'].includes(event.key))viewer.zoom(event.key==='-'?1/1.15:1.15);
      else viewer.rotate(event.key==='ArrowLeft'||event.key==='ArrowUp'?-12:12,event.key==='ArrowLeft'||event.key==='ArrowRight'?'y':'x');
      viewer.render();
    }
  });
  $('#moleculeCanvas').addEventListener('pointerdown',pauseForInteraction,{passive:true});
  $('#moleculeCanvas').addEventListener('pointermove',event=>{if(event.buttons)pauseForInteraction()},{passive:true});
  $('#moleculeCanvas').addEventListener('wheel',pauseForInteraction,{passive:true});
  }
  setStatus('Preparing this compound’s 3D structure…');
  try {
    const [library,result] = await Promise.all([loadRenderer(),generate(compound.smiles,id)]);
    if (id!==selection || !dialog.open) return;
    if (!library) throw new Error('The molecular renderer is unavailable.');
    const target=$('#moleculeCanvas');
    if (!viewer) viewer=library.createViewer(target,{backgroundColor:'#0b1510',backgroundAlpha:0,antialias:true});
    else viewer.resize();
    viewer.setView([0,0,0,0,0,0,0,1]);
    const model=viewer.addModel(result.molblock,'mol',{keepH:true});
    if(model.selectedAtoms({}).length!==result.atomCount)throw new Error('The renderer could not read every atom in the conformer.');
    applyStyle(); viewer.zoomTo(); viewer.zoom(.88); viewer.render(); defaultView=[...viewer.getView()];
    canvas=target.querySelector('canvas');
    panel.dataset.atomCount=String(result.atomCount);panel.dataset.identity=result.identity;
    const elementColours={C:['Carbon','#909090'],H:['Hydrogen','#ffffff'],N:['Nitrogen','#3050f8'],O:['Oxygen','#ff0d0d'],S:['Sulfur','#ffff30'],F:['Fluorine','#90e050'],Cl:['Chlorine','#1ff01f'],Br:['Bromine','#a62929'],P:['Phosphorus','#ff8000']};
    const legend=$('.atom-legend');legend.replaceChildren();
    for(const element of result.elements){const entry=elementColours[element]||[element,'#f0c8a0'];const item=document.createElement('span');const dot=document.createElement('i');dot.style.background=entry[1];item.append(dot,document.createTextNode(entry[0]));legend.append(item)}
    setStatus(`${result.atomCount} atoms loaded.`,'ready');
    resizeObserver=new ResizeObserver(()=>viewer?.resize());resizeObserver.observe(target);
    visibilityObserver=new IntersectionObserver(entries=>{inView=entries[0]?.isIntersecting||false;panel.dataset.visible=String(inView);updateSpin()},{threshold:.05});visibilityObserver.observe(target);
    updateSpin();
  } catch(error) {
    if(id!==selection || !dialog.open)return;
    clearTimeout(timer);worker?.terminate();worker=null;
    viewer?.spin(false);viewer?.clear();
    setStatus('3D structure unavailable. '+error.message+' The original SMILES and screening details remain available below.','error');
  }
}

// Keep selection presentation in sync when the original table rerenders.
new MutationObserver(() => {
  if (!currentCompound || !dialog.open) return;
  document.querySelectorAll('#compoundRows [data-detail]').forEach(el => {
    if (el.dataset.detail===currentCompound.id) el.setAttribute('aria-current','true');
    else el.removeAttribute('aria-current');
  });
}).observe(document.querySelector('#compoundRows'),{childList:true});
new MutationObserver(() => { if(dialog.open)dialog.close(); }).observe(document.querySelector('#runStrip'),{childList:true});
document.querySelectorAll('nav button').forEach(button => button.addEventListener('click',()=>{if(dialog.open)dialog.close()}));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&dialog.open&&!dialog.matches(':modal')){event.preventDefault();dialog.close()}});
