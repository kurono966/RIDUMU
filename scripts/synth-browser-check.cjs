const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.RIDUMU_PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..');
(async()=>{let browser;try{
 browser=await chromium.launch({headless:true,args:['--disable-logging'],executablePath:process.env.RIDUMU_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(require('node:url').pathToFileURL(path.join(root,'index.html')).href);await page.waitForFunction(()=>globalThis.Synth&&document.getElementById('openSynth').onclick);
 assert.deepEqual(await page.evaluate(()=>currentZones()),[]);assert.doesNotMatch(await page.locator('#scope').getAttribute('aria-label'),/P＝|S＝|B＝|POWER|BOOST/);
 await page.click('#toggleEffects');
 for(const [width,height] of [[1280,720],[1024,600],[390,844],[320,568],[320,480],[844,390],[667,375],[740,360]]){
  await page.setViewportSize({width,height});
  for(const mode of ['two','four','seven','nine'])for(const collapsed of [false,true])for(const showResult of [false,true])for(const phaseName of ['hat','parts']){
   await page.evaluate(({mode,collapsed,showResult,phaseName})=>{document.getElementById('result').hidden=!showResult;state='ready';turn=2;hatReady=phaseName!=='hat';noteMode=mode;phase=phaseName;updatePhaseUI();syncNoteMode();setPadsVisible(!collapsed);}, {mode,collapsed,showResult,phaseName});
   const boxes=await page.evaluate(()=>['filterPad','start',...(!document.querySelector('.console').classList.contains('pads-collapsed')?(document.querySelector('.console').classList.contains('hat-phase')?['hat']:(noteMode==='two'?['kick','snare']:(noteMode==='four'?['note0','note2']:['note0','note1']))):[])].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return {id,x:r.x,y:r.y,w:r.width,h:r.height,visible:getComputedStyle(e).display!=='none'};}));
   for(const b of boxes){if(b.id==='hat'&&!b.visible)continue;assert(b.w>0&&b.h>0&&b.x>=0&&b.y>=0&&b.x+b.w<=width+1&&b.y+b.h<=height+1,JSON.stringify({width,height,mode,collapsed,b}));}
   const visibility=await page.evaluate(()=>['filterPad','start'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),parent=e.parentElement.getBoundingClientRect();return {id,target:hit?.id,tag:hit?.tagName,rect:{y:r.y,h:r.height},hit:!!hit&&(hit===e||e.contains(hit)),inside:r.top>=parent.top&&r.bottom<=parent.bottom+1};}));
   assert(visibility.every(v=>v.hit&&v.inside),JSON.stringify({width,height,mode,collapsed,showResult,visibility}));
   if(process.env.RIDUMU_SCREENSHOT_DIR&&width===320&&height===480&&mode==='four'&&!collapsed&&showResult&&phaseName==='parts')await page.screenshot({path:path.join(process.env.RIDUMU_SCREENSHOT_DIR,'performance-small.png')});
  }
 }
 await page.setViewportSize({width:1280,height:720});await page.evaluate(()=>{state='ready';turn=2;noteMode='two';syncNoteMode();setPadsVisible(true);document.getElementById('result').hidden=true;});
 await page.click('#openPlaySettings');await page.click('#openSynth');await page.click('#synthPreview');await page.selectOption('#synth-wave','sawtooth');await page.locator('#synth-cutoff').evaluate(e=>{e.value=.85;e.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal(await page.evaluate(()=>Synth.current('bass').patch.wave),'sawtooth');
 assert(await page.locator('#synthGauges meter').count()===4);assert(await page.locator('#synthEffects').innerText());
 await page.selectOption('#synthVoice','lead');await page.click('#synthReset');assert.equal(await page.evaluate(()=>Synth.current('lead').patch.harmonic),.18);await page.locator('#synth-harmonic').evaluate(e=>{e.value=.31;e.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal(await page.evaluate(()=>Synth.current('lead').patch.harmonic),.31);await page.click('#synthReset');await page.selectOption('#synthVoice','bass');
 if(process.env.RIDUMU_SCREENSHOT_DIR){fs.mkdirSync(process.env.RIDUMU_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.RIDUMU_SCREENSHOT_DIR,'synth-desktop.png')});}
 await page.click('#closeSynth');const filter=await page.locator('#filterPad').boundingBox();await page.mouse.move(filter.x+filter.width*.8,filter.y+filter.height*.7);
 const xy=await page.evaluate(()=>Synth.current('bass').pad);assert(xy.amount>.7&&xy.volume<.4);await page.mouse.move(0,0);assert.deepEqual(await page.evaluate(()=>Synth.current('bass').pad),{amount:0,mode:'lowpass',volume:1});
 // Recorded sound stays identical after live patches change. Offline rendering also exercises sample-accurate automation.
 const audio=await page.evaluate(async()=>{
  const p=Synth.patch({wave:'sine',attack:.05,decay:.1,sustain:.6,release:.2,cutoff:3000}),snapshot={version:1,patch:p,events:[{t:0,patch:p,pad:Synth.pad()},{t:.25,patch:{...p,wave:'square',cutoff:900},pad:{amount:.5,mode:'lowpass',volume:.4}}]};
  async function render(){const c=new OfflineAudioContext(1,48000,48000);Synth.engine(c).play('bass',220,0,.8,.6,{snapshot,noteTime:0});return Array.from((await c.startRendering()).getChannelData(0));}
  const first=await render();Synth.setPatch('bass',{wave:'sawtooth',cutoff:16000});const second=await render();let diff=0,power=0;for(let i=0;i<first.length;i++){diff=Math.max(diff,Math.abs(first[i]-second[i]));power+=first[i]*first[i];}return {diff,power};
 });assert(audio.power>0);assert(audio.diff<1e-6,`Replay error ${audio.diff}`);
 const classic=await page.evaluate(async()=>{
  async function render(legacy){const c=new OfflineAudioContext(1,24000,48000),t=.01;if(legacy){const amp=c.createGain(),filter=c.createBiquadFilter(),osc=c.createOscillator(),octave=c.createOscillator(),blend=c.createGain();amp.gain.setValueAtTime(.001,t);amp.gain.exponentialRampToValueAtTime(.12,t+.008);amp.gain.exponentialRampToValueAtTime(.12*.65,t+.08);amp.gain.setValueAtTime(.12*.65,t+.17);amp.gain.exponentialRampToValueAtTime(.001,t+.29);filter.type='lowpass';filter.Q.value=.8;filter.frequency.setValueAtTime(3600,t);filter.frequency.exponentialRampToValueAtTime(1800,t+.12);osc.type='triangle';osc.frequency.setValueAtTime(261.626,t);octave.type='sine';octave.frequency.setValueAtTime(523.252,t);blend.gain.value=.18;osc.connect(filter);octave.connect(blend);blend.connect(filter);filter.connect(amp);amp.connect(c.destination);osc.start(t);octave.start(t);osc.stop(t+.31);octave.stop(t+.31);}else{const p=Synth.patch({},'lead');Synth.engine(c).play('lead',261.626,t,1,.17,{snapshot:{version:1,patch:p,events:[]},noteTime:0});}return (await c.startRendering()).getChannelData(0);}
  const a=await render(true),b=await render(false);let error=0;for(let i=0;i<48000*.29;i++)error=Math.max(error,Math.abs(a[i]-b[i]));return {error,samples:[.02,.04,.08,.12,.2,.28].map(t=>({t,a:a[Math.round(t*48000)],b:b[Math.round(t*48000)]}))};
 });assert(classic.error<.00001,'Classic lead differs from previous audio: '+JSON.stringify(classic));

 const mono=await page.evaluate(async()=>{
  const p=Synth.patch({wave:'sine',attack:.003,decay:.01,sustain:1,release:.02,cutoff:8000}),snap={version:1,patch:p,events:[{t:0,patch:p,pad:Synth.pad()},{t:.6,patch:{...p,cutoff:4000},pad:Synth.pad({volume:.9})}]};
  async function render(notes){const c=new OfflineAudioContext(1,48000,48000),engine=Synth.engine(c);for(const [voice,hz,t,duration] of notes)engine.play(voice,hz,t,1,duration,{snapshot:snap,noteTime:t});return Array.from((await c.startRendering()).getChannelData(0));}
  const first=['bass',220,0,.8],second=['bass',440,.4,.1],lead=['lead',660,0,.9];
  const base=await render([first]),switched=await render([first,second]),independent=await render([first,lead,second]),sameTime=await render([first,['bass',440,0,.3]]),lastOnly=await render([['bass',440,0,.3]]),reverse=await render([second,first]);
  let prefixDiff=0,tail=0,leadTail=0,sameDiff=0,reverseDiff=0;
  for(let i=0;i<48000;i++){if(i<48000*.35)prefixDiff=Math.max(prefixDiff,Math.abs(base[i]-switched[i]));if(i>48000*.7){tail+=switched[i]**2;leadTail+=independent[i]**2;}sameDiff=Math.max(sameDiff,Math.abs(sameTime[i]-lastOnly[i]));reverseDiff=Math.max(reverseDiff,Math.abs(switched[i]-reverse[i]));}
  return {prefixDiff,tail,leadTail,sameDiff,reverseDiff};
 });assert.equal(mono.prefixDiff,0);assert.equal(mono.tail,0);assert(mono.leadTail>0);assert.equal(mono.sameDiff,0);assert.equal(mono.reverseDiff,0);

 await page.evaluate(()=>{state='ready';turn=1;notes=[{type:'kick',t:0,rawT:0},{type:'snare',t:1,rawT:1}];hatNotes=[{type:'hat',t:0,rawT:0}];playbackAttack=async()=>{};enemyCounter=async()=>{};});
 await page.evaluate(()=>finish());
 await page.evaluate(()=>{state='recording';phase='parts';recordAudioAt=ctx.currentTime-.2;beginSynthRecording();Synth.setPatch('bass',{cutoff:2000});Synth.setPad('bass',{amount:.6,volume:.8});notes=[{type:'kick',t:0,rawT:0,midi:36,duration:1}];});await page.evaluate(()=>finish());
 await page.evaluate(()=>{state='recording';phase='parts';recordAudioAt=ctx.currentTime-.2;beginSynthRecording();Synth.setPatch('lead',{wave:'square'});notes=[{type:'snare',t:1,rawT:1,midi:60,duration:.5}];});await page.evaluate(()=>finish());
 const result=await page.evaluate(()=>({turn,history:sequenceStore.list()[0],tone:document.getElementById('timbreResult').textContent}));assert.equal(result.turn,4);assert(result.history.tracks.find(t=>t.voice==='bass').synth.events.length>=2);assert(result.history.tracks.find(t=>t.voice==='lead').synth);assert(result.tone.includes('湿潤'));
 await page.reload();assert.equal(await page.evaluate(()=>Synth.current('bass').patch.wave),'sawtooth');
 const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const phone=await touch.newPage();phone.on('pageerror',e=>errors.push(e.message));await phone.goto(page.url());await phone.evaluate(()=>{turn=2;updateInstrument();});
 await phone.click('#toggleEffects');const target=await phone.locator('#filterPad').boundingBox();await phone.touchscreen.tap(target.x+target.width*.5,target.y+target.height*.5);assert.equal(await phone.evaluate(()=>Synth.current('bass').pad.volume),1);
 await phone.click('#openPlaySettings');await phone.click('#openSynth');if(process.env.RIDUMU_SCREENSHOT_DIR)await phone.screenshot({path:path.join(process.env.RIDUMU_SCREENSHOT_DIR,'synth-mobile.png')});
 assert.deepEqual(errors,[]);console.log('PASS: eight viewports, Hat/parts phases, 2/4/7 notes, pads ON/OFF, live editor, hover/touch reset, persisted settings, deterministic monophonic offline audio, three-part battle and saved synth snapshots.');
 }finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
