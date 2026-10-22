const assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--log-file='+path.join(os.tmpdir(),'ridumu-chord-rhythms.log')],...(process.env.RIDUMU_BROWSER?{executablePath:process.env.RIDUMU_BROWSER}:{})});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(require('node:url').pathToFileURL(path.resolve(__dirname,'../index.html')).href);await page.locator('[data-choose-mode="normal"]').click();
  const result=await page.evaluate(async()=>{
   async function render(kind,saved=null){
    const bpm=120,duration=4,rate=48000,c=new OfflineAudioContext(1,rate*(duration+.25),rate),starts=[];let now=0,tick;
    const host={state:'running',get currentTime(){return now;},destination:c.destination,createGain:()=>c.createGain(),createBiquadFilter:()=>c.createBiquadFilter(),createOscillator:()=>{const osc=c.createOscillator(),start=osc.start.bind(osc);osc.start=t=>{starts.push(t);start(t);};return osc;}};
    const music=EnemyMusic.create(host,c.destination,{setInterval(fn){tick=fn;return 1;},clearInterval(){}});music.setEnemy(kind,bpm);if(saved)music.setSnapshot(saved);music.start(.01,.01+duration);
    for(now=.025;now<duration+.2;now+=.025)tick();
    const data=(await c.startRendering()).getChannelData(0),peak=data.reduce((m,x)=>Math.max(m,Math.abs(x)),0),rms=Math.sqrt(data.reduce((s,x)=>s+x*x,0)/data.length);
    return {kind,starts:[...new Set(starts)],peak,rms,data};
   }
   const rows=[];
   for(const kind of Object.keys(EnemyMusic.progressions)){const r=await render(kind),expected=EnemyMusic.timeline(EnemyMusic.snapshot(kind,120),4).map(n=>n.t+.01);rows.push({kind,starts:r.starts,expected,peak:r.peak,rms:r.rms});}
   const saved=EnemyMusic.snapshot('ghost',120),a=await render('ghost'),b=await render('fly',saved);let difference=0;for(let i=0;i<a.data.length;i++)difference=Math.max(difference,Math.abs(a.data[i]-b.data[i]));
   audio();muted=true;state='ready';stage=2;update();const tooltip=document.getElementById('enemyBpm').title;
   return {rows,difference,tooltip};
  });
  for(const r of result.rows){assert.equal(r.starts.length,r.expected.length,r.kind);r.starts.forEach((t,i)=>assert.ok(Math.abs(t-r.expected[i])<1e-8,r.kind));assert.ok(r.peak<.4,r.kind+' clipping');assert.ok(r.rms>.005,r.kind+' inaudible');}
  assert.ok(result.difference<1e-7);assert.match(result.tooltip,/裏拍/);assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,...result}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
