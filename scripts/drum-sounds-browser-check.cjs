const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.RIDUMU_BROWSER?{executablePath:process.env.RIDUMU_BROWSER}:{})});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(require('node:url').pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  await page.locator('[data-choose-mode="normal"]').click();await page.locator('#openPlaySettings').click();
  assert.equal(await page.locator('#drumSound-kick option').count(),2);
  assert.equal(await page.locator('#drumSound-snare option').count(),1);
  await page.selectOption('#drumSound-kick','kickOriginal');
  await page.getByRole('button',{name:'Kickの音色を試聴',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#drumSoundSettings [role="status"]').textContent.includes('Original'));
  const result=await page.evaluate(async()=>{
   await DrumAudio.ready;
   async function render(id){const c=new OfflineAudioContext(1,48000,48000);DrumAudio.select('kick',id);DrumAudio.play(c,'kick');return (await c.startRendering()).getChannelData(0);}
   const a=await render('kick'),b=await render('kickOriginal');let difference=0,peak=0;
   for(let i=0;i<a.length;i++){difference+=Math.abs(a[i]-b[i]);peak=Math.max(peak,Math.abs(b[i]));}
   return {difference,peak};
  });assert.ok(result.difference>1);assert.ok(result.peak>0&&result.peak<1);
  await page.reload();assert.equal(await page.locator('#drumSound-kick').inputValue(),'kickOriginal');
  await page.setViewportSize({width:390,height:844});await page.locator('[data-choose-mode="normal"]').click();await page.locator('#openPlaySettings').click();
  assert.ok(await page.locator('#drumSoundSettings').evaluate(el=>el.scrollWidth<=el.clientWidth),'mobile drum settings overflow');
  assert.deepEqual(errors,[]);console.log('PASS: drum selection, preview, persistence and distinct rendered Kick samples',result);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
