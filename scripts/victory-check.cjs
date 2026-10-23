const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.RIDUMU_BROWSER});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;
 for(const [mode,index,final] of [...Array.from({length:9},(_,i)=>['normal',i,i===8]),['roguelite',0,false],['roguelite',7,true]]){
  await page.goto(url);await page.click(`[data-choose-mode="${mode}"]`);
  const expected=await page.evaluate(({index,final})=>{
   audio();muted=true;stage=index;turn=4;hp=64;enemyHp=0;state='attack';
   if(rogueRun){rogueRun.phase='battle';rogueRun.floor=final?8:1;enemies[stage]=copyEnemy(standardEnemies[final?8:0]);}
   $('damage').textContent='321';$('moveName').textContent='風裂連打';
   completeBattle();const after=JSON.stringify(rogueRun);completeBattle();
   return {enemy:enemies[stage].name,hp,once:after===JSON.stringify(rogueRun)};
  },{index,final});
  assert(expected.once,'completion is idempotent');
  assert(await page.locator('#victoryDialog').evaluate(e=>e.open));
  assert.equal(await page.locator('#victoryEnemy').textContent(),expected.enemy+' を倒した');
  assert.equal(await page.locator('#victoryHp').textContent(),expected.hp+' / 100');
  assert.equal(await page.locator('#victoryDamage').textContent(),'321');
  assert.equal(await page.locator('#victoryTitle').textContent(),final?'完全勝利！':'撃破！');
  await page.keyboard.press('a');assert.equal(await page.evaluate(()=>state),final?'over':'cleared');
  for(const [width,height] of [[1920,1080],[1366,768],[1280,720],[390,844],[320,480]]){
   await page.setViewportSize({width,height});
   assert(await page.locator('#victoryContinue').evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.y>=0&&r.bottom<=innerHeight&&(hit===e||e.contains(hit));}),'continue accessible');
  }
  if(mode==='normal'&&index===0&&process.env.RIDUMU_SCREENSHOTS){await page.setViewportSize({width:1280,height:720});await page.screenshot({path:path.join(process.env.RIDUMU_SCREENSHOTS,'victory-1280x720.png')});}
  await page.click('#victoryContinue');
  if(mode==='normal') {assert.equal(await page.evaluate(()=>stage),final?0:index+1);assert.equal(await page.evaluate(()=>state),'countin');}
  else assert(await page.locator('#rogueRewardDialog').evaluate(e=>e.open),'reward/starter follows celebration');
 }
 await page.goto(url);await page.click('[data-choose-mode="normal"]');
 await page.evaluate(()=>{state='enemyAttack';hp=0;enemyHp=100;completeBattle();});
 assert.equal(await page.locator('#victoryDialog').evaluate(e=>e.open),false,'defeat does not celebrate');
 await page.evaluate(()=>{prepareMode('normal');state='attack';hp=100;enemyHp=0;completeBattle();});
 await page.keyboard.press('Escape');assert.equal(await page.locator('#victoryDialog').evaluate(e=>e.open),false);assert.equal(await page.evaluate(()=>stage),0,'dismiss does not advance');
 const audioResult=await page.evaluate(async()=>{
  const results=[];
  for(const final of [false,true])for(const muted of [false,true]){
   const c=new OfflineAudioContext(1,96000,48000);VictoryUI.fanfare(c,c.destination,{final,muted});
   const samples=(await c.startRendering()).getChannelData(0);let peak=0,energy=0,tail=0;
   samples.forEach((v,i)=>{peak=Math.max(peak,Math.abs(v));energy+=v*v;if(i>90000)tail=Math.max(tail,Math.abs(v));});
   results.push({final,muted,peak,energy,tail});
  }return results;
 });
 for(const r of audioResult){assert(r.peak<.9,'headroom');assert.equal(r.tail,0,'no lingering audio');assert(r.muted?r.energy===0:r.energy>1,'mute honored / audible fanfare');}
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,encounters:11,viewports:5,audio:audioResult,checks:['normal progression','rogue rewards and final restart','no duplicate reward','shortcut blocking','dismiss','defeat','offline fanfare and mute']}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
