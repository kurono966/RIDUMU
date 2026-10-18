const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.RIDUMU_PLAYWRIGHT_PATH||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,args:['--disable-logging'],executablePath:process.env.RIDUMU_CHROME});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(require('node:url').pathToFileURL(path.resolve(__dirname,'../index.html')).href);assert.equal(await page.evaluate(()=>ctx),undefined);
 await page.click('#openMenu');await page.waitForFunction(()=>ctx?.state==='running'&&enemyMusic?.state.playing);
 assert.equal(await page.evaluate(()=>state),'ready');assert.equal(await page.evaluate(()=>notes.length),0);assert.equal(await page.evaluate(()=>tracks.size),0);
 await page.click('#closePlaySettings');await page.evaluate(()=>{enemies[0].bpm=240;syncEnemyMusic();});
 const initial=await page.evaluate(()=>enemyMusic.state.origin);await page.waitForFunction(()=>enemyMusic.state.chord==='Abmaj7');assert.equal(await page.evaluate(()=>enemyMusic.state.origin),initial);
 await page.click('#sound');assert.equal(await page.evaluate(()=>enemyMusic.state.muted),true);await page.click('#sound');assert.equal(await page.evaluate(()=>enemyMusic.state.muted),false);
 await page.click('#start');await page.waitForFunction(()=>recordAudioAt!==null);const anchor=await page.evaluate(()=>recordAudioAt);
 await page.waitForFunction(()=>enemyMusic.state.origin===recordAudioAt);assert.equal(await page.evaluate(()=>enemyMusic.state.origin),anchor);
 await page.evaluate(()=>{state='ready';stage=1;update();});assert.equal(await page.evaluate(()=>enemyMusic.state.kind),'fly');assert.equal(await page.evaluate(()=>enemyMusic.state.bpm),150);
 await page.evaluate(()=>{enemyHp=0;completeBattle();});assert.equal(await page.evaluate(()=>enemyMusic.state.playing),false);
 const rendered=await page.evaluate(async()=>{
  async function render(kind){const c=new OfflineAudioContext(1,48000,48000),ctx={state:'running',get currentTime(){return c.currentTime},destination:c.destination,createGain:()=>c.createGain(),createBiquadFilter:()=>c.createBiquadFilter(),createOscillator:()=>c.createOscillator()};
   const music=EnemyMusic.create(ctx,c.destination,{setInterval:()=>1,clearInterval(){}});music.setEnemy(kind,120);music.start(.01);return Array.from((await c.startRendering()).getChannelData(0));}
  const a=await render('stone'),same=await render('stone'),other=await render('fly');let power=0,peak=0,error=0,difference=0;
  for(let i=0;i<a.length;i++){power+=a[i]**2;peak=Math.max(peak,Math.abs(a[i]));error=Math.max(error,Math.abs(a[i]-same[i]));difference+=Math.abs(a[i]-other[i]);}
  const partials=[48,51,55,58].map(midi=>{const hz=440*2**((midi-69)/12);let re=0,im=0;for(let i=4800;i<38400;i++){re+=a[i]*Math.cos(2*Math.PI*hz*i/48000);im+=a[i]*Math.sin(2*Math.PI*hz*i/48000);}return Math.hypot(re,im)/33600;});return {power,peak,error,difference,partials};
 });assert(rendered.power>1);assert(rendered.peak<.2);assert(rendered.error<1e-6);assert(rendered.difference>10);assert(rendered.partials.every(p=>p>.001),JSON.stringify(rendered));
 assert.deepEqual(errors,[]);console.log('PASS: first-gesture accompaniment, enemy progression/tempo, count-in alignment, mute, battle end, no recorded player input, deterministic polyphonic offline audio. '+JSON.stringify(rendered));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
