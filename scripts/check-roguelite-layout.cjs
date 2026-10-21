// Browser regression for desktop grid placement, visible results, and resize.
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.RIDUMU_LAYOUT_OUTPUT;
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.wav':'audio/wav'};
const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://local').pathname),file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(file)]??'application/octet-stream');res.end(data);});});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({headless:true,args:['--log-file='+path.join(require('node:os').tmpdir(),'ridumu-layout-browser.log')],...(process.env.RIDUMU_BROWSER?{executablePath:process.env.RIDUMU_BROWSER}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[],checks=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);await page.locator('[data-choose-mode=roguelite]').click();
  await page.evaluate(()=>{
   rogueRun.gear=[{id:'wind',rank:2},{id:'echo',rank:1},{id:'response',rank:1},{id:'break',rank:1}];rogueRun.phase='battle';
   audio();muted=true;autoHat=true;hatReady=true;update();
   $('moveName').textContent='風裂連打';$('element').textContent='風 / DRUMS';$('damage').textContent='128';$('damageLabel').textContent='TOTAL DAMAGE';$('resultCause').textContent='交互の刻みと機材が成立';
  });
  const measure=async()=>page.evaluate(()=>{
   const rect=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};},el=id=>document.getElementById(id);
   return {main:rect(el('game')),rack:rect(el('rogueRack')),arena:rect(el('arena')),console:rect(document.querySelector('#game>.console')),result:el('result').hidden?null:rect(el('result')),columns:getComputedStyle(el('game')).gridTemplateColumns,areas:getComputedStyle(el('game')).gridTemplateAreas,parent:el('result').parentElement.id,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight};
  });
  const intersects=(a,b)=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1;
  for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[1280,720],[1024,768],[1024,600]]){
   await page.setViewportSize({width,height});
   for(const visible of [false,true])for(const turnValue of [1,2,3]){
    await page.evaluate(({visible,turnValue})=>{state='recording';phase='parts';turn=turnValue;recordAudioAt=ctx.currentTime;continuousRunning=true;$('result').hidden=!visible;update();}, {visible,turnValue});await page.waitForTimeout(40);
    const boxes=await measure(),label=JSON.stringify({width,height,visible,turnValue,boxes});
    assert.equal(boxes.columns.split(' ').length,2,label);assert.equal(boxes.parent,'game');assert(boxes.areas.includes('rig'),label);
    const panels=[boxes.rack,boxes.arena,boxes.console,...(boxes.result?[boxes.result]:[])];
    for(const box of panels){assert(box.w>0&&box.h>0,label);assert(box.x>=-1&&box.right<=width+1&&box.y>=-1&&box.bottom<=height+1,label);}
    for(let i=0;i<panels.length;i++)for(let j=i+1;j<panels.length;j++)assert(!intersects(panels[i],panels[j]),label);
    assert(boxes.scrollWidth<=width+1&&boxes.scrollHeight<=height+1,label);checks.push({width,height,visible,turn:turnValue});
   }
   // Expanded equipment stays within the bounded rack row.
   await page.locator('#rogueGear details').evaluateAll(nodes=>nodes.forEach(n=>n.open=true));const expanded=await measure();assert(!intersects(expanded.rack,expanded.arena));assert(!intersects(expanded.rack,expanded.console));
   if(out){fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,`rogue-desktop-${width}x${height}.png`),fullPage:true});}
  }
  // Return through the phone layout: the original result node must move back
  // into the desktop's named area without creating a third grid column.
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.getElementById('result').parentElement.id==='mobileMoveSlot');
  await page.setViewportSize({width:1920,height:1080});await page.waitForFunction(()=>document.getElementById('result').parentElement.id==='game');
  assert.equal((await measure()).columns.split(' ').length,2);
  await page.evaluate(async()=>{await document.documentElement.requestFullscreen();});await page.waitForTimeout(60);
  const full=await measure();assert(full.rack.right<=await page.evaluate(()=>innerWidth));assert(full.result.right<=await page.evaluate(()=>innerWidth));await page.evaluate(()=>document.exitFullscreen());
  assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,desktopCases:checks.length,viewports:6,checks:['recording drums/bass/lead','results hidden/visible','expanded rig','mobile to desktop','fullscreen','no overlaps or page overflow']}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
