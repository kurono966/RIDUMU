const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.RIDUMU_BROWSER});
 try {
 const page=await browser.newPage(),errors=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
 await page.click('[data-choose-mode="normal"]');
 await page.evaluate(()=>{audio();muted=true;autoHat=true;hatReady=true;noteMode="seven";});
 const box=async selector=>page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,r:r.right};});
 const accessible=async selector=>{
  assert(await page.locator(selector).isVisible(),selector+' visible');
  assert(await page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&(e===hit||e.contains(hit));}),selector+' reachable');
 };
 for(const mode of ['normal','roguelite']) {
  if(mode==='roguelite') {await page.reload();await page.click('[data-choose-mode="roguelite"]');await page.evaluate(()=>{audio();muted=true;autoHat=true;hatReady=true;noteMode='seven';rogueRun.phase='battle';rogueRun.gear=[{id:'echo',rank:1}];});}
  for(const [width,height] of [[1920,1080],[1366,768],[1280,720],[1024,600]]) {
   await page.setViewportSize({width,height});
   let baseline;
   for(const turnValue of [0,1,2,3])for(const result of [false,true])for(const effects of [false,true]) {
    await page.evaluate(({turnValue,result})=>{state='recording';phase=turnValue===0?'hat':'parts';turn=Math.max(1,turnValue);recordAudioAt=ctx.currentTime;continuousRunning=true;updatePhaseUI();update();$('result').hidden=!result;$('moveName').textContent='風裂連打';$('damage').textContent='128';}, {turnValue,result});
    if((await page.locator('#effectsPanel').isVisible())!==effects)await page.click('#toggleEffects');
    await page.waitForTimeout(30);
    const arena=await box('#arena'),consoleBox=await box('.console'),timeline=await box('.timeline'),controls=await box('.controls');
    assert(arena.b<=consoleBox.y,JSON.stringify({arena,consoleBox}));
    assert(Math.abs(arena.h/(arena.h+consoleBox.h)-.35)<.01,'35:65 ratio');
    assert(timeline.w>consoleBox.w*.95,'wide timeline');
    assert(timeline.h>=64,'readable timeline');
    assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth),'no page scroll');
    for(const selector of ['#start','#toggleEffects','#enemyHp','#playerHp','#shieldValue','#enemyIntent',turnValue===0?'#hat':turnValue===1?'#kick':'#note0'])await accessible(selector);
    if(effects) {await accessible('#filterPad');assert.equal(await page.locator('#effectsPanel').evaluate(e=>e.parentElement.classList.contains('console')),true);}
    if(result)for(const selector of ['#timingAccuracy','#openResultDetails'])await accessible(selector);
    if(!baseline)baseline={timeline,controls};
    assert(Math.abs(baseline.timeline.y-timeline.y)<1&&Math.abs(baseline.controls.y-controls.y)<1,'stable positions');
    checks.push({mode,width,height,turnValue,result,effects});
   }
   if(process.env.RIDUMU_SCREENSHOTS){require('node:fs').mkdirSync(process.env.RIDUMU_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.RIDUMU_SCREENSHOTS,`stacked-${mode}-${width}x${height}.png`)});}
  }
 }
 await page.evaluate(()=>{state='ready';continuousRunning=false;update();});
 await page.click('#openMenu');await page.click('#openLayout');await page.click('#layoutAll');await page.click('#closeLayout');
 await accessible('#start');await accessible('#filterPad');
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.locator('#effectsPanel').evaluate(e=>e.parentElement.id),'arena');
 await page.setViewportSize({width:1280,height:720});
 await page.waitForFunction(()=>document.querySelector('.console>#effectsPanel'));
 for(const result of ['top','bottom'])for(const timeline of ['top','middle','bottom']) {
  await page.click('#openMenu');await page.click('#openLayout');
  await page.selectOption('[data-layout="result"]',result);await page.selectOption('[data-layout="timeline"]',timeline);await page.click('#closeLayout');
  await accessible('#start');await accessible('#filterPad');
  const a=await box('.timeline'),b=await box('#effectsPanel');
  assert(Math.min(a.r,b.r)<=Math.max(a.x,b.x)+1||Math.min(a.b,b.b)<=Math.max(a.y,b.y)+1,'custom timeline does not overlap effects');
 }
 await page.locator('#toggleGearDetails').click();await accessible('#start');
 await page.locator('#toggleGearDetails').click();
 await page.evaluate(()=>document.documentElement.requestFullscreen());
 await accessible('#start');await page.evaluate(()=>document.exitFullscreen());
 assert.deepEqual(errors,[]);
 console.log(`Stacked desktop layout: ${checks.length} phase/result/effects cases passed, plus preferences and responsive reparenting.`);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
