const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.RIDUMU_BROWSER});try{const page=await b.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);await page.click('[data-choose-mode="normal"]');await page.click('#openMenu');await page.click('#openSynth');
await page.selectOption('#synth-wave','sine');
const original=await page.locator('#synthEditedWavePath').getAttribute('d');
await page.locator('#synth-shape2').evaluate(e=>{e.value=.18;e.dispatchEvent(new Event('input',{bubbles:true}));});
await page.locator('#synth-shape3').evaluate(e=>{e.value=-.12;e.dispatchEvent(new Event('input',{bubbles:true}));});
assert.notEqual(await page.locator('#synthEditedWavePath').getAttribute('d'),original);
assert.equal(await page.evaluate(()=>Synth.current('bass').patch.shape2),.18);
await page.click('#synthPreview');await page.waitForTimeout(120);await page.click('#synthPreview');
await page.locator('.synth-user-presets summary').click();await page.getByPlaceholder('音色の名前（例：柔らかいベース）').fill('波形テスト');await page.getByRole('button',{name:'音色を保存',exact:true}).click();
await page.click('#synthWaveReset');assert.equal(await page.evaluate(()=>Synth.current('bass').patch.shape2),0);
await page.getByRole('button',{name:'読み込む',exact:true}).click();assert.equal(await page.evaluate(()=>Synth.current('bass').patch.shape3),-.12);
await page.selectOption('#synthVoice','lead');assert.equal(await page.evaluate(()=>Synth.current('lead').patch.shape2),0);
await page.selectOption('#synthVoice','bass');
for(const [width,height] of [[1280,720],[390,844]]){await page.setViewportSize({width,height});await page.locator('#synthWaveGraph').scrollIntoViewIfNeeded();await page.locator('#synth-shape3').scrollIntoViewIfNeeded();assert(await page.locator('#synthWaveGraph').isVisible());assert(await page.locator('#synthDialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));if(process.env.RIDUMU_SCREENSHOTS)await page.screenshot({path:path.join(process.env.RIDUMU_SCREENSHOTS,`wave-editor-${width}.png`)});}
await page.reload();assert.equal(await page.evaluate(()=>Synth.current('bass').patch.shape2),.18);
const audio=await page.evaluate(async()=>{
 const rows=[];
 for(const voice of ['bass','lead'])for(const wave of Synth.waves){
  const patch=Synth.patch({wave,shape2:.18,shape3:-.12,shape5:.1,cutoff:9000},voice),changed={...patch,wave:'square',shape2:-.2,shape8:.12};
  Synth.setPatch(voice,patch);Synth.setPad(voice,{});
  const c=new OfflineAudioContext(1,48000,48000),events=[];
  const handle=Synth.engine(c).play(voice,220,.01,1,Infinity);
  const change=c.suspend(.2).then(()=>{Synth.setPatch(voice,changed);events.push({t:c.currentTime-.01,...Synth.current(voice)});return c.resume();});
  let duration;const release=c.suspend(.4).then(()=>{duration=c.currentTime-.01;handle.release();return c.resume();});
  const live=(await c.startRendering()).getChannelData(0);await Promise.all([change,release]);
  const snapshot=Synth.cleanSnapshot({version:1,patch,events},voice),r=new OfflineAudioContext(1,48000,48000);
  Synth.engine(r).play(voice,220,.01,1,duration,{snapshot,noteTime:0});const replay=(await r.startRendering()).getChannelData(0);
  let diff=0,energy=0,peak=0;for(let i=0;i<live.length;i++){diff=Math.max(diff,Math.abs(live[i]-replay[i]));energy+=live[i]*live[i];peak=Math.max(peak,Math.abs(live[i]));}rows.push({voice,wave,diff,energy,peak});
 }
 async function render(amount){const c=new OfflineAudioContext(1,24000,48000),p=Synth.patch({wave:'sine',shape2:amount,cutoff:16000,harmonic:0,attack:.003,sustain:1,decay:.01},'lead');Synth.engine(c).play('lead',220,.01,1,.3,{snapshot:{version:1,patch:p,events:[]},noteTime:0});return (await c.startRendering()).getChannelData(0);}
 const plain=await render(0),edited=await render(.25);let changedEnergy=0;for(let i=0;i<plain.length;i++)changedEnergy+=(plain[i]-edited[i])**2;
 return {rows,changedEnergy};
});
assert(audio.rows.every(r=>r.diff<2e-6&&r.energy>1&&r.peak<.95));assert(audio.changedEnergy>1,'waveform edit changes actual audio');assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,ui:['wave preview','reset','named preset','voice isolation','reload persistence','desktop/mobile'],audio}));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
