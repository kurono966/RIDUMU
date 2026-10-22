// Browser integration check. Run with Playwright on NODE_PATH; no npm dependency
// is needed by the game itself. Screenshots are optional via RIDUMU_SCREENSHOTS.
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.RIDUMU_SCREENSHOTS;
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wav':'audio/wav','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname),file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(file)]??'application/octet-stream');res.end(data);});});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({headless:true,args:['--log-file='+path.join(require('node:os').tmpdir(),'ridumu-roguelite-browser.log')],...(process.env.RIDUMU_BROWSER?{executablePath:process.env.RIDUMU_BROWSER}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{let seed=2741;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);});
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  const shot=async name=>{if(out){fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});}};
  const choose=async id=>page.locator(`[data-rogue-choice="${id}"]`).click();
  const title=async pattern=>{await page.waitForFunction(source=>document.getElementById('rogueRewardDialog').open&&new RegExp(source).test(document.getElementById('rewardTitle').textContent),pattern);};
  const kill=async()=>page.evaluate(()=>{hp=Math.max(30,hp);enemyHp=0;completeBattle();});
  const start=async()=>page.locator('#start').click();
  await page.locator('[data-choose-mode=roguelite]').click();await start();await title('最初');await shot('01-starting-equipment');
  const original=await page.locator('#rogueChoices').innerText();await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>state),'ready');
  await start();assert.equal(await page.locator('#rogueChoices').innerText(),original);await page.locator('[data-rogue-choice]').first().click();
  assert.equal(await page.evaluate(()=>rogueRun.phase),'battle');assert.equal(await page.evaluate(()=>rogueRun.gear.length),1);
  await kill();await start();await title('勝利報酬');await page.locator('[data-rogue-choice]').first().click();await title('次の進路');await shot('02-route-choice');
  const elite=await page.evaluate(()=>rogueRun.offers.find(o=>o.kind==='elite').enemy);await choose('elite');
  assert.deepEqual(await page.evaluate(()=>({floor:rogueRun.floor,state,hp:enemies[stage].hp,attack:enemies[stage].attack})),{floor:2,state:'ready',hp:elite.hp,attack:elite.attack});
  await kill();await start();await title('勝利報酬');assert(await page.evaluate(()=>rogueRun.rewards.every(g=>g.rank===(rogueRun.gear.find(item=>item.id===g.id)?.rank??0)+2)));await page.locator('[data-rogue-choice]').first().click();await title('次の進路');
  await page.evaluate(()=>{hp=40;update();});await choose('rest');await title('休憩所');await choose('heal');await title('次の進路');
  assert.equal(await page.evaluate(()=>hp),75);assert.equal(await page.evaluate(()=>rogueRun.floor),2);assert.equal(await page.locator('[data-rogue-choice=rest]').count(),0);
  await choose('normal');await kill();assert.equal(await page.evaluate(()=>rogueRun.phase),'route');await start();await title('次の進路');await choose('session');await title('セッションの課題');await choose('repeat');
  assert.equal(await page.evaluate(()=>rogueRun.challenge.id),'repeat');
  // Real finish()/analysis/review/playback pipeline, with seeded recorded input.
  const cycle=await page.evaluate(async()=>{
   rogueRun.gear=[];for(const id of ['wind','echo','response','break'])RogueRun.equip(rogueRun,{id,rank:6});shield=80;
   audio();muted=true;hp=65;enemyHp=5000;enemies[stage].hp=5000;enemies[stage].intentOrder=Array(6).fill('guard');turn=1;state='ready';continuousInput=false;
   const beat=60/timing().bpm,duration=beat*8;prepareTracksForTurn();hatNotes=Array.from({length:16},(_,i)=>({type:'hat',t:i*beat/2,rawT:i*beat/2}));hatReady=true;
   let saved=null;const begin=ExperienceUI.begin;ExperienceUI.begin=(packet,actual)=>{saved={packet,actual};return begin(packet,actual);};
   try{
    for(const voice of ['drums','bass','lead']){
     state='recording';phase='parts';phaseQuantizeMode='off';recordAudioAt=ctx.currentTime-duration;
     notes=voice==='drums'?Array.from({length:8},(_,i)=>({type:i%2?'snare':'kick',t:i*beat,rawT:i*beat})):voice==='bass'?Array.from({length:4},(_,i)=>({type:'kick',t:i*beat*2,rawT:i*beat*2,duration:beat,midi:36})):Array.from({length:4},(_,i)=>({type:'snare',t:i*beat*2+beat/4,rawT:i*beat*2+beat/4,duration:beat/4,midi:60}));
     synthRecording=voice==='drums'?null:{version:1,patch:Synth.patch({},voice),events:[]};await finish();
    }
   }finally{ExperienceUI.begin=begin;}
   const review=PerformanceReview.evaluate(saved.packet);return {actual:saved.actual.result.total,review:review.result.total,shield:saved.actual.shield,reviewShield:review.shield,power:saved.actual.analysis.power,reviewPower:review.analysis.power,done:rogueRun.challenge.done,gear:saved.actual.analysis.gearEffects,phase:state};
  });
  assert.equal(cycle.actual,cycle.review);assert.equal(cycle.shield,cycle.reviewShield);assert.equal(cycle.power,cycle.reviewPower);assert(cycle.done);assert(cycle.gear.triggers.length>=3);assert.equal(cycle.phase,'ready');await shot('03-active-rig');
  assert(cycle.shield>90);assert(cycle.gear.attack>.25);assert(cycle.gear.heal>6);
  await kill();await page.evaluate(()=>{rogueRun.rewards=[{id:'sustain',rank:1},{id:'lock',rank:1},{id:'sub',rank:1}];});await start();await title('セッション成功');await page.locator('[data-rogue-choice]').first().click();await title('勝利報酬');await choose('sustain');await title('次の進路');
  assert.equal(await page.evaluate(()=>rogueRun.gear.length),5);assert(await page.evaluate(()=>rogueRun.gear.some(g=>g.id==='sustain')&&rogueRun.gear.some(g=>g.id==='break')));
  await choose('normal');
  await page.setViewportSize({width:390,height:844});await page.locator('#start').scrollIntoViewIfNeeded();
  const startBox=await page.locator('#start').boundingBox();assert(startBox.y>=0&&startBox.y+startBox.height<=844,'mobile start must be reachable by scrolling');await shot('04-mobile-rig');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile rack must not overflow horizontally');
  while(await page.evaluate(()=>rogueRun.floor)<8){
   await kill();await start();if(await page.evaluate(()=>rogueRun.phase)==='reward'){await title('勝利報酬');await choose('skip');}
   await title('次の進路');await shot('05-mobile-route-'+await page.evaluate(()=>rogueRun.floor));await choose(await page.evaluate(()=>rogueRun.floor===7?'boss':'normal'));
  }
  assert.equal(await page.evaluate(()=>enemies[stage].kind),'conductor');await kill();assert.equal(await page.evaluate(()=>rogueRun.phase),'complete');await shot('06-complete');
  await start();await title('最初');assert.equal(await page.evaluate(()=>rogueRun.gear.length),0);assert.equal(await page.evaluate(()=>rogueRun.floor),1);await page.keyboard.press('Escape');
  await page.locator('#returnTitle').click();await page.locator('[data-choose-mode=normal]').click();assert.equal(await page.evaluate(()=>rogueRun),null);assert(await page.locator('#rogueRack').isHidden());assert.equal(await page.evaluate(()=>enemies[0].kind),'stone');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,checks:['starter/cancel/resume','elite preview/reward','rest/reward exchange','session/live combat/review','five-item accumulation/no swap','eight encounters/boss','mobile layout','retry/normal isolation'],cycle}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
