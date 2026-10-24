const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.RIDUMU_BROWSER});try{
 const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;
 await p.goto(url);await p.click('[data-choose-mode="normal"]');await p.evaluate(()=>{audio();muted=true;});
 const before=await p.evaluate(()=>JSON.stringify({hp,enemyHp,turn,notes,tracks:[...tracks],state}));
 await p.evaluate(()=>{StageFX.hit({type:'kick',damage:30,color:'#d4f77d'});StageFX.shield(24);StageFX.phase('bass');});
 assert.equal(await p.evaluate(()=>JSON.stringify({hp,enemyHp,turn,notes,tracks:[...tracks],state})),before,'visual events do not alter game');
 assert(await p.locator('.stage-particle').count()>0);assert(await p.locator('.player-strip').evaluate(e=>e.classList.contains('stage-shield')));
 await p.waitForTimeout(70);assert.equal(await p.evaluate(()=>StageFX.isFrozen()),false);
 // Only actual selected cells can produce a connection; types and raw/display times stay distinct.
 const link=await p.evaluate(()=>{
  const parts=new Map([['drums',[{type:'snare',t:.5,inputT:.48},{type:'kick',t:0,inputT:.01}]],['bass',[{type:'kick',t:.02,inputT:.02}]],['lead',[{type:'snare',t:.75,inputT:.75}]]]);
  const e={kind:'lock',q:0,cells:[{voice:'drums',type:'kick',q:0},{voice:'bass',type:'kick',q:0}]},value=StageFX.resolveLink(e,parts,4);StageFX.link(e,parts,4);
  return {value,empty:StageFX.resolveLink({...e,cells:[]},parts,4)};
 });assert.equal(link.value.from.id,'kick');assert.equal(link.value.to.id,'bass');assert.equal(link.value.from.time,0);assert.equal(link.empty,null);
 const attack=await p.evaluate(async()=>{
  StageFX.reset();state='attack';enemyHp=260;lastInstrument='drums';lastDuration=.35;lastBpm=120;lastMix=[{voice:'drums',notes:[{type:'kick',t:0},{type:'snare',t:.15}]}];
  const before=ctx.currentTime;await playbackAttack({damages:[20,12]},'#d4f77d','drums');return {hp:enemyHp,elapsed:ctx.currentTime-before,hit:document.querySelector('.battlefield').dataset.hitKind};
 });assert.equal(attack.hp,228);assert(attack.elapsed>=.35,'audio clock keeps advancing');assert.equal(attack.hit,'snare');
 // Exercise the existing enemy counter, not a replacement battle calculation.
 const counter=await p.evaluate(async()=>{
  StageFX.reset();stage=0;turn=4;state='attack';hp=100;shield=80;enemyHp=260;enemies[0].attack=20;
  const a={count:0,effect:0,element:'earth',tactics:{value:0,stagger:0,disrupt:0}},intent=enemyIntent(),expected=PerformanceCombat.counterAttack(hp,shield,enemyIntentDamage(intent),intent,PerformanceCombat.reduction(null,null,null,a).total,a.tactics);
  let captured='';const guard=StageFX.guard;StageFX.guard=data=>{guard(data);captured=document.querySelector('.stage-notice').textContent;};await enemyCounter(a,{},{});StageFX.guard=guard;return {hp,shield,expected,notice:captured};
 });assert.equal(counter.hp,counter.expected.hp);assert.equal(counter.shield,counter.expected.shield);assert(counter.notice.includes('完全防御'),JSON.stringify(counter));
 for(const [width,height] of [[1920,1080],[1366,768],[1280,720],[390,844]]){
  await p.setViewportSize({width,height});await p.evaluate(()=>{state='ready';StageFX.hit({type:'snare',damage:28,weak:true,color:'#ffe5a0'});StageFX.shield(20);});
  if(width<760)await p.locator('#start').scrollIntoViewIfNeeded();
  assert(await p.locator('#start').evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===e||e.contains(hit);}));
  if(process.env.RIDUMU_SCREENSHOTS&&width===1280)await p.screenshot({path:path.join(process.env.RIDUMU_SCREENSHOTS,'stage-fx-hit.png')});
 }
 await p.setViewportSize({width:1280,height:720});
 await p.evaluate(()=>{state='attack';hp=100;enemyHp=0;completeBattle();});
 assert(await p.locator('#enemy').evaluate(e=>e.classList.contains('stage-defeated')));
 assert(await p.locator('#victoryContinue').isDisabled());await p.waitForTimeout(500);assert.equal(await p.locator('#victoryContinue').isDisabled(),false);
 await p.click('#victoryContinue');assert.equal(await p.locator('#enemy').evaluate(e=>e.classList.contains('stage-defeated')),false,'next enemy is visible');
 await p.reload();await p.click('[data-choose-mode="roguelite"]');await p.click('#start');await p.locator('#rogueChoices button').first().click();
 assert(await p.locator('#rogueRack').evaluate(e=>e.classList.contains('stage-gear')));
 await p.waitForTimeout(1000);assert.equal(await p.locator('.stage-gear-chip').count(),0);
 // Opt-out and reduced motion suppress bursts, freezes, delayed results and links.
 await p.evaluate(()=>{ExperienceUI.effects(false);StageFX.reset();StageFX.hit({type:'kick',damage:50});StageFX.shield(50);});assert.equal(await p.locator('.stage-particle').count(),0);
 assert.equal(await p.evaluate(()=>StageFX.isFrozen()),false);
 await p.emulateMedia({reducedMotion:'reduce'});await p.evaluate(()=>{ExperienceUI.effects(true);StageFX.reset();StageFX.hit({type:'kick',damage:50,weak:true});});assert.equal(await p.locator('.stage-particle').count(),0);assert.equal(await p.evaluate(()=>StageFX.isFrozen()),false);
 assert.equal(await p.evaluate(()=>StageFX.defeat('ghost')),0);
 await p.emulateMedia({reducedMotion:'no-preference'});
 await p.evaluate(()=>{StageFX.reset();for(let i=0;i<20;i++)StageFX.hit({type:'kick',damage:50,weak:true});});assert(await p.locator('.stage-particle').count()<=24);await p.waitForTimeout(1000);assert.equal(await p.locator('.stage-particle').count(),0);
 assert.deepEqual(errors,[]);console.log('Stage FX passed: battle invariants, real shield resolution, cell-based links, four viewports, defeat/next-enemy reset, actual gear claim, opt-out, reduced motion and bounded cleanup.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
