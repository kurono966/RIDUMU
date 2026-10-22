const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.RIDUMU_BROWSER});try{
 const page=await browser.newPage();await page.goto(require('node:url').pathToFileURL(path.resolve(__dirname,'../index.html')).href);await page.click('[data-choose-mode="normal"]');
 const result=await page.evaluate(async()=>{
  const results=[];
  for(const voice of Synth.voices)for(const preset of [{id:'default',patch:Synth.patch({},voice)},...Synth.factoryPresets[voice]]){
   const p=preset.patch;
   async function render(recorded){Synth.setPatch(voice,p);Synth.setPad(voice,Synth.pad());const c=new OfflineAudioContext(1,48000,48000);const h=Synth.engine(c).play(voice,220,.01,1,recorded?.35:Infinity,recorded?{snapshot:{version:1,patch:p,events:[]},noteTime:0}:undefined);if(!recorded)h.release(.36);return (await c.startRendering()).getChannelData(0);}
   const live=await render(false),replay=await render(true);let diff=0;for(let i=0;i<live.length;i++)diff=Math.max(diff,Math.abs(live[i]-replay[i]));results.push({voice,preset:preset.id,diff});
  }
  return results;
 });console.log(result);assert(result.every(r=>r.diff<2e-6));
 const automation=await page.evaluate(async()=>{
  const results=[];
  for(const voice of Synth.voices){
   const p=Synth.patch({},voice),changed=Synth.patch({...p,wave:'square',cutoff:700,release:.7,attack:.06,decay:.3},voice);
   Synth.setPatch(voice,p);Synth.setPad(voice,Synth.pad());
   const c=new OfflineAudioContext(1,72000,48000),h=Synth.engine(c).play(voice,220,.01,1,Infinity),events=[];
   const changing=c.suspend(.2).then(()=>{Synth.setPatch(voice,changed);events.push({t:c.currentTime-.01,...Synth.current(voice)});return c.resume();});
   let duration;const releasing=c.suspend(.4).then(()=>{duration=c.currentTime-.01;h.release();return c.resume();});
   const a=(await c.startRendering()).getChannelData(0);await Promise.all([changing,releasing]);
   const replay=new OfflineAudioContext(1,72000,48000);Synth.engine(replay).play(voice,220,.01,1,duration,{snapshot:{version:1,patch:p,events},noteTime:0});const b=(await replay.startRendering()).getChannelData(0);
   let diff=0;for(let i=0;i<a.length;i++)diff=Math.max(diff,Math.abs(a[i]-b[i]));results.push({voice,diff});
  }return results;
 });console.log('Automation',automation);assert(automation.every(r=>r.diff<2e-6));
 const lifecycle=await page.evaluate(async()=>{
  audio();await ctx.resume();enemies[stage].bpm=240;turn=3;phase='parts';updateInstrument();state='recording';recordAudioAt=ctx.currentTime-.01;beginSynthRecording();notes=[];
  const calls=[],original=sound;sound=function(...args){const out=original(...args);calls.push({state,voice:args[2],volume:args[3],duration:args[4],midi:args[6],recorded:!!args[8],patch:args[8]?Synth.at(args[8].snapshot,args[8].noteTime).patch:Synth.current(args[2]==='bass'?'bass':'lead').patch});return out;};
  input('kick','test:a');await new Promise(r=>setTimeout(r,120));releaseInput('test:a');
  await finish();sound=original;return calls;
 });assert.equal(lifecycle[0].midi,lifecycle[1].midi);assert.deepEqual(lifecycle[0].patch,lifecycle[1].patch);
 const quantized=await page.evaluate(async()=>{
  const p=Synth.patch({wave:'sine',cutoff:900},'lead'),next=Synth.patch({...p,wave:'square',cutoff:9000},'lead');
  lastDuration=.4;lastBpm=120;lastInstrument='lead';lastMix=[{voice:'lead',notes:Quantize.render([{type:'kick',t:.09,inputT:.09,quantize:'just',duration:.05,midi:60}],120,.4),synth:{version:1,patch:p,events:[{t:0,patch:p,pad:Synth.pad()},{t:.1,patch:next,pad:Synth.pad()}]}}];
  lastMix.push(...['drums','bass','hat'].map(voice=>({voice,notes:[{type:voice==='hat'?'hat':'kick',t:.09,duration:.05,midi:36}],...(voice==='bass'?{synth:{version:1,patch:p,events:[]}}:{})})));
  const original=sound,calls=[];sound=(...args)=>{calls.push({voice:args[2],volume:args[3],patch:args[8]?Synth.at(args[8].snapshot,args[8].noteTime).patch:null,noteTime:args[8]?.noteTime});};
  await playbackAttack({damages:[]},'#d4f77d','drums');sound=original;return {expected:p,actual:calls.find(c=>c.voice==='lead'),volumes:Object.fromEntries(calls.map(c=>[c.voice,c.volume]))};
 });assert.deepEqual(quantized.actual.patch,quantized.expected,'Quantizing a note must not switch its recorded timbre');
 assert.deepEqual(quantized.volumes,{lead:1,drums:.6,bass:.6,hat:.85},'Attack preserves the Lead recording mix');
 const compression=await page.evaluate(async()=>{
  await DrumAudio.ready;
  async function render(profile,parts){
   const c=new OfflineAudioContext(1,96000,48000),master=profile==='old'?c.createDynamicsCompressor():createMasterOutput(c);
   if(profile==='old'){master.threshold.value=-12;master.ratio.value=6;}
   master.connect(c.destination);
   const engine=Synth.engine(c,master),p=Synth.patch({},'lead');
   if(parts!=='backing')engine.play('lead',261.626,.1,1,1.1,{snapshot:{version:1,patch:p,events:[]},noteTime:0});
   if(parts!=='lead'){
    for(const at of [.01,.51,1.01]){DrumAudio.playVoice(c,'kick',at,.6,master);DrumAudio.playVoice(c,'snare',at+.25,.6,master);}
    engine.play('bass',65.406,.01,.6,1.4,{snapshot:{version:1,patch:Synth.patch({},'bass'),events:[]},noteTime:0});
    let now=0,tick;const host={state:'running',get currentTime(){return now},destination:master,createGain:()=>c.createGain(),createBiquadFilter:()=>c.createBiquadFilter(),createOscillator:()=>c.createOscillator()};
    const music=EnemyMusic.create(host,master,{setInterval(fn){tick=fn;return 1;},clearInterval(){}});music.setEnemy('stone',120);music.start(.01,1.6);for(now=.025;now<1.7;now+=.025)tick();
   }
   return (await c.startRendering()).getChannelData(0);
  }
  const rows=[];for(const profile of ['old','new']){const mix=await render(profile,'mix'),backing=await render(profile,'backing'),lead=await render(profile,'lead');let error=0,power=0,peak=0;for(let i=0;i<mix.length;i++){error+=(mix[i]-backing[i]-lead[i])**2;power+=lead[i]**2;peak=Math.max(peak,Math.abs(mix[i]));}rows.push({profile,leadAlteration:Math.sqrt(error/power),peak});}return rows;
 });console.log('Master compressor interaction',compression);
 assert(compression[0].leadAlteration>.01);assert(compression[1].leadAlteration<.00001);assert(compression[1].peak<1);
 console.log('PASS: preset waveforms, live/recorded automation, real Lead finish/playback, quantized timbre, transparent master protection.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
