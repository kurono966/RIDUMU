const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.RIDUMU_BROWSER});
 try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
 await page.click('[data-choose-mode="normal"]');
 assert.equal(await page.locator('#elementMeter').isVisible(),false);
 for(const [width,height] of [[1280,720],[390,844],[320,568],[320,480],[844,390]]){
  await page.setViewportSize({width,height});
  assert(await page.locator('#start').isVisible());
  await page.locator('#start').scrollIntoViewIfNeeded();
  assert(await page.locator('#start').evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e===hit||e.contains(hit);}));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(process.env.RIDUMU_SCREENSHOTS)await page.screenshot({path:path.join(process.env.RIDUMU_SCREENSHOTS,`layout-${width}.png`),fullPage:true});
 }
 await page.setViewportSize({width:1280,height:720});
 await page.click('#openMenu');await page.click('#openLayout');
 await page.click('#layoutAll');await page.click('#closeLayout');
 for(const id of ['enemyDesc','partSteps','elementMeter'])assert(await page.locator('#'+id).isVisible(),id+' can be enabled');
 await page.click('#openMenu');await page.click('#openLayout');await page.click('#layoutSimple');
 await page.locator('[data-layout="element"]').check();
 await page.selectOption('[data-layout="side"]','enemy-right');
 await page.selectOption('[data-layout="result"]','top');
 await page.selectOption('[data-layout="timeline"]','bottom');
 await page.click('#closeLayout');
 const readyState=await page.evaluate(()=>state);await page.click('#openMenu');await page.click('#openLayout');await page.keyboard.press('a');await page.keyboard.press('h');assert.equal(await page.evaluate(()=>state),readyState);await page.keyboard.press('Escape');
 assert(await page.locator('#elementMeter').isVisible());
 assert(await page.evaluate(()=>document.querySelector('.enemy-info').getBoundingClientRect().left>document.getElementById('enemyState').getBoundingClientRect().left));
 await page.reload();await page.click('[data-choose-mode="normal"]');
 assert(await page.locator('#elementMeter').isVisible());
 assert.equal(await page.locator('#mobileMoveSlot').evaluate(e=>getComputedStyle(e).order),'0');
 await page.evaluate(()=>{document.getElementById('result').hidden=false;document.getElementById('timingAccuracy').textContent='正確さ 93%';});
 assert(await page.locator('#timingAccuracy').isVisible());
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.locator('#result').evaluate(e=>e.parentElement.id),'mobileMoveSlot');
 await page.click('#openMenu');await page.click('#openLayout');await page.click('#layoutSimple');await page.click('#closeLayout');
 assert.equal(await page.locator('#elementMeter').isVisible(),false);
 await page.click('#returnTitle');await page.click('[data-choose-mode="roguelite"]');
 await page.click('#start');
 await page.locator('#rogueChoices button').first().click();
 assert(await page.locator('#toggleGearDetails').isVisible());
 assert.equal(await page.locator('#rogueGear').isVisible(),false);
 await page.click('#toggleGearDetails');assert(await page.locator('#rogueGear').isVisible());
 assert.deepEqual(errors,[]);console.log('Layout checks passed: defaults, viewport access, toggles, positions, persistence, reset, rogue inventory.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
