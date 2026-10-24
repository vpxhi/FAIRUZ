import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {rankCandidates} from '../dist/inference.mjs';
const study=JSON.parse(fs.readFileSync('dist/research-data.json','utf8'));
const expected=key=>rankCandidates(JSON.parse(fs.readFileSync(`dist/models/${key}.json`,'utf8')),study.library,study.trainingReferences);
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const errors=[];
const open=page=>page.locator('#top3Results').isVisible();
const dismiss=page=>page.locator('#top3Results [data-top3-close]').first().click();
const checkCards=async(page,rows)=>{
 assert.deepEqual(await page.locator('.top3-card').evaluateAll(xs=>xs.map(x=>x.dataset.compoundId)),rows.slice(0,3).map(c=>c.id));
 assert.deepEqual(await page.locator('.top3-score strong').allTextContents(),rows.slice(0,3).map(c=>c.prediction.toFixed(3)));
 assert.deepEqual(await page.locator('.top3-rank').allTextContents(),rows.slice(0,3).map(c=>'#'+c.rank));
};
try{
 const page=await browser.newPage({viewport:{width:1512,height:1100},acceptDownloads:true});page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const NativeWorker=window.Worker;window.chemWorkers=[];window.Worker=class extends NativeWorker{constructor(url,...args){super(url,...args);if(String(url).includes('conformer-worker'))window.chemWorkers.push(String(url))}}});
 let release;const gate=new Promise(resolve=>release=resolve);let modelRequested=false;
 await page.route('**/models/sars.json',async route=>{modelRequested=true;await gate;await route.continue()});
 const vendors=[];page.on('request',r=>{if(r.url().includes('/vendor/'))vendors.push(r.url())});
 await page.goto('http://127.0.0.1:8765',{waitUntil:'domcontentloaded'});while(!modelRequested)await page.waitForTimeout(20);
 assert.ok(!await open(page),'No reveal while model is loading');assert.ok(await page.locator('#viewTop3').isDisabled());assert.equal(vendors.length,0,'No molecular runtime before successful results');
 release();await page.locator('#top3Results[open]').waitFor();await checkCards(page,expected('sars'));
 assert.match(await page.locator('.top3-notice').innerText(),/synthetic|experimentally verified/i);assert.ok(await page.locator('#top3Results').evaluate(e=>e.contains(document.activeElement)));
 await page.waitForFunction(()=>[...document.querySelectorAll('.top3-molecule')].every(e=>e.dataset.state==='ready'),null,{timeout:90000});
 assert.equal(await page.evaluate(()=>window.chemWorkers.length),1,'All three conformers use one chemistry worker');assert.equal(await page.locator('#top3Results canvas').count(),3);
 for(const card of await page.locator('.top3-card').all()){
  await card.locator('[data-camera=spin]').click();await card.locator('[data-camera=reset]').click();
  const get=()=>card.locator('canvas').evaluate(e=>e._3dmol_viewer.getView());const baseline=await get();
  await card.locator('.top3-canvas').focus();await page.keyboard.press('ArrowRight');assert.notDeepEqual(await get(),baseline);await page.keyboard.press('Home');assert.deepEqual(await get(),baseline);
  await card.locator('[data-camera=in]').click();assert.notDeepEqual(await get(),baseline);await card.locator('[data-camera=reset]').click();assert.deepEqual(await get(),baseline);
 }
 await page.screenshot({path:'.runtime/top3-desktop.png'});const initialRun=await page.locator('#top3Results').getAttribute('data-run-id');
 await dismiss(page);await page.waitForFunction(()=>document.activeElement?.id==='viewTop3');assert.ok(!await open(page));
 await page.locator('#search').fill('FZ-0128');await page.locator('#search').fill('');await page.locator('#nextPage').click();await page.locator('#prevPage').click();await page.locator('#compoundRows [data-save]').first().click();assert.ok(!await open(page),'Normal rerenders do not reopen the reveal');
 await page.locator('#viewTop3').click();await checkCards(page,expected('sars'));assert.equal(await page.locator('#top3Results').getAttribute('data-run-id'),initialRun);
 await page.locator('.top3-card').nth(1).locator('[data-top3-detail]').click();assert.ok(!await open(page));assert.ok(await page.locator('#detail').isVisible());assert.equal(await page.locator('#detailTitle').textContent(),expected('sars')[1].id);await page.waitForFunction(()=>document.querySelector('.molecule-panel')?.dataset.state==='ready',null,{timeout:60000});await page.locator('#detail .close').click();
 await page.locator('#viewTop3').click();await page.locator('#top3Explore').click();assert.ok(!await open(page));assert.equal(await page.locator('nav .active').getAttribute('data-view'),'library');assert.equal(await page.locator('#resultCount').textContent(),'360');
 const pending=page.waitForEvent('download');await page.locator('#export').click();const report=JSON.parse(fs.readFileSync(await(await pending).path(),'utf8'));assert.equal(report.results.length,360);assert.deepEqual(report.results.slice(0,3).map(c=>c.id),expected('sars').slice(0,3).map(c=>c.id));assert.ok(!JSON.stringify(report).includes('molblock'));
 await page.locator('nav [data-view="overview"]').click();await page.locator('#autoSummary').uncheck();await page.locator('#virus').selectOption('flu');await page.locator('#runButton').click();await page.locator('#top3Results[open]').waitFor();await checkCards(page,expected('flu'));assert.notEqual(await page.locator('#top3Results').getAttribute('data-run-id'),initialRun);await page.keyboard.press('Escape');assert.ok(!await open(page));
 await page.route('**/models/hcv.json',route=>route.fulfill({status:500,body:'Model unavailable in this test'}));await page.locator('#virus').selectOption('hcv');await page.locator('#runButton').click();await page.locator('#loadError').waitFor();assert.ok(!await open(page),'Failed screening must not trigger reveal');assert.match(await page.locator('#loadError').textContent(),/failed/i);
 await page.locator('#viewTop3').click();await checkCards(page,expected('flu'));await dismiss(page);await page.locator('#virus').selectOption('custom');assert.ok(await page.locator('#runButton').isDisabled());assert.ok(!await open(page));
 // UI-only boundary cases use actual existing model results, never fabricated scores.
 const first=expected('sars').slice(0,2);
 await page.evaluate(async rows=>{const m=await import('./top-results.mjs');m.screeningCompleted({id:'ui-boundary-one',virus:'UI test',candidateCount:1},rows.slice(0,1))},first);
 assert.equal(await page.locator('.top3-card').count(),1);assert.equal(await page.locator('#top3Heading').textContent(),'Your Top Compound');await dismiss(page);
 const repeated=await page.evaluate(async rows=>(await import('./top-results.mjs')).screeningCompleted({id:'ui-boundary-one',candidateCount:1},rows.slice(0,1)),first);assert.equal(repeated,false);assert.ok(!await open(page));
 await page.evaluate(async row=>(await import('./top-results.mjs')).screeningCompleted({id:'ui-boundary-no-structure',virus:'UI test',candidateCount:1},[{...row,smiles:''}]),first[0]);assert.equal(await page.locator('.top3-card').count(),1);await page.waitForFunction(()=>document.querySelector('.top3-molecule')?.dataset.state==='error');assert.match(await page.locator('.top3-molecule-status').textContent(),/3D structure unavailable/);assert.equal(await page.locator('.top3-score strong').textContent(),first[0].prediction.toFixed(3));await dismiss(page);
 await page.evaluate(async rows=>(await import('./top-results.mjs')).screeningCompleted({id:'ui-boundary-two',virus:'UI test',candidateCount:2},rows),first);assert.equal(await page.locator('.top3-card').count(),2);assert.equal(await page.locator('#top3Heading').textContent(),'Your Top 2 Compounds');await dismiss(page);
 const empty=await page.evaluate(async()=>(await import('./top-results.mjs')).screeningCompleted({id:'ui-boundary-empty'},[]));assert.equal(empty,false);assert.ok(!await open(page));
 await page.locator('#viewTop3').click();for(const width of [1024,768,390,320]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await page.locator('#top3Results').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Popup must not overflow horizontally at '+width);assert.ok(await page.locator('.top3-close').isVisible())}
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.top3-card').first().evaluate(e=>getComputedStyle(e).animationName),'none');await page.screenshot({path:'.runtime/top3-mobile.png'});await page.keyboard.press('Escape');
 // A renderer loading failure leaves cards, actual scores and navigation usable.
 const fallback=await browser.newPage({viewport:{width:1512,height:1100}});fallback.on('pageerror',e=>errors.push(e.message));await fallback.route('**/vendor/3dmol/3Dmol-min.js',route=>route.abort());await fallback.goto('http://127.0.0.1:8765');await fallback.locator('#top3Results[open]').waitFor();await fallback.waitForFunction(()=>[...document.querySelectorAll('.top3-molecule')].every(e=>e.dataset.state==='error'));await checkCards(fallback,expected('sars'));assert.equal(await fallback.locator('.top3-retry:visible').count(),3);await fallback.locator('#top3Explore').click();assert.equal(await fallback.locator('#resultCount').textContent(),'360');await fallback.close();
 assert.deepEqual(errors,[]);console.log('PASS: loading/success/failure gating; correct actual top-three IDs, scores and ranks across contexts; independent 3D controls and reset; one shared chemistry worker; close/Escape/focus; manual reopen; no reveal on rerenders or duplicate completion; details and all-results navigation; unchanged JSON results; unsupported target; one/two/zero-result boundaries; responsive layout at 320–1512px; reduced motion; honest renderer fallback; no page errors.');
}finally{await browser.close()}
