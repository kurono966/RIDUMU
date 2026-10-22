const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.RIDUMU_PLAYWRIGHT_PATH||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,args:['--disable-logging'],executablePath:process.env.RIDUMU_CHROME});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.RIDUMU_GAME_URL||require('node:url').pathToFileURL(path.resolve(__dirname,'../index.html')).href);assert.equal(await page.evaluate(()=>ctx),undefined);
 await page.locator('[data-choose-mode="normal"]').click();
 await page.click('#openMenu');assert.equal(await page.evaluate(()=>ctx),undefined);
 assert.equal(await page.evaluate(()=>state),'ready');assert.equal(await page.evaluate(()=>notes.length),0);assert.equal(await page.evaluate(()=>tracks.size),0);
 await page.click('#closePlaySettings');await page.click('#sound');await page.click('#sound');assert.equal(await page.evaluate(()=>enemyMusic.state.playing),false);
 await page.evaluate(()=>{enemies[0].bpm=240;syncEnemyMusic();});
 await page.click('#start');await page.waitForFunction(()=>recordAudioAt!==null);assert.equal(await page.evaluate(()=>state),'countin');assert.equal(await page.evaluate(()=>enemyMusic.state.playing),false);
 await page.waitForFunction(()=>state==='recording'&&enemyMusic.state.playing);const initial=await page.evaluate(()=>recordAudioAt);
 assert.equal(await page.evaluate(()=>enemyMusic.state.origin),initial);await page.waitForFunction(()=>enemyMusic.state.chord==='Abmaj7');
 await page.click('#sound');assert.equal(await page.evaluate(()=>enemyMusic.state.muted),true);await page.click('#sound');assert.equal(await page.evaluate(()=>enemyMusic.state.muted),false);
 assert(await page.evaluate(()=>Math.abs(enemyMusic.state.loopDuration-timing().duration)<1e-9));
 await page.waitForFunction(()=>phase==='parts'&&state==='countin');assert.equal(await page.evaluate(()=>enemyMusic.state.playing),false);
 await page.waitForFunction(()=>phase==='parts'&&state==='recording');assert.equal(await page.evaluate(()=>enemyMusic.state.playing),true);
 await page.keyboard.press('a');
 await page.waitForFunction(()=>state==='ready');assert.equal(await page.evaluate(()=>enemyMusic.state.playing),false);
 for(const idle of ['ready','attack','enemyAttack','cleared','over']){await page.evaluate(idle=>{state=idle;audio();},idle);assert.equal(await page.evaluate(()=>enemyMusic.state.playing),false);}
 await page.evaluate(()=>{state='attack';lastDuration=2;lastBpm=240;lastInstrument='drums';lastMix=[{voice:'drums',notes:[{type:'kick',t:0,rawT:-.1},{type:'snare',t:.5,rawT:.5}]}];globalThis.replayMusicDone=false;playbackAttack({damages:[5,5]},'#d4f77d').then(()=>{globalThis.replayMusicDone=true});});
 await page.waitForFunction(()=>enemyMusic.state.playing);assert(await page.evaluate(()=>Math.abs(enemyMusic.state.origin-attackMusicWindow.start)<1e-9));
 await page.waitForFunction(()=>globalThis.replayMusicDone);assert.equal(await page.evaluate(()=>enemyMusic.state.playing),false);
 await page.evaluate(()=>{state='enemyAttack';audio()});assert.equal(await page.evaluate(()=>enemyMusic.state.playing),false);
 await page.evaluate(()=>{state='ready';stage=1;update();});assert.equal(await page.evaluate(()=>enemyMusic.state.kind),'fly');assert.equal(await page.evaluate(()=>enemyMusic.state.bpm),150);
 const saved=await page.evaluate(()=>sequenceStore.list()[0]);assert(saved.accompaniment);assert.equal(saved.accompaniment.bpm,240);assert.equal(saved.accompaniment.chords[0].name,'Cm7');
 await page.evaluate(()=>{$('replay').disabled=false;$('replay').click();});
 assert.equal(await page.evaluate(()=>savedMusicWindow.owner),'result');assert.equal(await page.evaluate(()=>enemyMusic.state.kind),'recorded');assert.equal(await page.evaluate(()=>enemyMusic.state.bpm),240);assert.equal(await page.evaluate(()=>enemyMusic.state.chord),'Cm7');
 await page.evaluate(()=>stopReplay());assert.equal(await page.evaluate(()=>enemyMusic.state.playing),false);
 await page.evaluate(async()=>{await playHistory(sequenceStore.list()[0]);});
 assert.equal(await page.evaluate(()=>savedMusicWindow.owner),'history');assert.equal(await page.evaluate(()=>enemyMusic.state.kind),'recorded');assert.equal(await page.evaluate(()=>enemyMusic.state.bpm),240);
 await page.evaluate(()=>stopHistoryPlayback());assert.equal(await page.evaluate(()=>enemyMusic.state.playing),false);
 assert.deepEqual(await page.evaluate(()=>SequenceHistory.validate(JSON.parse(JSON.stringify(sequenceStore.list()[0]))).accompaniment),saved.accompaniment);
 await page.evaluate(async()=>{const old=structuredClone(sequenceStore.list()[0]);delete old.accompaniment;await playHistory(old);});assert.equal(await page.evaluate(()=>enemyMusic.state.playing),false);await page.evaluate(()=>stopHistoryPlayback());
 await page.evaluate(()=>{enemyHp=0;completeBattle();});assert.equal(await page.evaluate(()=>enemyMusic.state.playing),false);
 const rendered=await page.evaluate(async()=>{
  async function render(kind){let now=0,tick;const c=new OfflineAudioContext(1,48000,48000),ctx={state:'running',get currentTime(){return now},destination:c.destination,createGain:()=>c.createGain(),createBiquadFilter:()=>c.createBiquadFilter(),createOscillator:()=>c.createOscillator()};
   const music=EnemyMusic.create(ctx,c.destination,{setInterval(fn){tick=fn;return 1},clearInterval(){}});music.setEnemy(kind,120);music.start(.01,1);for(now=.025;now<1.1;now+=.025)tick();return Array.from((await c.startRendering()).getChannelData(0));}
  const a=await render('stone'),same=await render('stone'),other=await render('fly');let power=0,peak=0,error=0,difference=0;
  for(let i=0;i<a.length;i++){power+=a[i]**2;peak=Math.max(peak,Math.abs(a[i]));error=Math.max(error,Math.abs(a[i]-same[i]));difference+=Math.abs(a[i]-other[i]);}
  const partials=[48,51,55,58].map(midi=>{const hz=440*2**((midi-69)/12);let re=0,im=0;for(let i=4800;i<38400;i++){re+=a[i]*Math.cos(2*Math.PI*hz*i/48000);im+=a[i]*Math.sin(2*Math.PI*hz*i/48000);}return Math.hypot(re,im)/33600;});
  const tones=[];for(const kind of Object.keys(EnemyMusic.progressions)){const data=await render(kind);let peak=0,power=0;for(const v of data){peak=Math.max(peak,Math.abs(v));power+=v*v;}tones.push({kind,peak,rms:Math.sqrt(power/data.length)});}return {power,peak,error,difference,partials,tones};
 });assert(rendered.power>1);assert(rendered.peak<.2);assert(rendered.error<1e-6);assert(rendered.difference>10);assert(rendered.partials.every(p=>p>.001),JSON.stringify(rendered));assert(rendered.tones.every(t=>t.peak<.4&&t.rms>.005),JSON.stringify(rendered.tones));
 await page.reload();assert.deepEqual(await page.evaluate(()=>sequenceStore.list()[0].accompaniment),saved.accompaniment);
 assert.deepEqual(errors,[]);console.log('PASS: saved chords in damage/result/history replay after enemy change, JSON and storage reload, legacy history, replay downbeat alignment, silent menus/count-ins/idle/enemy counter, two-bar timing, mute and polyphonic offline audio. '+JSON.stringify(rendered));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
