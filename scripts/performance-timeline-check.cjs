const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.RIDUMU_BROWSER});try{
 const page=await b.newPage(),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);await page.click('[data-choose-mode="normal"]');
 await page.evaluate(()=>{audio();muted=true;});
 for(const [width,height] of [[1920,1080],[1366,768],[1280,720]]){
 await page.setViewportSize({width,height});
 for(const mode of ['two','four','seven','nine'])for(const part of [1,2,3])for(const overlays of [false,true]){
  const result=await page.evaluate(({mode,part,overlays})=>{
   noteMode=mode;turn=part;phase='parts';state='recording';recordAudioAt=ctx.currentTime-.7;continuousRunning=true;
   const beat=60/timing().bpm,make=(type,t,midi,duration)=>({type,t:t*beat,rawT:t*beat,...(midi!==undefined?{midi,duration:duration*beat}:{})});
   hatNotes=Array.from({length:16},(_,i)=>make('hat',i*.5));hatReady=true;
   tracks.clear();tracks.set('drums',[make('kick',0),make('snare',1),make('kick',2),make('snare',3),make('kick',4),make('kick',4.5),make('snare',5),make('snare',7)]);
   if(part>=3)tracks.set('bass',[make('kick',0,36,.8),make('snare',1.5,43,.4),make('kick',4,36,1.2),make('snare',6,39,.6)]);
   notes=part===1?[make('kick',0),make('snare',1)]:part===2?[make('kick',0,36,1),make('snare',2,43,.8)]:[make('kick',.5,60,.4),make('snare',1.5,67,.6),make('kick',3,63,.5),make('snare',5.5,72,1)];
   updatePhaseUI();update();$('result').hidden=!overlays;$('effectsPanel').hidden=!overlays;
   const before=JSON.stringify([...tracks]);const view=performanceTimelineView();
   return {lanes:view.lanes.map(l=>({id:l.id,count:l.notes.length,active:l.active})),unchanged:before===JSON.stringify([...tracks]),duration:view.duration};
  },{mode,part,overlays});
  await page.waitForTimeout(35);
  assert(result.unchanged);assert.equal(result.lanes.length,5);assert.equal(result.lanes[0].count,16);
  if(part>=2){assert(result.lanes[1].count>0);assert(result.lanes[2].count>0);}
  if(part===3)assert(result.lanes[3].count>0);
  assert.equal(result.lanes.filter(l=>l.active).length,part===1?2:1);
  assert(await page.locator('.timeline').evaluate(e=>e.classList.contains('five-lanes')));
  assert(await page.locator('#scope').evaluate(e=>e.height>0&&e.width>0));
  assert(await page.locator('#start').evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.bottom<=innerHeight+1&&(hit===e||e.contains(hit));}),'transport reachable');
  if(overlays)assert(await page.locator('#filterPad').isVisible());
  checks.push({width,height,mode,part,overlays});
  if(mode==='seven'&&overlays&&process.env.RIDUMU_SCREENSHOTS)await page.screenshot({path:path.join(process.env.RIDUMU_SCREENSHOTS,`timeline-${width}x${height}-part${part}.png`)});
 }
 }
 // Exercise actual keyboard input and release rather than just fixture rendering.
 await page.evaluate(()=>{turn=2;noteMode='seven';notes=[];phase='parts';recordAudioAt=ctx.currentTime;updatePhaseUI();update();});
 await page.keyboard.down('a');await page.waitForTimeout(90);
 assert(await page.evaluate(()=>performanceTimelineView().lanes[3].notes.length===1));
 assert(await page.evaluate(()=>heldInputs.size>0));
 await page.keyboard.up('a');assert(await page.evaluate(()=>notes[0].duration>0));
 await page.evaluate(()=>{state='attack';lastDuration=4;lastMix=[{voice:'hat',notes:hatNotes},{voice:'drums',notes:tracks.get('drums')},{voice:'bass',notes:[{type:'kick',t:1,midi:36,duration:.5}]},{voice:'lead',notes:[{type:'snare',t:2,midi:67,duration:.3}]}];attackPlayhead=1.5;});
 assert(await page.evaluate(()=>performanceTimelineView().lanes.every(l=>l.notes.length>0&&!l.active)));
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>!document.querySelector('.timeline').classList.contains('five-lanes'));
 await page.setViewportSize({width:1280,height:720});await page.waitForFunction(()=>document.querySelector('.timeline').classList.contains('five-lanes'));
 assert.deepEqual(errors,[]);console.log(`Five-lane timeline: ${checks.length} viewport / instrument / mode / overlay cases, real key hold/release, attack mix, immutable recordings and mobile fallback passed.`);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
