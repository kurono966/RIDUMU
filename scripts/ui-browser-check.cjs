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
 const continuousContext=await browser.newContext(),continuous=await continuousContext.newPage();continuous.on('pageerror',e=>errors.push(e.message));
 await continuous.goto(page.url());await continuous.click('#openPlaySettings');await continuous.check('#continuousInput');await continuous.click('#closePlaySettings');await continuous.reload();
 assert.equal(await continuous.locator('#continuousInput').isChecked(),true);
 await continuous.evaluate(()=>{enemies[0].bpm=240;let originalClick=clickSound;globalThis.continuousRims=0;clickSound=(...args)=>{globalThis.continuousRims++;originalClick(...args)};globalThis.continuousAttacks=0;globalThis.continuousCounters=0;playbackAttack=async()=>{globalThis.continuousAttacks++};enemyCounter=async()=>{globalThis.continuousCounters++};});
 await continuous.click('#start');const starts=[];
 for(const [turnNumber,phaseName,key] of [[1,'hat','h'],[1,'parts','a'],[2,'parts','a'],[3,'parts','l']]){
  await continuous.waitForFunction(({turnNumber,phaseName})=>state==='recording'&&turn===turnNumber&&phase===phaseName,{turnNumber,phaseName});
  starts.push(await continuous.evaluate(()=>recordAudioAt));await continuous.keyboard.press(key);
 }
 for(let i=1;i<starts.length;i++)assert(Math.abs(starts[i]-starts[i-1]-2)<1e-8,'continuous phase drift');
 await continuous.waitForFunction(()=>turn===4&&phase==='hat'&&state==='recording');
 assert.deepEqual(await continuous.evaluate(()=>[globalThis.continuousRims,globalThis.continuousAttacks,globalThis.continuousCounters]),[0,1,1]);
 const recorded=await continuous.evaluate(()=>sequenceStore.list().find(entry=>entry.tracks.some(track=>track.voice==='lead')));
 assert(recorded.tracks.some(track=>track.voice==='bass'&&track.notes.length));assert(recorded.tracks.some(track=>track.voice==='lead'&&track.notes.length));
 await continuous.click('#start');assert.equal(await continuous.evaluate(()=>state),'ready');await continuous.waitForTimeout(2100);assert.equal(await continuous.evaluate(()=>state),'ready');await continuousContext.close();
 assert.deepEqual(errors,[]);console.log('PASS: nine viewports, all parts/results, effects preserve controls, settings and analysis, continuous recording on the real audio clock without rimshots or phase drift, persisted opt-in, saved parts and safe stop.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});


