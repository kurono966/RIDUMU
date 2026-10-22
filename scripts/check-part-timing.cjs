const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.RIDUMU_BROWSER?{executablePath:process.env.RIDUMU_BROWSER}:{})});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(require('node:url').pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  await page.locator('[data-choose-mode="normal"]').click();
  const result=await page.evaluate(async()=>{
   audio();muted=true;enemies[stage].hp=5000;enemyHp=5000;hp=100;shield=0;turn=1;hatReady=true;
   playbackAttack=async()=>{};enemyCounter=async()=>{};
   let captured;const begin=ExperienceUI.begin;ExperienceUI.begin=(packet,actual)=>{captured={packet,actual};return begin(packet,actual);};
   const bpm=timing().bpm,beat=60/bpm;
   hatNotes=Array.from({length:16},(_,i)=>({type:'hat',t:i*beat/2,inputT:i*beat/2}));
   for(const voice of ['drums','bass','lead']){
    state='recording';phase='parts';phaseQuantizeMode='off';recordAudioAt=ctx.currentTime-timing().duration;
    notes=Array.from({length:16},(_,i)=>{const t=i*beat/2+(voice==='bass'?.02:voice==='lead'?.035:0);return {type:voice==='drums'&&i%2?'snare':'kick',t,rawT:t,inputT:t,duration:.12,...(voice==='drums'?{}:{midi:voice==='bass'?36:60})};});
    await finish();
   }
   const review=PerformanceReview.evaluate(captured.packet);
   return {actual:captured.actual.result.total,review:review.result.total,bass:cycleBass.timing,lead:cycleLead.timing,display:document.getElementById('partTimingAccuracy').textContent,details:document.getElementById('partTimingSummary').textContent};
  });
  assert.equal(result.actual,result.review);assert.ok(result.bass.score>99);assert.ok(result.lead.score>99);
  assert.match(result.display,/Bass 100.0%.*Lead 100.0%/);assert.match(result.details,/drumsとの間隔/);
  for(const [width,height] of [[1440,900],[390,844],[667,375]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>RidumuUI.refresh());
   await page.locator('#partTimingAccuracy').scrollIntoViewIfNeeded();
   assert.ok(await page.locator('#partTimingAccuracy').isVisible());
   const a=await page.locator('#partTimingAccuracy').boundingBox(),b=await page.locator('#pitchOutcome').boundingBox();
   if(b)assert.ok(b.y>=a.y+a.height-1,'pitch feedback overlaps timing accuracy');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`horizontal overflow at ${width}`);
  }
  await page.setViewportSize({width:390,height:844});await page.locator('#partTimingAccuracy').scrollIntoViewIfNeeded();
  if(process.env.RIDUMU_SCREENSHOT)await page.screenshot({path:process.env.RIDUMU_SCREENSHOT,fullPage:true});
  await page.locator('#openResultDetails').click();assert.ok(await page.locator('#partTimingSummary').isVisible());
  assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,...result}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
