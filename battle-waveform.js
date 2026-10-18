/* Actual post-compressor audio is immutable; visual effects only affect drawing. */
(function(root){
 const renderers=new Map(),clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 const colors={earth:'#d4f77d',wind:'#9adfd5',fire:'#ffa26d',lightning:'#c6b0ff'};
 function metrics(samples){let sum=0,peak=0;for(const v of samples){sum+=v*v;peak=Math.max(peak,Math.abs(v));}return {rms:Math.sqrt(sum/samples.length),peak};}
 function horizontal(paint,frame){
  const {samples,width:w,height:h,points,gain,color,energy,voice,effects,time,reduced}=frame;
  const strength=reduced?0:effects.strength,groove=effects.groove??{},swing=groove.swing??0,drunk=groove.drunk??0;
  const drift=(Math.sin(time*5)*swing+Math.sin(time*3.1)*Math.sin(time*7)*drunk)*strength*4;
  const jitter=Math.sin(time*37)*Math.cos(time*53)*(groove.unstable??0)*(1-(groove.tight??0))*strength*2;
  const pushed=Math.max(groove.pushed??0,groove.snarePushed??0)*strength*4;
  const elemental=effects.element==='earth'?.12:effects.element==='fire'?.22:0;
  const scale=(1+strength*(.22+elemental))*(1-effects.enemy*.25),amplitude=h*.34*gain*scale*(reduced?.5:1);
  const smooth=Math.min(.4,(voice==='bass'?.25:voice==='lead'?.03:.08)+effects.boost*.12);
  const draw=(offset=0,alpha=1)=>{
   paint.beginPath();let previous=0;
   for(let i=0;i<points;i++){
    const sample=samples[Math.floor(i*(samples.length-1)/(points-1))];
    const value=sample*(1-smooth)+previous*smooth;previous=value;
    // Distortion is a small, energy-gated drawing offset, never written to audio.
    const noise=(effects.poison*.1+effects.enemy*.06+(effects.element==='lightning'?strength*.035:0))*energy*Math.sin(i*2.39+time*23);
    const x=w*.04+i/(points-1)*w*.92+drift+pushed+(effects.element==='wind'?Math.sin(time*4)*strength*3:0);
    const y=h*.53+(value+noise)*amplitude+offset+jitter;
    if(i===0)paint.moveTo(x,y);else paint.lineTo(x,y);
   }
   paint.globalAlpha=alpha;paint.stroke();
  };
  paint.save();paint.strokeStyle=color;paint.lineWidth=voice==='bass'?2:1.4;paint.lineJoin='round';
  paint.globalAlpha=.42;draw(0,.38+Math.min(.35,energy*4));
  // A quieter surrounding echo provides the delayed breadth of laid-back playing.
  if(!reduced&&strength>.05){const tail=(groove.laidBack??0)>0?clamp((effects.attackAge-.06)/.18):1;paint.lineWidth=.8;draw((3+8*(groove.laidBack??0))*strength*tail,.12*strength*tail);}
  paint.restore();
  // Quiet directional contours; reduced-motion users keep static pitch labels.
  if(!reduced&&effects.pitch){const e=effects.pitch;paint.save();paint.globalAlpha=.45;paint.strokeStyle='#c6b0ff';
   if(e.rise){paint.lineWidth=1+e.rise*8;paint.beginPath();paint.moveTo(w*.25,h*.7);paint.lineTo(w*.55,h*(.7-e.rise*2));paint.stroke();}
   if(e.fall){paint.lineWidth=1;paint.strokeStyle='#8edcdd';paint.beginPath();for(let i=0;i<40;i++){const x=w*(.3+i/100),y=h*(.35+i/140)+Math.sin(i*.6+time*3)*h*.025;if(i)paint.lineTo(x,y);else paint.moveTo(x,y);}paint.stroke();}
   if(e.pierce){paint.strokeStyle='#c6b0ff';paint.lineWidth=1+e.pierce*3;paint.beginPath();paint.moveTo(w*.3,h*.7);paint.lineTo(w*.52,h*.3);paint.lineTo(w*.47,h*.55);paint.lineTo(w*.7,h*.3);paint.stroke();}
   if(e.repeat){paint.strokeStyle='#efd88b';paint.lineWidth=1;for(const y of [.42,.5]){paint.beginPath();paint.moveTo(w*.35,h*y);paint.lineTo(w*.65,h*y);paint.stroke();}}
   if(e.low||e.high){paint.strokeStyle=e.high?'#efa568':'#8edcdd';paint.lineWidth=1+(e.low??0)*20;paint.beginPath();paint.ellipse(w*.5,h*.58,w*.28,h*.2,0,0,Math.PI*2);paint.stroke();if(e.high){paint.beginPath();paint.moveTo(w*.5,h*.4);paint.lineTo(w*.7,h*.25);paint.stroke();}}
   paint.restore();
  }
  if(!reduced&&effects.shield>0){
   paint.save();paint.strokeStyle='#8edcdd';paint.globalAlpha=effects.shield*.22;paint.lineWidth=1;
   paint.beginPath();paint.ellipse(w*.5,h*.53,w*(.18+.28*(1-effects.shield)),h*(.08+.18*(1-effects.shield)),0,0,Math.PI*2);paint.stroke();paint.restore();
  }
 }
 renderers.set('horizontal',horizontal);
 function connect(audioContext,master,canvas,options={}){
  const output=options.output??audioContext.destination;
  const analyser=audioContext.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.65;
  // This replaces, rather than duplicates, the master -> destination connection.
  master.connect(analyser);analyser.connect(output);
  const paint=canvas.getContext('2d'),samples=new Float32Array(analyser.fftSize);
  const request=options.requestFrame??root.requestAnimationFrame.bind(root),cancel=options.cancelFrame??root.cancelAnimationFrame.bind(root);
  const doc=options.document??root.document,media=root.matchMedia?.('(prefers-reduced-motion: reduce)');
  let width=1,height=1,ratio=1,frameId=null,lastFrame=-Infinity,voice='drums',renderer='horizontal',disposed=false,level=0;
  const queue=[],effects=[],maxEffects=24;
  function resize(){
   const box=canvas.getBoundingClientRect();width=Math.max(1,Math.min(1000,box.width));height=Math.max(1,Math.min(600,box.height));
   ratio=Math.min(1.5,options.pixelRatio??root.devicePixelRatio??1);
   const w=Math.round(width*ratio),h=Math.round(height*ratio);
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  }
  const Observer=options.ResizeObserver??root.ResizeObserver,observer=Observer?new Observer(resize):null;
  observer?.observe(canvas);root.addEventListener?.('resize',resize);resize();
  function trigger(kind,data={},at=audioContext.currentTime){
   if(disposed)return;
   queue.push({kind,data,at});if(queue.length>128)queue.splice(0,queue.length-128);
  }
  function render(now){
   frameId=null;if(disposed||doc?.hidden)return;
   frameId=request(render);
   if(now-lastFrame<(width<700?1000/30:1000/60))return;lastFrame=now;
   const time=audioContext.currentTime;
   for(let i=queue.length-1;i>=0;i--)if(queue[i].at<=time){effects.push({...queue[i],duration:queue[i].kind==='shield'?1.1:.65});queue.splice(i,1);}
   if(effects.length>maxEffects)effects.splice(0,effects.length-maxEffects);
   for(let i=effects.length-1;i>=0;i--)if(time-effects[i].at>effects[i].duration)effects.splice(i,1);
   analyser.getFloatTimeDomainData(samples);
   const measured=metrics(samples);level=level*.82+measured.rms*.18;
   const state={strength:0,enemy:0,poison:0,shield:0,boost:0,groove:null,element:null,attackAge:0,pitch:null};let color='#a4b99c',colorTime=-Infinity;
   for(const event of effects){
    const remaining=clamp(1-(time-event.at)/event.duration),power=remaining*remaining;
    if(event.kind==='pitch')state.pitch=Object.fromEntries(Object.entries(event.data).map(([k,v])=>[k,v*remaining]));
    else if(event.kind==='enemy')state.enemy=Math.max(state.enemy,power);
    else if(event.kind==='poison')state.poison=Math.max(state.poison,power);
    else if(event.kind==='shield')state.shield=Math.max(state.shield,remaining);
    else if(event.kind==='boost'){state.boost=Math.max(state.boost,power);state.strength=Math.max(state.strength,power*.65);}
    else state.strength=Math.max(state.strength,power*(event.data.amount??.6));
    if(event.data.element&&event.at>=colorTime){colorTime=event.at;color=colors[event.data.element]??color;state.element=event.data.element;state.groove=event.data.groove??null;state.attackAge=time-event.at;}
   }
   state.strength=clamp(state.strength);
   paint.setTransform(ratio,0,0,ratio,0,0);paint.clearRect(0,0,width,height);
   if(level<.00015&&measured.peak<.0003&&state.shield===0)return;
   const draw=renderers.get(renderer)??horizontal;
   draw(paint,{samples,analyser,width,height,points:Math.max(32,Math.min(320,Math.round(width/2))),gain:Math.min(8,.45/Math.max(.025,level*2)),energy:measured.rms,color,voice,effects:state,time,reduced:!!media?.matches});
  }
  function resume(){if(!disposed&&frameId===null&&!doc?.hidden){lastFrame=-Infinity;frameId=request(render);}}
  function visibility(){if(doc?.hidden){if(frameId!==null)cancel(frameId);frameId=null;}else resume();}
  doc?.addEventListener?.('visibilitychange',visibility);resume();
  return {analyser,trigger,setVoice(value){voice=value;},setRenderer(value){if(!renderers.has(value))throw Error('Unknown waveform renderer');renderer=value;},
   note(type,part,at){if(part==='drums')trigger(type,{amount:type==='kick'?.8:.55},at);else if(part==='lead')trigger('lead',{amount:.3},at);},
   dispose(){if(disposed)return;disposed=true;if(frameId!==null)cancel(frameId);observer?.disconnect();root.removeEventListener?.('resize',resize);doc?.removeEventListener?.('visibilitychange',visibility);master.disconnect(analyser);analyser.disconnect();master.connect(output);}
  };
 }
 const api={connect,metrics,registerRenderer:(name,draw)=>renderers.set(name,draw)};
 root.BattleWaveform=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
