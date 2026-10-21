// Visual QA and an interactive, standalone contact sheet. The game uses the
// same geometry and renderer; the sheet adds no production dependencies.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const Art=require('../enemy-art.js'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.RIDUMU_ART_OUTPUT;
if(!out)throw Error('Set RIDUMU_ART_OUTPUT to a screenshot/preview directory.');
fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(path.join(root,'enemy-art.js'),'utf8');
const gallery=`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RIDUMU — 敵の彫刻</title>
<style>*{box-sizing:border-box}body{margin:0;background:#101713;color:#dfded1;font:14px Arial,sans-serif}header{padding:32px 48px 20px;border-bottom:1px solid #354139;display:flex;justify-content:space-between;align-items:end;gap:20px}h1{font-size:26px;font-weight:500;letter-spacing:.06em;margin:8px 0}header p{color:#8faaa0;font-size:11px;letter-spacing:.16em;margin:0}nav{display:flex;gap:6px;flex-wrap:wrap}button{background:transparent;border:1px solid #465349;color:#b9c5b5;border-radius:4px;padding:9px 13px;cursor:pointer}button[aria-pressed=true]{background:#d1d8bd;color:#18241b}main{padding:24px 48px 32px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}article{background:#18221c;border:1px solid #344338;border-radius:3px;padding:0 22px 20px;overflow:hidden}.form{height:270px;display:grid;place-items:center}.sculpture{width:var(--sculpture-size,250px);height:var(--sculpture-size,250px)}svg{width:100%;height:100%;display:block}h2{font-size:15px;font-weight:500;margin:0 0 10px;letter-spacing:.04em}article p{color:#9eada0;font-size:11px;margin:0;line-height:1.6}small{display:block;font-size:10px;letter-spacing:.17em;color:#708678;margin:0 0 10px}footer{padding:0 48px 24px;font-size:11px;color:#8b9e91;letter-spacing:.03em}.mono path{fill:#ccd3c4;stroke:#ccd3c4}.mono path[fill=none]{fill:none}@media(max-width:800px){header{padding:24px;display:block}nav{margin-top:20px}main{padding:20px;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.form{height:200px}article{padding:0 14px 18px}footer{padding:0 24px 24px}}@media(max-width:420px){main{grid-template-columns:1fr}.form{height:240px}}</style>
<header><div><p>RIDUMU / SCULPTURES · 01—08</p><h1>形で識別する、8つの存在。</h1></div><nav aria-label="動きの確認">${[['still','静止'],['idle','待機'],['prepare','準備'],['strike','攻撃'],['guard','防御'],['weak','被弾'],['mono','輪郭']].map(([id,label])=>`<button data-mode="${id}" aria-pressed="${id==='still'}">${label}</button>`).join('')}</nav></header>
<main>${Object.entries(Art.definitions).map(([kind,def],i)=>`<article><div class="form"><div class="sculpture" data-kind="${kind}"></div></div><small>FORM / ${String(i+1).padStart(2,'0')}</small><h2>${def.name}</h2><p>${def.concept}</p></article>`).join('')}</main><footer>3色の面、余白、固有の関節。操作で静止姿勢と動きを比較できます。</footer>
<script>${source}</script><script>let mode='still',start=performance.now();document.querySelectorAll('button').forEach(button=>button.onclick=()=>{if(button.dataset.mode==='mono'){document.body.classList.toggle('mono');button.setAttribute('aria-pressed',document.body.classList.contains('mono'));return;}mode=button.dataset.mode;start=performance.now();document.querySelectorAll('button:not([data-mode=mono])').forEach(b=>b.setAttribute('aria-pressed',b===button));});function frame(){const t=(performance.now()-start)/1000;for(const host of document.querySelectorAll('.sculpture')){const instance=EnemyArt.mount(host,host.dataset.kind);if(['strike','weak'].includes(mode))instance.reaction={type:mode,time:t-(t%1.6)};else instance.reaction=null;EnemyArt.update(host,{kind:host.dataset.kind,time:mode==='still'?0:t,phase:'ready',intent:mode==='guard'?'guard':'neutral',charging:mode==='prepare',beat:mode==='idle'?t*2:null});}requestAnimationFrame(frame);}frame();</script></html>`;
fs.writeFileSync(path.join(out,'enemy-art.html'),gallery);
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.wav':'audio/wav'};
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://local');if(url.pathname==='/__gallery'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(gallery);return;}if(url.pathname==='/favicon.ico'){res.writeHead(204).end();return;}const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(file)]??'application/octet-stream');res.end(data);});});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({headless:true,args:['--log-file='+path.join(require('node:os').tmpdir(),'ridumu-art-browser.log')],...(process.env.RIDUMU_BROWSER?{executablePath:process.env.RIDUMU_BROWSER}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1020}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text());});
  const base=`http://127.0.0.1:${server.address().port}`;
  await page.goto(base+'/__gallery');await page.locator('[data-sculpture=conductor]').waitFor();
  await page.screenshot({path:path.join(out,'enemy-art.png'),fullPage:true});
  for(const mode of ['guard','prepare','strike','weak']){await page.locator('[data-mode='+mode+']').click();await page.waitForTimeout(mode==='strike'||mode==='weak'?180:400);await page.screenshot({path:path.join(out,'enemy-art-'+mode+'.png'),fullPage:true});}
  const paths=await page.evaluate(()=>[...document.querySelectorAll('svg path')].map(n=>({length:n.getTotalLength(),box:n.getBBox().width})));assert(paths.every(n=>n.length>0&&Number.isFinite(n.length)));
  const bounds=await page.evaluate(()=>{
   let extent=0,worst=null;
   for(const host of document.querySelectorAll('.sculpture')){
    const kind=host.dataset.kind,instance=EnemyArt.mount(host,kind);
    const cases=[{guard:1},{charge:1},...Object.entries(EnemyArt.durations).flatMap(([reaction,duration])=>[.25,.5,.75].map(p=>({reaction,age:p*duration,guard:.8,charge:reaction==='strike'?0:1})))];
    for(const options of cases){
     const pose=EnemyArt.sample(kind,{time:0,...options});instance.group.setAttribute('transform',pose.root);pose.parts.forEach((part,i)=>instance.pieces[i].setAttribute('transform',part.transform));
     const inverse=instance.svg.getCTM().inverse();
     for(const path of instance.svg.querySelectorAll('path')){const length=path.getTotalLength(),matrix=inverse.multiply(path.getCTM());for(let i=0;i<=40;i++){const q=path.getPointAtLength(length*i/40),p=new DOMPoint(q.x,q.y).matrixTransform(matrix),current=Math.max(Math.abs(p.x),Math.abs(p.y));if(current>extent){extent=current;worst={kind,options,x:p.x,y:p.y};}}}
    }
   }return {extent,worst};
  });assert(bounds.extent<158,JSON.stringify(bounds));
  await page.goto(base+'/index.html');await page.locator('[data-choose-mode=normal]').click();
  for(const kind of Object.keys(Art.definitions)){
   await page.evaluate(kind=>{stage=enemies.findIndex(e=>e.kind===kind);state='ready';turn=1;enemyHp=enemies[stage].hp;update();},kind);await page.locator('#enemy[data-design='+kind+']').waitFor();
   assert.equal(await page.locator('#enemy svg').count(),1);assert.equal(await page.locator('#enemy image,#enemy img,#enemy i,#enemy .eyes').count(),0);
   assert.equal(await page.locator('#enemy svg').getAttribute('aria-label'),Art.definitions[kind].name);
  }
  const sizes=[];
  for(const [width,height] of [[1440,900],[390,844],[320,568],[844,390]]){
   await page.setViewportSize({width,height});
   for(const kind of Object.keys(Art.definitions)){
    await page.evaluate(kind=>{stage=enemies.findIndex(e=>e.kind===kind);turn=1;state='ready';enemyHp=enemies[stage].hp;update();},kind);await page.locator('#enemy[data-design='+kind+']').waitFor();await page.waitForTimeout(25);
    const size=await page.evaluate(()=>{const a=document.getElementById('enemy').getBoundingClientRect(),b=document.querySelector('.battlefield').getBoundingClientRect();return {art:{x:a.x,y:a.y,w:a.width,h:a.height},field:{x:b.x,y:b.y,w:b.width,h:b.height}};});
    assert(size.art.w>30&&size.art.h>30);assert(size.art.x>=size.field.x-1&&size.art.x+size.art.w<=size.field.x+size.field.w+1);assert(size.art.y>=size.field.y-1&&size.art.y+size.art.h<=size.field.y+size.field.h+1,JSON.stringify({width,height,kind,size}));
    sizes.push({width,height,kind,size:Math.round(size.art.w)});
   }
   await page.screenshot({path:path.join(out,'game-'+width+'x'+height+'.png'),fullPage:true});
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  const reduced=await page.evaluate(()=>{const a=EnemyArt.sample('fly',{time:1,beat:0,reduced:true}),b=EnemyArt.sample('fly',{time:3,beat:.4,reduced:true});return JSON.stringify(a)===JSON.stringify(b);});assert(reduced);
  const signals=await page.evaluate(async()=>{
   const before=JSON.stringify({hp,enemyHp,turn,shield}),original=EnemyArt.react,calls=[];
   EnemyArt.react=(...args)=>{calls.push(args[1]);return original(...args);};
   try{reactEnemy('weak');reactEnemy('strike');reactEnemy('guard');}finally{EnemyArt.react=original;}
   audio();muted=true;await ctx.resume();
   // Exercise the real analyser, silencing only its downstream test output.
   const silence=ctx.createGain();silence.gain.value=0;battleWaveform.analyser.disconnect();battleWaveform.analyser.connect(silence);silence.connect(ctx.destination);
   const tone=ctx.createOscillator(),gain=ctx.createGain();tone.frequency.value=110;gain.gain.value=.03;tone.connect(gain);gain.connect(masterOutput);tone.start();
   await new Promise(resolve=>setTimeout(resolve,180));tone.stop(ctx.currentTime+.1);
   const canvas=document.getElementById('battleWaveform'),pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
   return {before,after:JSON.stringify({hp,enemyHp,turn,shield}),calls,filter:getComputedStyle(document.getElementById('enemy')).filter,waveDrawn:pixels.some((v,i)=>i%4===3&&v>0)};
  });assert.equal(signals.before,signals.after);assert.deepEqual(signals.calls,['weak','strike','guard']);assert.equal(signals.filter,'none');assert(signals.waveDrawn);
  assert.equal(await page.locator('#battleWaveform').count(),1);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ok:true,enemies:8,paths:paths.length,viewports:4,bounds,signals,minSize:Math.min(...sizes.map(s=>s.size))}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
