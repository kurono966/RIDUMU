const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.wav':'audio/wav'})[path.extname(file)]??'application/octet-stream');res.end(data);});
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,args:['--log-file='+path.join(require('node:os').tmpdir(),'ridumu-debug-grooves.log')],...(process.env.RIDUMU_BROWSER?{executablePath:process.env.RIDUMU_BROWSER}:{})});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html?debug=1`);await page.locator('[data-choose-mode=normal]').click();
  const results=[];
  for(const kind of ['stone','machine','plant']){
   const result=await page.evaluate(async kind=>{
    audio();muted=true;stage=enemies.findIndex(e=>e.kind===kind);enemies[stage].hp=5000;enemies[stage].intentOrder=Array(6).fill('guard');
    enemyHp=5000;hp=100;shield=0;turn=1;state='ready';continuousInput=false;
    // Skip the metronome wait, retaining the real auto-input entry point and
    // real three-part finish/analysis/playback pipeline.
    const originalCountIn=countIn;countIn=()=>{};
    let plan;try{if(!autoInputDamageChart('max'))throw Error('auto input refused');plan=debugDamagePlan;}finally{countIn=originalCountIn;}
    continuousRunning=false;
    let saved;const begin=ExperienceUI.begin;ExperienceUI.begin=(packet,actual)=>{saved={packet,actual};return begin(packet,actual);};
    try{
     for(const voice of ['drums','bass','lead']){
      state='recording';phase='parts';phaseQuantizeMode='off';recordAudioAt=ctx.currentTime-timing().duration;
      notes=plan.parts.get(voice).map(n=>({...n}));synthRecording=voice==='drums'?null:{version:1,patch:Synth.patch({},voice),events:[]};await finish();
     }
    }finally{ExperienceUI.begin=begin;}
    const review=PerformanceReview.evaluate(saved.packet),g=saved.actual.analysis.groove;
    const recorded=Object.fromEntries(saved.packet.tracks.map(t=>[t.voice,t.notes]));
    return {kind,expected:plan.grooveStyle,style:Groove.classify(g),strength:g[plan.grooveStyle],description:Groove.describe(g),actual:saved.actual.result.total,review:review.result.total,openingKick:recorded.drums[0].type==='kick'&&recorded.drums[0].t===0,hatOrigin:saved.packet.hats[0].t,bassTonic:recorded.bass[0].pitch,leadCadence:recorded.lead.at(-1).pitch,cleared:debugDamagePlan===null,state};
   },kind);
   assert.equal(result.style,result.expected);assert.ok(result.strength>=.55);assert.equal(result.actual,result.review);assert.equal(result.openingKick,true);assert.equal(result.hatOrigin,0);assert.equal(result.bassTonic,0);assert.equal(result.leadCadence,0);assert.equal(result.cleared,true);assert.equal(result.state,'ready');results.push(result);
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,results}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
