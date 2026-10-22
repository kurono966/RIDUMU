const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.RIDUMU_BROWSER?{executablePath:process.env.RIDUMU_BROWSER}:{})});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;
  await page.goto(url);await page.locator('[data-choose-mode="normal"]').click();
  const open=async()=>{await page.locator('#openPlaySettings').click();await page.locator('#openSynth').click();};await open();
  for(const voice of ['bass','lead']){
   await page.selectOption('#synthVoice',voice);assert.equal(await page.locator('#synthFactoryPreset option').count(),7);
   const ids=await page.evaluate(v=>Synth.factoryPresets[v].map(p=>p.id),voice);
   for(const id of ids){await page.selectOption('#synthFactoryPreset',id);assert.equal(await page.locator('#synthFactoryPreset').inputValue(),id);assert.ok((await page.locator('#synthFactoryDescription').innerText()).length>8);}
   await page.locator('#synthPreview').click();await page.locator('#synthPreview').click();
  }
  await page.selectOption('#synthVoice','bass');await page.selectOption('#synthFactoryPreset','warm-analog');
  await page.selectOption('#synth-osc2Wave','triangle');
  await page.locator('#synthGroup-mod summary').click();await page.locator('#synthGroup-fx summary').click();
  for(const [key,value] of [['osc2Mix',.35],['osc2Tune',-12],['osc2Fine',11],['lfoRate',5.5],['lfoPitch',9],['lfoFilter',300],['drive',.3]])await page.locator('#synth-'+key).evaluate((e,value)=>{e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const beforeGuide=await page.locator('#synthCombatRows').innerText();
  await page.locator('#synth-attack').evaluate(e=>{e.value=.5;e.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.notEqual(await page.locator('#synthCombatRows').innerText(),beforeGuide);assert.match(await page.locator('#synthBattleImpact').innerText(),/AttackとRelease/);
  await page.locator('#synth-sub').evaluate(e=>{e.value=.5;e.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.locator('#synthFactoryPreset').inputValue(),'');
  await page.locator('.synth-user-presets summary').click();await page.getByLabel('保存する音色の名前').fill('My Analog');await page.getByRole('button',{name:'音色を保存',exact:true}).click();
  await page.reload();await page.locator('[data-choose-mode="normal"]').click();await open();
  assert.equal(await page.evaluate(()=>Synth.current('bass').patch.sub),.5);
  assert.equal(await page.evaluate(()=>Synth.current('bass').patch.lfoFilter),300);assert.equal(await page.evaluate(()=>Synth.current('bass').patch.osc2Wave),'triangle');
  await page.selectOption('#synthFactoryPreset','deep-sub');await page.getByRole('button',{name:'読み込む',exact:true}).click();
  assert.equal(await page.evaluate(()=>Synth.current('bass').patch.sub),.5);assert.equal(await page.evaluate(()=>Synth.current('bass').patch.detune),7);
  await page.evaluate(()=>{const patch=Synth.current('bass').patch;for(const key of ['sub','detune','osc2Wave','osc2Mix','osc2Tune','osc2Fine','lfoRate','lfoPitch','lfoFilter','drive'])delete patch[key];const key='ridumu.synth.presets.v1',items=JSON.parse(localStorage.getItem(key));items.push({voice:'bass',name:'Legacy',patch});localStorage.setItem(key,JSON.stringify(items));});
  await page.reload();await page.locator('[data-choose-mode="normal"]').click();await open();
  await page.selectOption('#synthFactoryPreset','warm-analog');await page.selectOption('#synthPresetList',{label:'Legacy'});await page.getByRole('button',{name:'読み込む',exact:true}).click();
  assert.equal(await page.evaluate(()=>Synth.current('bass').patch.sub),0);assert.equal(await page.evaluate(()=>Synth.current('bass').patch.detune),0);
  assert.equal(await page.evaluate(()=>Synth.current('bass').patch.osc2Mix),0);assert.equal(await page.evaluate(()=>Synth.current('bass').patch.lfoFilter),0);
  for(const width of [1280,390,320]){await page.setViewportSize({width,height:844});assert.ok(await page.locator('#synthDialog').evaluate(e=>e.scrollWidth<=e.clientWidth),'dialog overflow '+width);if(process.env.RIDUMU_SCREENSHOT_DIR){await page.locator('#synthDialog').evaluate(e=>e.scrollTop=0);await page.screenshot({path:path.join(process.env.RIDUMU_SCREENSHOT_DIR,`synth-advanced-${width}.png`)});}}
  const rendered=await page.evaluate(async()=>{
   async function render(voice,p,events=[]){
    const c=new OfflineAudioContext(1,76800,48000),snapshot={version:1,patch:p,events};
    Synth.engine(c).play(voice,voice==='bass'?65.406:261.626,.01,.8,.8,{snapshot,noteTime:0});
    return (await c.startRendering()).getChannelData(0);
   }
   const rows=[];for(const voice of ['bass','lead'])for(const item of Synth.factoryPresets[voice]){
    const data=await render(voice,item.patch);let peak=0,power=0;for(const v of data){peak=Math.max(peak,Math.abs(v));power+=v*v;}
    rows.push({voice,id:item.id,peak,rms:Math.sqrt(power/data.length)});
   }
   const p=Synth.patch({wave:'sawtooth',sub:.5,detune:14,cutoff:3500},'lead');
   const a=await render('lead',p),b=await render('lead',p),dry=await render('lead',{...p,sub:0,detune:0});
   const start=Synth.patch({wave:'triangle',sub:0,detune:0,cutoff:2500,attack:.01,decay:.1,sustain:.8,release:.15},'lead');
   const advanced={...start,osc2Wave:'square',osc2Mix:.6,osc2Tune:7,osc2Fine:9,lfoRate:5.5,lfoPitch:18,lfoFilter:1200,drive:.6};
   const base=await render('lead',start),automated=await render('lead',start,[{t:.35,patch:advanced,pad:Synth.pad()}]);
   const advancedA=await render('lead',advanced),advancedB=await render('lead',Synth.cleanSnapshot({version:1,patch:advanced,events:[]}).patch);
   const featureDifferences=[];for(const changes of [{osc2Mix:.6,osc2Wave:'square',osc2Tune:12},{lfoPitch:25,lfoRate:6},{lfoFilter:1500,lfoRate:4},{drive:1}]){const data=await render('lead',{...start,...changes});let difference=0;for(let i=0;i<base.length;i++)difference+=Math.abs(data[i]-base[i]);featureDifferences.push(difference);}
   let repeatError=0,layerDifference=0,prefixError=0,automationDifference=0;
   for(let i=0;i<a.length;i++){repeatError=Math.max(repeatError,Math.abs(a[i]-b[i]),Math.abs(advancedA[i]-advancedB[i]));layerDifference+=Math.abs(a[i]-dry[i]);if(i<.36*48000)prefixError=Math.max(prefixError,Math.abs(base[i]-automated[i]));else automationDifference+=Math.abs(base[i]-automated[i]);}
   return {rows,repeatError,layerDifference,prefixError,automationDifference,featureDifferences};
  });
  assert.ok(rendered.rows.every(r=>r.peak>0&&r.peak<.95&&r.rms>.002),JSON.stringify(rendered.rows));
  assert.ok(rendered.repeatError<1e-6);assert.ok(rendered.layerDifference>1);assert.ok(rendered.prefixError<1e-6);assert.ok(rendered.automationDifference>1);
  assert.ok(rendered.featureDifferences.every(d=>d>1),JSON.stringify(rendered.featureDifferences));
  assert.deepEqual(errors,[]);console.log('PASS: twelve presets, preview, custom save/load, persistence, mobile sizing and real audio/automation',rendered);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1;});
