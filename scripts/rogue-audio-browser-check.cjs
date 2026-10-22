const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.RIDUMU_BROWSER?{executablePath:process.env.RIDUMU_BROWSER}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  await page.locator('[data-choose-mode="roguelite"]').click();
  await page.evaluate(()=>{rogueRun.rewards=[{id:'masterDrive',rank:1},{id:'masterRoom',rank:1},{id:'leadChorus',rank:1}];});
  await page.locator('#start').click();assert.match(await page.locator('#rogueChoices').innerText(),/音響は装備中/);
  await page.setViewportSize({width:390,height:844});assert.ok(await page.locator('#rogueRewardDialog').evaluate(el=>el.scrollWidth<=el.clientWidth));
  if(process.env.RIDUMU_SCREENSHOTS)await page.screenshot({path:path.join(process.env.RIDUMU_SCREENSHOTS,'rogue-fx-rewards-mobile.png')});
  await page.locator('[data-rogue-choice="masterDrive"]').click();await page.evaluate(()=>audio());
  assert.equal(await page.evaluate(()=>rogueAudio.state.gear[0].id),'masterDrive');
  await page.evaluate(()=>{for(const id of ['masterRoom','bassChorus','leadFlanger'])RogueRun.equip(rogueRun,{id,rank:1});renderRogueRun();});
  assert.equal(await page.evaluate(()=>rogueAudio.state.gear.length),4);
  await page.evaluate(()=>{RogueRun.upgrade(rogueRun,'leadFlanger');renderRogueRun();});
  assert.equal(await page.evaluate(()=>rogueAudio.state.gear.find(g=>g.id==='leadFlanger').rank),2);
  await page.locator('#sound').click();assert.equal(await page.evaluate(()=>rogueAudio.state.muted),true);await page.locator('#sound').click();
  const rendered=await page.evaluate(async()=>{
   const rate=24000,seconds=4;
   async function render(items=[],voice='lead',{reset=false,mute=false,bpm=120,synth=false}={}){
    const c=new OfflineAudioContext(1,rate*seconds,rate),sum=c.createGain(),rack=RogueAudio.create(c,sum);sum.connect(rack.masterInput);rack.output.connect(c.destination);rack.configure(items,bpm,.01);if(reset)rack.configure([],bpm);if(mute)rack.setMuted(true);
    if(synth){const engine=Synth.engine(c,sum);engine.setPartOutputs(rack.parts);engine.play(voice,voice==='bass'?110:220,.01,.8,.25,{snapshot:{version:1,patch:Synth.patch({},voice),events:[]},noteTime:0});}
    else{const osc=c.createOscillator(),amp=c.createGain();osc.type='sawtooth';osc.frequency.value=voice==='bass'?110:220;amp.gain.setValueAtTime(0,.01);amp.gain.linearRampToValueAtTime(.16,.015);amp.gain.setValueAtTime(.16,.26);amp.gain.linearRampToValueAtTime(0,.28);osc.connect(amp);amp.connect(rack.parts[voice]??sum);osc.start(.01);osc.stop(.3);}
    const state=rack.state,data=(await c.startRendering()).getChannelData(0);return {data,state};
   }
   const diff=(a,b)=>a.reduce((s,v,i)=>s+Math.abs(v-b[i]),0),maxDiff=(a,b)=>a.reduce((s,v,i)=>Math.max(s,Math.abs(v-b[i])),0),energy=(a,start)=>a.slice(Math.floor(rate*start)).reduce((s,v)=>s+v*v,0);
   const base={};for(const voice of ['bass','lead','drums'])base[voice]=(await render([],voice)).data;
   const rows=[];for(const g of RogueRun.gear.filter(g=>g.audio)){
    const voice=g.audio.target==='master'?'drums':g.audio.target,a=await render([{id:g.id,rank:1}],voice),b=await render([{id:g.id,rank:2}],voice);
    let isolation=0;if(g.audio.target!=='master'){const other=voice==='bass'?'lead':'bass';isolation=maxDiff((await render([{id:g.id,rank:2}],other)).data,base[other]);}
    const restored=await render([{id:g.id,rank:2}],voice,{reset:true});rows.push({id:g.id,difference:diff(a.data,base[voice]),upgradeDifference:diff(a.data,b.data),isolation,resetError:maxDiff(restored.data,base[voice]),peak:b.data.reduce((m,v)=>Math.max(m,Math.abs(v)),0),tail:energy(b.data,.35),resetOscillators:restored.state.oscillators});
   }
   const inventory=[{id:'masterDrive',rank:2},{id:'masterRoom',rank:2},{id:'leadDelay',rank:2},{id:'bassFlanger',rank:2}],a=await render(inventory),b=await render(JSON.parse(JSON.stringify(inventory))),muted=await render(inventory,'lead',{mute:true});
   const fastDelay=await render([{id:'leadDelay',rank:1}]),slowDelay=await render([{id:'leadDelay',rank:1}],'lead',{bpm:78});
   const earlyEnergy=data=>data.slice(rate*.4,rate*.55).reduce((sum,v)=>sum+v*v,0);
   const synthDry=await render([],'lead',{synth:true}),synthWet=await render([{id:'leadChorus',rank:2}],'lead',{synth:true}),bassDry=await render([],'bass',{synth:true}),bassUnaffected=await render([{id:'leadChorus',rank:2}],'bass',{synth:true});
   const saved=SequenceHistory.snapshot({bpm:120,duration:4,tracks:[{voice:'lead',notes:[{type:'kick',t:0,midi:60,duration:.3}]}],audioGear:inventory});sequenceStore.add(saved);
   prepareMode('normal');await playHistory(saved);
   const historyGear=rogueAudio.state.gear;stopHistoryPlayback();const normalGear=rogueAudio.state.gear;
   return {rows,repeatError:maxDiff(a.data,b.data),mutedEnergy:energy(muted.data,.2),historyGear,normalGear,fastDelayEarly:earlyEnergy(fastDelay.data),slowDelayEarly:earlyEnergy(slowDelay.data),synthDifference:diff(synthDry.data,synthWet.data),synthIsolation:maxDiff(bassDry.data,bassUnaffected.data)};
  });
  for(const row of rendered.rows){assert.ok(row.difference>1,row.id);assert.ok(row.upgradeDifference>.1,row.id);assert.ok(row.isolation<1e-6,row.id);assert.ok(row.resetError<1e-6,row.id);assert.equal(row.resetOscillators,0);assert.ok(row.peak<1,row.id);}
  for(const id of ['masterRoom','leadDelay'])assert.ok(rendered.rows.find(row=>row.id===id).tail>.001,id+' tail');
  assert.ok(rendered.repeatError<1e-6);assert.ok(rendered.mutedEnergy<1e-12);assert.equal(rendered.historyGear.length,4);assert.deepEqual(rendered.normalGear,[]);assert.deepEqual(errors,[]);
  assert.ok(rendered.fastDelayEarly>.001);assert.ok(rendered.slowDelayEarly<1e-12);assert.ok(rendered.synthDifference>1);assert.ok(rendered.synthIsolation<1e-6);
  console.log('PASS: ten real effects, target isolation, upgrades, swapping/reset, mute, deterministic audio, saved history and normal-mode cleanup',rendered);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1;});
