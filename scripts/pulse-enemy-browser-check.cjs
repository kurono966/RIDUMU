const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.RIDUMU_BROWSER?{executablePath:process.env.RIDUMU_BROWSER}:{})});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;
  await page.goto(url+'?debug=1');await page.locator('[data-choose-mode="normal"]').click();
  for(const kind of ['pulse','fly','stone','machine','plant','ghost','crystal','furnace','conductor']){
   await page.locator('#openPlaySettings').click();await page.locator('#openDebug').click();
   assert.equal(await page.locator('#debugEnemy option').count(),9);
   await page.selectOption('#debugEnemy',kind);await page.locator('#debugFightEnemy').click();
   assert.equal(await page.evaluate(()=>enemies[stage].kind),kind);assert.equal(await page.evaluate(()=>state),'ready');
   assert.equal(await page.locator('#debugDialog').evaluate(e=>e.open),false);
  }
  const rendered=await page.evaluate(async()=>{
   const rate=48000,bpm=standardEnemies.find(e=>e.kind==='pulse').bpm,duration=480/bpm;
   async function render(kind,kicks=[],saved=null,volume=1){
    const c=new OfflineAudioContext(1,Math.ceil(rate*(duration+.1)),rate);let now=0,tick;
    const host={state:'running',get currentTime(){return now},destination:c.destination,createGain:()=>c.createGain(),createBiquadFilter:()=>c.createBiquadFilter(),createOscillator:()=>c.createOscillator()};
    const m=EnemyMusic.create(host,c.destination,{setInterval(fn){tick=fn;return 1},clearInterval(){}});
    m.setEnemy(kind,bpm);if(saved)m.setSnapshot(saved);m.start(.01,.01+duration);
    const accepted=kicks.map(t=>m.duckForKick(t,volume));
    for(now=.025;now<duration+.05;now+=.025)tick();
    return {data:(await c.startRendering()).getChannelData(0),accepted};
   }
   const base=await render('pulse'),dipped=await render('pulse',[1.5,.5,.4]),backing=await render('pulse',[.4],null,.65);
   const saved=JSON.parse(JSON.stringify(EnemyMusic.snapshot('pulse',bpm))),replay=await render('stone',[1.5,.5,.4],saved);
   const other=await render('stone',[.4]),otherBase=await render('stone');
   const energy=(a,start,end)=>Math.sqrt(a.slice(Math.round(start*rate),Math.round(end*rate)).reduce((s,v)=>s+v*v,0)/((end-start)*rate));
   const oldTone=EnemyMusic.snapshot('pulse',bpm);Object.assign(oldTone.tone,{harmonic:0,cutoff:1500,attack:.035,decay:.1,sustain:.92,level:.85});
   const old=await render('pulse',[],oldTone),beat=60/bpm,onBeat=await render('pulse',Array.from({length:8},(_,i)=>.01+i*beat));
   const attackGain=energy(base.data,.011,.03)/energy(old.data,.011,.03);
   const pumpDip=energy(onBeat.data,.01+beat+.015,.01+beat+.035)/energy(base.data,.01+beat+.015,.01+beat+.035);
   const pumpRecovery=energy(onBeat.data,.01+beat+.69,.01+beat+.71)/energy(base.data,.01+beat+.69,.01+beat+.71);
   const ratio=(start,end)=>energy(dipped.data,start,end)/energy(base.data,start,end);
   let replayError=0,otherError=0,peak=0;for(let i=0;i<base.data.length;i++){replayError=Math.max(replayError,Math.abs(dipped.data[i]-replay.data[i]));otherError=Math.max(otherError,Math.abs(other.data[i]-otherBase.data[i]));peak=Math.max(peak,Math.abs(dipped.data[i]));}
   // The real game must pass only successfully played Kick hits to this bus.
   debugSelectEnemy('pulse');audio();await DrumAudio.ready;muted=false;
   let calls=[];const original=enemyMusic.duckForKick;enemyMusic.duckForKick=(...args)=>calls.push(args);
   sampleSound('snare',ctx.currentTime);sampleSound('hat',ctx.currentTime);sampleSound('kick',ctx.currentTime,.65);
   enemyMusic.duckForKick=original;
   return {bpm,duration,attackGain,pumpDip,pumpRecovery,dipRatio:ratio(.415,.435),retriggerRatio:ratio(.515,.535),backingRatio:energy(backing.data,.415,.435)/energy(base.data,.415,.435),recoveredRatio:ratio(1.2,1.22),accepted:dipped.accepted,otherAccepted:other.accepted,replayError,otherError,peak,kickCalls:calls.length,kickVolume:calls[0]?.[1],sidechain:saved.sidechain};
  });
  assert.equal(rendered.bpm,78);assert.equal(rendered.duration,480/78);
  assert.ok(rendered.attackGain>2);assert.ok(rendered.pumpDip<.15);assert.ok(Math.abs(rendered.pumpRecovery-1)<.0001);
  assert.ok(rendered.dipRatio<.15);assert.ok(rendered.retriggerRatio<.15);assert.ok(rendered.backingRatio<.32);assert.ok(Math.abs(rendered.recoveredRatio-1)<.0001);
  assert.deepEqual(rendered.accepted,[true,true,true]);assert.deepEqual(rendered.otherAccepted,[false]);
  assert.ok(rendered.replayError<1e-6);assert.ok(rendered.otherError<1e-6);assert.ok(rendered.peak<.4);
  assert.equal(rendered.kickCalls,1);assert.equal(rendered.kickVolume,.65);
  await page.setViewportSize({width:390,height:844});await page.locator('#openPlaySettings').click();await page.locator('#openDebug').click();
  assert.ok(await page.locator('#debugDialog').evaluate(e=>e.scrollWidth<=e.clientWidth));
  await page.goto(url);await page.locator('[data-choose-mode="normal"]').click();assert.equal(await page.locator('#openDebug').isVisible(),false);assert.equal(await page.evaluate(()=>debugSelectEnemy('pulse')),false);
  assert.deepEqual(errors,[]);console.log('PASS: all nine DEV jumps, normal-mode guard, mobile layout, live Kick routing and rendered sidechain/retrigger/recovery/saved playback',rendered);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1;});
