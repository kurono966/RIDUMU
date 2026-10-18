const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.RIDUMU_PLAYWRIGHT_PATH||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,args:['--disable-logging'],executablePath:process.env.RIDUMU_CHROME});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(require('node:url').pathToFileURL(path.resolve(__dirname,'../index.html')).href);
 const ids=await page.locator('[id]').evaluateAll(nodes=>nodes.map(n=>n.id));assert.equal(new Set(ids).size,ids.length);
 for(const [width,height] of [[1440,900],[1280,720],[1024,600],[390,844],[320,568],[320,480],[844,390],[667,375],[740,360]]){
  await page.setViewportSize({width,height});
  for(const part of ['hat','drums','bass','lead'])for(const result of [false,true]){
   await page.evaluate(({part,result})=>{state='ready';turn=part==='bass'?2:part==='lead'?3:1;hatReady=part!=='hat';noteMode=part==='lead'?'seven':'two';phase=part==='hat'?'hat':'parts';updateInstrument();syncNoteMode();setPadsVisible(true);document.getElementById('result').hidden=!result;RidumuUI.refresh();},{part,result});
   const before=await page.locator('#start').boundingBox();await page.click('#toggleEffects');
   const after=await page.locator('#start').boundingBox();assert.deepEqual(after,before,'effects moved the transport');
   const checks=await page.evaluate(()=>{const c=document.querySelector('.console');return ['start',...(c.classList.contains('hat-phase')?['hat']:noteMode==='seven'?['note0','note6']:['kick','snare'])].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{id,ok:r.width>0&&r.height>=40&&r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth&&!!hit&&(e===hit||e.contains(hit))};});});assert(checks.every(c=>c.ok),JSON.stringify({width,height,part,result,checks}));
   await page.click('#closeEffects');
  }
 }
 await page.setViewportSize({width:390,height:844});await page.click('#openPlaySettings');
 assert(await page.locator('#quantizeMode').isVisible());assert(await page.locator('#noteMode').isVisible());
 await page.focus('#quantizeMode');await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>state),'ready','settings must block performance shortcuts');
 await page.click('#openSynth');assert(await page.locator('#synthDialog').isVisible());assert(!(await page.locator('#playSettingsDialog').isVisible()));await page.click('#closeSynth');
 await page.evaluate(()=>{document.getElementById('result').hidden=false;document.getElementById('ensembleList').textContent='アンサンブル';document.getElementById('sequence').textContent='入力したリズム';});await page.click('#openResultDetails');
 for(const [tab,panel] of [['rhythmTab','rhythmPanel'],['ensembleTab','ensemblePanel'],['damageTab','summaryPanel'],['summaryTab','summaryPanel']]){await page.click('#'+tab);await page.waitForTimeout(40);assert(await page.locator('#'+panel).isVisible());}
 assert(await page.locator('#analysisReplay').isVisible());await page.keyboard.press('Escape');assert(!(await page.locator('#resultDetailsDialog').isVisible()));
 // A separate context exercises the real audio clock and persisted opt-in.
 const continuousContext=await browser.newContext({hasTouch:true}),continuous=await continuousContext.newPage();continuous.on('pageerror',e=>errors.push(e.message));
 await continuous.goto(page.url());await continuous.click('#openPlaySettings');await continuous.check('#continuousInput');await continuous.click('#closePlaySettings');await continuous.reload();
 assert.equal(await continuous.locator('#continuousInput').isChecked(),true);
 await continuous.evaluate(()=>{enemies[0].bpm=240;let originalClick=clickSound;globalThis.continuousRims=[];clickSound=(...args)=>{globalThis.continuousRims.push({turn,phase,at:args[1],start:recordAudioAt});originalClick(...args)};globalThis.continuousAttacks=0;globalThis.continuousCounters=0;playbackAttack=async()=>{globalThis.continuousAttacks++};enemyCounter=async()=>{globalThis.continuousCounters++};});
 await continuous.click('#start');const starts=[];
 for(const [turnNumber,phaseName,key] of [[1,'hat','h'],[1,'parts','a'],[2,'parts','a'],[3,'parts','l']]){
  await continuous.waitForFunction(({turnNumber,phaseName})=>state==='recording'&&turn===turnNumber&&phase===phaseName,{turnNumber,phaseName});
  starts.push(await continuous.evaluate(()=>recordAudioAt));await continuous.keyboard.press(key);
 }
 for(let i=1;i<starts.length;i++)assert(Math.abs(starts[i]-starts[i-1]-2)<1e-8,'continuous phase drift');
 await continuous.waitForFunction(()=>turn===4&&phase==='hat'&&state==='recording');
 assert.deepEqual(await continuous.evaluate(()=>[globalThis.continuousRims.filter(n=>n.turn===1&&n.phase==='hat').length,globalThis.continuousRims.filter(n=>n.phase==='parts').length,globalThis.continuousAttacks,globalThis.continuousCounters]),[12,0,1,1]);
 const recorded=await continuous.evaluate(()=>sequenceStore.list().find(entry=>entry.tracks.some(track=>track.voice==='lead')));
 assert(recorded.tracks.some(track=>track.voice==='bass'&&track.notes.length));assert(recorded.tracks.some(track=>track.voice==='lead'&&track.notes.length));
 await continuous.click('#start');assert.equal(await continuous.evaluate(()=>state),'ready');await continuous.waitForTimeout(2100);assert.equal(await continuous.evaluate(()=>state),'ready');
 for(const seamless of [false,true]){
  await continuous.reload();await continuous.click('#openPlaySettings');await continuous.check('#autoHat');await continuous.locator('#continuousInput').setChecked(seamless);await continuous.click('#closePlaySettings');await continuous.reload();
  assert(await continuous.locator('#autoHat').isChecked());assert.equal(await continuous.locator('#continuousInput').isChecked(),seamless);
  await continuous.evaluate(()=>{enemies[0].bpm=240;let original=clickSound;globalThis.autoRims=0;clickSound=(...args)=>{globalThis.autoRims++;original(...args)};});
  await continuous.click('#start');assert(await continuous.evaluate(()=>recordAudioAt-ctx.currentTime>.7),'auto Hat must retain the opening count-in');
  await continuous.waitForFunction(()=>state==='recording'&&turn===1);assert.equal(await continuous.evaluate(()=>phase),'parts');
  assert.deepEqual(await continuous.evaluate(()=>[hatReady,hatNotes.length,hatNotes[1].t,globalThis.autoRims]),[true,16,.125,4]);
  await continuous.keyboard.press('a');await continuous.waitForFunction(()=>turn===2&&['ready','recording'].includes(state));
  const autoSaved=await continuous.evaluate(()=>sequenceStore.list()[0].tracks.find(t=>t.voice==='hat'));
  assert.equal(autoSaved.notes.length,16);assert.equal(autoSaved.notes[15].t,1.875);
  if(seamless){assert.equal(await continuous.evaluate(()=>globalThis.autoRims),4);await continuous.click('#start');}
 }
 // Anticipated notes must sound once in the destination voice, survive the
 // real clock handoff and remain negative in raw timing/history.
 await continuous.reload();await continuous.click('#openPlaySettings');await continuous.selectOption('#noteMode','four');await continuous.click('#closePlaySettings');
 await continuous.evaluate(()=>{enemies[0].bpm=240;globalThis.earlyLive=[];const original=sound;sound=(...args)=>{if(args[1]===undefined)globalThis.earlyLive.push(args[2]);return original(...args)};});
 await continuous.click('#start');await continuous.waitForFunction(()=>upcomingInputTrack()?.voice==='bass');await continuous.keyboard.press('s');
 assert.equal(await continuous.evaluate(()=>pendingTrackInput?.notes[0].midi),39);
 await continuous.waitForFunction(()=>turn===2&&state==='recording');
 assert(await continuous.evaluate(()=>notes.length===1&&notes[0].rawT<0&&notes[0].t===0&&notes[0].midi===39));
 await continuous.waitForFunction(()=>upcomingInputTrack()?.voice==='lead');await continuous.tap('#note2');
 assert.equal(await continuous.evaluate(()=>pendingTrackInput?.notes[0].midi),63);
 await continuous.waitForFunction(()=>turn===3&&state==='recording');
 assert(await continuous.evaluate(()=>notes.length===1&&notes[0].rawT<0&&notes[0].midi===63));
 assert.deepEqual(await continuous.evaluate(()=>globalThis.earlyLive),['bass','lead'],'anticipation must sound once, using each destination voice');
 assert(await continuous.evaluate(()=>sequenceStore.list().some(entry=>entry.tracks.some(track=>track.voice==='bass'&&track.notes.some(note=>note.rawT<0)))));
 await continuous.click('#start');
 await continuousContext.close();
 assert.deepEqual(errors,[]);console.log('PASS: nine viewports, settings and analysis, continuous phase timing, opening count-in and Hat metronome, auto Hat, keyboard/touch anticipation with destination voices and saved raw timing, safe stop.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});


