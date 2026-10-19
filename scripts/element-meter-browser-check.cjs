const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.RIDUMU_PLAYWRIGHT_PATH||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,args:['--disable-logging'],executablePath:process.env.RIDUMU_CHROME});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.RIDUMU_GAME_URL||require('node:url').pathToFileURL(path.resolve(__dirname,'../index.html')).href);
 await page.click('[data-choose-mode="normal"]');
 await page.evaluate(()=>{audio();phase='parts';state='recording';turn=1;notes=[];recordAudioAt=ctx.currentTime;updateInstrument();RidumuUI.refresh();});
 await page.keyboard.press('a');await page.waitForFunction(()=>ElementMeterUI.model?.count===1);
 assert.equal(await page.locator('#elementStatus').textContent(),'予測?');
 await page.keyboard.press('l');await page.keyboard.press('a');await page.waitForFunction(()=>ElementMeterUI.model?.count===3,null,{timeout:5000});
 assert.equal(await page.locator('#elementStatus').textContent(),'予測');assert(await page.locator('#nextAction').textContent().then(s=>s.includes('→')));
 await page.click('#element-wind');assert(!(await page.locator('#elementDialog').isVisible()));assert(await page.locator('#elementHint').isVisible());
 // Exercise the real drum finish hook, then verify that bass input cannot change it.
 await page.evaluate(async()=>{await finish();});
 assert.equal(await page.locator('#elementStatus').textContent(),'確定');
 const final=await page.evaluate(()=>({scores:ElementMeterUI.model.scores,element:ElementMeterUI.model.actualElement}));
 assert.deepEqual(final,await page.evaluate(()=>{const t=timing(),raw=tracks.get('drums'),a=Groove.enrich(Rhythm.analyze(Quantize.render(raw,t.bpm,t.duration),t.duration,t.bpm),Groove.analyzeRelations(raw,hatNotes,t.bpm,t.duration));return {scores:a.scores,element:a.element};}));
 await page.evaluate(()=>{turn=2;state='recording';phase='parts';notes=[{type:'kick',t:0,midi:36}];ElementMeterUI.observe();});
 assert.deepEqual(final,await page.evaluate(()=>({scores:ElementMeterUI.model.scores,element:ElementMeterUI.model.actualElement})));
 await page.evaluate(()=>{state='ready';RidumuUI.refresh();});await page.click('#element-wind');assert(await page.locator('#elementDialog').isVisible());assert(await page.locator('#element-help-wind').getAttribute('open')!==null);await page.keyboard.press('a');assert.equal(await page.evaluate(()=>state),'ready');await page.click('#closeElementDialog');
 for(const [width,height] of [[1440,900],[1280,720],[1024,600],[390,844],[320,568],[320,480],[844,390],[667,375],[740,360]]){
  await page.setViewportSize({width,height});
  for(const part of ['drums','bass','lead']){
   await page.evaluate(part=>{state='ready';turn=part==='drums'?1:part==='bass'?2:3;phase='parts';hatReady=true;continuousResume=true;noteMode=part==='drums'?'two':'nine';updateInstrument();syncNoteMode();setPadsVisible(true);RidumuUI.refresh();},part);
   const result=await page.evaluate(()=>({scroll:document.documentElement.scrollHeight>innerHeight+1,items:['elementMeter','start','scope',...(turn===1?['kick','snare']:['note0','note8'])].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return {id,rect:r.toJSON(),ok:r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight&&r.right<=innerWidth};})}));
   assert(!result.scroll,JSON.stringify({width,height,part,...result}));assert(result.items.every(x=>x.ok),JSON.stringify({width,height,part,...result}));
  }
 }
 await page.setViewportSize({width:390,height:844});if(process.env.RIDUMU_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.RIDUMU_SCREENSHOT_DIR,'element-meter-mobile.png')});
 await page.evaluate(()=>{stage=1;ElementMeterUI.observe();});assert.equal(await page.locator('#elementStatus').textContent(),'待機');
 await page.evaluate(()=>{turn=1;prepareTracksForTurn();ElementMeterUI.observe();});assert.equal(await page.evaluate(()=>ElementMeterUI.model.count),0);
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
 await page.evaluate(()=>{turn=1;phase='parts';state='recording';notes=[0,1,2,3].map(t=>({type:'kick',t}));ElementMeterUI.observe();notes=[0,.25,.5,.75,1,1.25,1.5,1.75].map(t=>({type:'snare',t}));ElementMeterUI.observe();});
 assert.equal(await page.locator('#elementMeter').evaluate(e=>e.getAnimations({subtree:true}).length),0,'reduced motion disables rank animation');
 await page.evaluate(()=>{ElementMeterUI.finalize([],[],timing().bpm,timing().duration);turn=2;ElementMeterUI.observe();});assert.equal(await page.locator('#elementStatus').textContent(),'無音');
 assert.deepEqual(errors,[]);console.log('Element meter: real inputs, final combat scores, freeze/reset, tips/dialog and 9 viewport layouts passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});




