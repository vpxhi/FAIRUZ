import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const context=await chromium.launchPersistentContext('.runtime/ai-browser-profile',{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,viewport:{width:1512,height:1100}});
const page=await context.newPage();page.on('pageerror',e=>console.log('PAGE ERROR',e.message));
try{
 await page.goto('http://127.0.0.1:8765');await page.waitForFunction(()=>document.querySelector('#resultCount').textContent==='360');await page.locator('#virus').selectOption('flu');await page.locator('#autoSummary').uncheck();await page.locator('#runButton').click();await page.waitForFunction(()=>document.querySelector('#runStrip').textContent.includes('Influenza A'));
 await page.locator('#summarise').click();let last='';const timer=setInterval(async()=>{try{const s=await page.locator('#summaryStatus').textContent();if(s!==last){console.log('STATUS',s);last=s}}catch{}},8000);
 try{
 await page.waitForFunction(()=>!document.querySelector('#aiSummary').hidden||document.querySelector('#summaryStatus').textContent.startsWith('AI summary unavailable'),null,{timeout:300000});const summary=await page.locator('#aiSummary').innerText();console.log('SUMMARY',summary);assert.match(summary,/FZ-2078/i);assert.match(summary,/synthetic/i);assert.ok(!/PCR|vaccine|tested patients/i.test(summary));
 await page.locator('#chatInput').fill('Which compound ranks first? Are these measured biological results?');await page.locator('#chatSend').click();await page.waitForFunction(()=>document.querySelectorAll('#messages .message.assistant').length>=2,null,{timeout:180000});const answer=await page.locator('#messages .message.assistant').last().innerText();console.log('ANSWER',answer);assert.match(answer,/FZ-2078/i);assert.match(answer,/synthetic/i);await page.screenshot({path:'.runtime/research-with-ai.png',fullPage:true});console.log('PASS: actual AI summary and Q&A name the correct compound and preserve the synthetic-data scope.');
 }finally{clearInterval(timer)}
}finally{await context.close()}
