const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.RIDUMU_PLAYWRIGHT_PATH||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,args:['--disable-logging'],executablePath:process.env.RIDUMU_CHROME});try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.RIDUMU_GAME_URL||require('node:url').pathToFileURL(path.resolve(__dirname,'../index.html')).href);await page.click('#sound');
 await page.evaluate(()=>{audio();muted=false;enemies[0].bpm=240;enemies[0].attack=40;enemies[0].hp=1000;enemyHp=1000;hatReady=true;hatNotes=[0,.5,1,1.5].map(t=>({type:'hat',t,rawT:t}));turn=1;notes=[0,.5,1,1.5].map((t,i)=>({type:i%2?'snare':'kick',t,rawT:t}));});
 await page.evaluate(()=>finish());
 // Real keyboard input records palette position, including custom transposition.
 await page.evaluate(()=>{noteMode='two';state='recording';phase='parts';recordAudioAt=ctx.currentTime;notes=[];updateInstrument();});await page.keyboard.press('a');
 assert.equal(await page.evaluate(()=>notes[0].register),0);
 await page.evaluate(()=>{notes=[0,.5,1,1.5].map(t=>({type:'kick',t,rawT:t,midi:36,register:0,duration:.35}));});await page.evaluate(()=>finish());
 assert(await page.locator('#pitchOutcome').isVisible());assert.match(await page.locator('#pitchOutcome').textContent(),/盾/);
 await page.evaluate(()=>{const original=enemyCounter;enemyCounter=async(a,report,result)=>{const reduction=PerformanceCombat.reduction(cycleLead,cycleBass,cycleEnsemble,a),expected=PerformanceCombat.receive(hp,shield,enemies[stage].attack,reduction.total);globalThis.pitchAttackForCheck=a;globalThis.pitchCheck={expected,reduction,applied:a.pitchApplied,guard:result.calculation.guard,bass:cycleBass.pitch.effects};await original(a,report,result);globalThis.pitchCheck.actual={hp,shield};};
  state='recording';phase='parts';recordAudioAt=ctx.currentTime;notes=[72,60,60,67,60,60].map((midi,i)=>({type:'kick',midi,register:PitchCombat.register(midi,[60,67,72]),t:i*.3,rawT:i*.3,duration:.22}));});
 await page.evaluate(()=>finish());
 const combat=await page.evaluate(()=>pitchCheck);assert.equal(combat.actual.hp,combat.expected.hp);assert.equal(combat.actual.shield,combat.expected.shield);assert(combat.reduction.pitch>0);assert(combat.guard.pierce>0);assert(combat.guard.multiplier>.8);assert(combat.bass.shield>0);
 assert.match(await page.locator('#pitchOutcome').textContent(),/命中 -/);
 const entry=await page.evaluate(()=>sequenceStore.list()[0]);assert.equal(entry.tracks.find(t=>t.voice==='bass').notes[0].register,0);assert.equal(entry.tracks.find(t=>t.voice==='lead').notes[0].midi,72);
 await page.click('#openResultDetails');await page.locator('#pitchAnalysis summary').click();assert.equal(await page.locator('#pitchDetails svg').count(),2);assert.match(await page.locator('#pitchDetails').textContent(),/シールド貫通/);assert.match(await page.locator('#pitchDetails').textContent(),/命中効率/);
 await page.locator('.pitch-cause').filter({hasText:'大きな跳躍'}).click();assert(await page.locator('.pitch-highlight').count()>0);if(process.env.RIDUMU_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.RIDUMU_SCREENSHOT_DIR,'pitch-analysis.png')});await page.click('#closeResultDetails');
 for(const [width,height] of [[1280,720],[1024,600],[390,844],[320,568],[320,480],[844,390],[667,375],[740,360]]){await page.setViewportSize({width,height});await page.evaluate(()=>{RidumuUI.refresh();});
  const box=await page.locator('#start').boundingBox();assert(box.x>=0&&box.y>=0&&box.y+box.height<=height+1);assert(await page.locator('#pitchOutcome').isVisible());assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1));
 }
 await page.setViewportSize({width:390,height:844});await page.evaluate(async()=>{await playHistory(sequenceStore.list()[0]);});
 await page.waitForFunction(()=>document.getElementById('melodyTrend').textContent.includes('LEAD'));assert.equal(await page.evaluate(()=>state),'ready');await page.evaluate(()=>stopHistoryPlayback());
 if(process.env.RIDUMU_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.RIDUMU_SCREENSHOT_DIR,'pitch-mobile.png')});
 await page.evaluate(()=>PitchUI.result(cycleBass,cycleLead,pitchAttackForCheck,Rhythm.resolve(pitchAttackForCheck,{kind:'fly'})));
 assert.match(await page.locator('#pitchDetails').textContent(),/シールド貫通 \+0\.0%/);assert.match(await page.locator('#pitchDetails').textContent(),/この敵は装甲なし/);assert.match(await page.locator('#pitchDetails').textContent(),/命中効率 -3\.0%/);
 await page.reload();assert.equal(await page.evaluate(()=>sequenceStore.list()[0].tracks.find(t=>t.voice==='bass').notes[0].register),0);
 assert.deepEqual(errors,[]);console.log('PASS: real three-part combat, exact HP/shield resistance, armor penetration and accuracy ledger, keyboard register recording, independent piano rolls, effect highlighting, eight viewports without scrolling, history replay and storage reload.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
