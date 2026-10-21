const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.RIDUMU_PLAYWRIGHT_PATH||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.RIDUMU_CHROME});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(require('node:url').pathToFileURL(path.resolve(__dirname,'../index.html')).href);await page.click('[data-choose-mode="normal"]');
 for(const stage of [6,7])for(const [width,height] of [[1280,720],[390,844],[320,480]]){
  await page.setViewportSize({width,height});
  await page.evaluate(nextStage=>{prepareMode('normal');stage=nextStage;enemyHp=enemies[stage].hp;update();ready();},stage);
  await page.waitForTimeout(50);
  assert.match(await page.locator('#stage').textContent(),new RegExp('0'+(stage+1)+' / 08'));
  assert.equal(await page.locator('#enemyName').textContent(),stage===6?'炉心の舞踏獣':'終奏の指揮者');
  assert.match(await page.locator('#enemyIntent').textContent(),stage===6?/強打/:/攻撃態勢/);
  assert.equal(await page.evaluate(()=>EnemyMusic.snapshot(enemies[stage].kind,enemies[stage].bpm).chords.length),4);
  const bounds=await page.locator('#enemy').boundingBox();assert.ok(bounds.width>0&&bounds.height>0&&bounds.x>=0&&bounds.x+bounds.width<=width);
  if(process.env.RIDUMU_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.RIDUMU_SCREENSHOT_DIR,`enemy-${stage+1}-${width}.png`)});
 }
 assert.deepEqual(errors,[]);console.log('PASS: enemies 7/8, normal-mode roster, forecasts, music and desktop/mobile presentation.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
