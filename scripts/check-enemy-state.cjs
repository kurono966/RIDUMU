const {chromium}=require('playwright'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.RIDUMU_STATE_OUTPUT;
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.wav':'audio/wav'})[path.extname(file)]??'application/octet-stream');res.end(data);});});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({headless:true,args:['--log-file='+path.join(require('node:os').tmpdir(),'ridumu-state-browser.log')],...(process.env.RIDUMU_BROWSER?{executablePath:process.env.RIDUMU_BROWSER}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);await page.locator('[data-choose-mode=normal]').click();
  await page.evaluate(()=>{audio();muted=true;window.stateReactions=[];const original=reactEnemy;reactEnemy=(kind,...args)=>{stateReactions.push(kind);return original(kind,...args);};window.attackSounds=0;enemyAttackSound=()=>attackSounds++;});
  const shot=async name=>{if(out){fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});}};
  const act=async(type,overrides={})=>page.evaluate(async({type,overrides})=>{
   const e=enemies[stage];e.intentOrder=Array(6).fill(type);state='ready';enemyHp=type==='heal'?80:e.hp;hp=100;shield=90;turn=1;update();
   const a=Rhythm.analyze([],480/e.bpm,e.bpm);a.tactics={guardBreak:0,healBlock:0,buffSuppress:0,stagger:0,disrupt:0,value:0,label:'',...overrides};await enemyCounter(a,{},{});
   state='ready';turn=4;e.intentOrder[1]='heavy';update();for(let i=0;i<5;i++)renderBattlePlan();
   return {guard:e.guard,attack:e.attack,hp:enemyHp,playerHp:hp,shield,text:document.getElementById('enemyActionResult').innerText,effects:document.getElementById('enemyEffects').innerText,next:document.getElementById('enemyIntent').innerText};
  },{type,overrides});
  const guard=await act('guard');assert.equal(Math.round(guard.guard*100),35);assert.match(guard.text,/20% → 35%/);assert.match(guard.effects,/35%軽減/);assert.match(guard.next,/強打/);await shot('01-armor-active');
  await page.waitForTimeout(650);assert.match(await page.locator('#enemyActionResult').innerText(),/20% → 35%/,'the resolved action must persist');
  const broken=await act('guard',{guardBreak:1});assert.equal(Math.round(broken.guard*100),20);assert.match(broken.text,/装甲を崩した/);await shot('02-armor-broken');
  const buff=await act('buff');assert.equal(buff.attack,101);assert.match(buff.effects,/＋13/);assert.match(buff.text,/88 → 101/);await shot('03-attack-buff');
  const healed=await act('heal');assert.equal(healed.hp,111);assert.match(healed.text,/80 → 111/);await shot('04-healing');
  const blocked=await act('heal',{healBlock:1});assert.equal(blocked.hp,80);assert.match(blocked.text,/回復を阻止/);await shot('05-heal-blocked');
  assert.equal(await page.evaluate(()=>attackSounds),0);assert.deepEqual(await page.evaluate(()=>stateReactions),['guard','guard','buff','heal','heal']);
  const attack=await act('pierce');assert(attack.playerHp<100);assert.match(attack.text,/あなたのHP/);assert.match(attack.text,/盾40%貫通/);assert.equal(await page.evaluate(()=>attackSounds),1);await shot('06-pierce');
  for(const [width,height] of [[1366,768],[390,844],[320,568],[844,390]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(80);
   const box=await page.locator('#enemyState').boundingBox();assert(box.width>0&&box.x>=0&&box.x+box.width<=width+1);assert(box.y+box.height<=height+1);
   const scene=await page.evaluate(()=>({enemy:document.getElementById('enemy').getBoundingClientRect().height,field:document.querySelector('.battlefield').getBoundingClientRect().height}));assert(scene.field>=scene.enemy-1,JSON.stringify({width,height,scene}));await shot(`state-${width}x${height}`);
  }
  await page.evaluate(()=>prepareMode('normal'));assert(await page.locator('#enemyActionResult').isHidden());assert(!((await page.locator('#enemyEffects').innerText()).includes('＋13')));
  assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,checks:['actual armor increase/break','persistent result/structured next intent','buff/heal/block/pierce','non-attacks have no attack sound or strike','new encounter reset','four viewport sizes'],values:{guard,buff,healed,blocked,attack}}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
