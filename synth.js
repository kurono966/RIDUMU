/* Independent bass/lead patches, deterministic timbre traits, and local snapshots. */
(function(root){
 const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
 const voices=['bass','lead'],waves=['sine','triangle','sawtooth','square'];
 const ranges={cutoff:[80,16000],resonance:[0,12],attack:[.003,2],decay:[.01,2],sustain:[0,1],release:[.02,3],harmonic:[0,.5],toneDecay:[0,2],toneSustain:[.05,1]};
 const defaults={bass:{wave:'triangle',cutoff:950,resonance:.7,attack:.009,decay:.09,sustain:.78,release:.12,harmonic:0,toneDecay:0,toneSustain:1,curve:'linear'},lead:{wave:'triangle',cutoff:3600,resonance:.8,attack:.008,decay:.072,sustain:.65,release:.12,harmonic:.18,toneDecay:.12,toneSustain:.5,curve:'exponential'}};
 function patch(value={},voice='lead'){
  const base=defaults[voice]??defaults.lead,result={wave:waves.includes(value.wave)?value.wave:base.wave,curve:['linear','exponential'].includes(value.curve)?value.curve:base.curve};
  for(const [key,[lo,hi]] of Object.entries(ranges))result[key]=clamp(Number.isFinite(value[key])?value[key]:base[key],lo,hi);
  return result;
 }
 function pad(value={}){return {amount:clamp(Number.isFinite(value.amount)?value.amount:0),mode:value.mode==='highpass'?'highpass':'lowpass',volume:clamp(Number.isFinite(value.volume)?value.volume:1)};}
 function effectiveCutoff(p,xy={},age=0){const x=pad(xy),sweep=p.toneDecay>0?Math.pow(p.toneSustain,clamp(age/p.toneDecay)):1;return clamp(p.cutoff*sweep*Math.pow(x.mode==='lowpass'?.025:3,x.amount),40,18000);}
 function traits(value,xy={},age=0){
  const p=patch(value),x=pad(xy),bright=clamp(Math.log(effectiveCutoff(p,x,age)/80)/Math.log(16000/80));
  const edge=({sine:0,triangle:.28,sawtooth:1,square:.8}[p.wave]+p.harmonic*.5)/(1+p.harmonic),snap=1-clamp(p.attack/.5),tail=clamp(p.release/1.5),q=p.resonance/12,body=p.sustain;
  const raw={fire:.04+edge*bright*(.35+.65*snap)*(.6+.4*q),water:.04+(1-edge)*(.25+.75*tail)*(.4+.6*body)*(1-.45*bright),wind:.04+bright*(1-body)*(.3+.7*snap)*(.4+.6*q),earth:.04+(1-bright)*body*(.35+.65*snap)*(.45+.55*(1-edge))};
  const sum=Object.values(raw).reduce((a,b)=>a+b,0);return Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,v/sum]));
 }
 function cleanSnapshot(value,voice='lead'){
  if(!value||value.version!==1||!Array.isArray(value.events)||value.events.length>8192)throw Error('シンセ履歴が不正です。');
  const check=p=>{if(p)p={harmonic:0,toneDecay:0,toneSustain:1,curve:'linear',...p};if(!p||!waves.includes(p.wave)||!['linear','exponential'].includes(p.curve)||Object.entries(ranges).some(([k,[lo,hi]])=>!Number.isFinite(p[k])||p[k]<lo||p[k]>hi))throw Error('シンセ音色が不正です。');return patch(p,voice);};
  let previous=-Infinity;
  return {version:1,patch:check(value.patch),events:value.events.map(e=>{
   if(!e||!Number.isFinite(e.t)||e.t<-30||e.t>120||e.t<previous||!e.pad||!Number.isFinite(e.pad.amount)||e.pad.amount<0||e.pad.amount>1||!Number.isFinite(e.pad.volume)||e.pad.volume<0||e.pad.volume>1||!['lowpass','highpass'].includes(e.pad.mode))throw Error('シンセ操作履歴が不正です。');
   previous=e.t;return {t:e.t,patch:check(e.patch),pad:pad(e.pad)};
  })};
 }
 function at(snapshot,t){let result={patch:snapshot.patch,pad:pad()};for(const e of snapshot.events){if(e.t>t)break;result=e;}return result;}
 const envelopeChanged=(a,b)=>['attack','decay','sustain','curve'].some(k=>a[k]!==b[k]);
 function curveValue(points,time){let prev=points[0];for(const point of points){if(time<point.t){const span=point.t-prev.t;if(!span)return point.v;const f=clamp((time-prev.t)/span);return point.curve==='exponential'&&prev.v>0&&point.v>0?prev.v*Math.pow(point.v/prev.v,f):prev.v+(point.v-prev.v)*f;}prev=point;}return prev.v;}
 function gateEnvelope(snapshot,start,end){
  let p=at(snapshot,start).patch,points=[{t:start,v:p.curve==='exponential'?1/120:0},{t:start+p.attack,v:1,curve:p.curve},{t:start+p.attack+p.decay,v:p.sustain,curve:p.curve}];
  for(const e of snapshot.events){if(e.t<=start)continue;if(e.t>end)break;if(envelopeChanged(p,e.patch)){const v=curveValue(points,e.t),remaining=Math.max(0,e.patch.attack-(e.t-start));points=points.filter(v=>v.t<e.t);points.push({t:e.t,v});if(remaining)points.push({t:e.t+remaining,v:1,curve:e.patch.curve});points.push({t:e.t+remaining+e.patch.decay,v:e.patch.sustain,curve:e.patch.curve});}p=e.patch;}
  return points;
 }
 function monoNotes(notes){const ordered=notes.map(n=>({...n})).sort((a,b)=>(a.rawT??a.t)-(b.rawT??b.t));return ordered.map((n,i)=>({...n,duration:Math.max(0,Math.min(n.duration??.17,(ordered[i+1]?.rawT??ordered[i+1]?.t??Infinity)-(n.rawT??n.t)))})).filter(n=>n.duration>0);}
 function profile(snapshot,notes,duration){
  const result={fire:0,water:0,wind:0,earth:0};if(!snapshot||!notes.length)return result;
  // Integrate the last-note-priority monophonic gates used by the audio engine.
  const spans=monoNotes(notes).map(n=>{const start=n.rawT??n.t,end=start+(n.duration??.17);return {start,end,curve:gateEnvelope(snapshot,start,end)};});
  const cuts=[...new Set([0,duration,...spans.flatMap(n=>[n.start,n.end,...n.curve.map(p=>p.t)]),...snapshot.events.map(e=>e.t)].map(t=>clamp(t,0,duration)))].sort((a,b)=>a-b);
  let audible=0;
  for(let i=0;i<cuts.length-1;i++){const t=(cuts[i]+cuts[i+1])/2,amplitude=Math.max(0,...spans.filter(n=>t>=n.start&&t<n.end).map(n=>curveValue(n.curve,t)));if(!amplitude)continue;const e=at(snapshot,t),w=(cuts[i+1]-cuts[i])*e.pad.volume*amplitude,v=traits(e.patch,e.pad,Math.max(0,t-spans.filter(n=>t>=n.start&&t<n.end).at(-1).start));audible+=w;for(const key in result)result[key]+=v[key]*w;}
  if(audible)for(const key in result)result[key]/=audible;
  return result;
 }
 function modifiers(s){return {attack:1+.2*s.fire-.12*s.water-.10*s.earth,shield:1+.35*s.earth-.22*s.fire-.12*s.wind,accuracy:.06*s.wind-.025*s.earth,weaken:.08*s.water};}
 const labels={fire:'炎',water:'水',wind:'風',earth:'土'};
 function combine(bass,lead){const a=modifiers(bass),b=modifiers(lead);return {attack:1+((a.attack-1)+(b.attack-1))*.5,accuracy:(a.accuracy+b.accuracy)*.5,weaken:Math.min(.12,a.weaken+b.weaken)};}
 function describe(s){const m=modifiers(s);return Object.entries(s).map(([k,v])=>labels[k]+Math.round(v*100)+'%').join(' / ')+` → 攻撃 ×${m.attack.toFixed(2)}・盾 ×${m.shield.toFixed(2)}・命中 ${m.accuracy>=0?'+':''}${(m.accuracy*100).toFixed(1)}pt・湿潤 敵攻撃 −${(m.weaken*100).toFixed(1)}%`;}
 const settings={bass:patch({},'bass'),lead:patch({},'lead')},pads={bass:pad(),lead:pad()},listeners=new Set();
 let persistent=true;
 try{const data=JSON.parse(root.localStorage?.getItem('ridumu.synth.v1')??'null');for(const voice of voices)if(data?.[voice]){const saved=data[voice],oldLead={wave:'triangle',cutoff:3600,resonance:.8,attack:.008,decay:.08,sustain:.65,release:.18};const wasDefault=voice==='lead'&&saved.harmonic===undefined&&Object.entries(oldLead).every(([k,v])=>saved[k]===v);settings[voice]=wasDefault?patch({},voice):patch({harmonic:0,toneDecay:0,toneSustain:1,curve:'linear',...saved},voice);}}catch{persistent=false;}
 function emit(voice){for(const fn of listeners)fn(voice);}
 function setPatch(voice,value){if(!voices.includes(voice))return;settings[voice]=patch({...settings[voice],...value},voice);try{if(!root.localStorage)throw Error();root.localStorage.setItem('ridumu.synth.v1',JSON.stringify(settings));persistent=true;}catch{persistent=false;}emit(voice);}
 function setPad(voice,value){if(!voices.includes(voice))return;pads[voice]=pad(value);emit(voice);}
 const current=voice=>({patch:{...settings[voice]},pad:{...pads[voice]}});
 function engine(...args){if(!root.SynthAudio&&typeof require==='function')root.SynthAudio=require('./synth-audio.js');return root.SynthAudio.get(...args);}
 const api={voices,waves,ranges,defaults,patch,pad,effectiveCutoff,traits,cleanSnapshot,at,monoNotes,profile,modifiers,combine,describe,envelopeChanged,labels,setPatch,setPad,current,engine,subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);},get persistent(){return persistent;}};
 root.Synth=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
