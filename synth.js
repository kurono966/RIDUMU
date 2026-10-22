/* Independent bass/lead patches, deterministic timbre traits, and local snapshots. */
(function(root){
 const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
 const voices=['bass','lead'],waves=['sine','triangle','sawtooth','square'];
 const ranges={cutoff:[80,16000],resonance:[0,12],attack:[.003,2],decay:[.01,2],sustain:[0,1],release:[.02,3],harmonic:[0,.5],toneDecay:[0,2],toneSustain:[.05,1],sub:[0,.7],detune:[0,30]};
 const defaults={bass:{wave:'triangle',cutoff:950,resonance:.7,attack:.009,decay:.09,sustain:.78,release:.12,harmonic:0,toneDecay:0,toneSustain:1,curve:'linear'},lead:{wave:'triangle',cutoff:3600,resonance:.8,attack:.008,decay:.072,sustain:.65,release:.12,harmonic:.18,toneDecay:.12,toneSustain:.5,curve:'exponential'}};
 const extended={osc2Mix:0,osc2Tune:0,osc2Fine:0,lfoRate:4,lfoPitch:0,lfoFilter:0,drive:0};
 Object.assign(ranges,{osc2Mix:[0,1],osc2Tune:[-24,24],osc2Fine:[-50,50],lfoRate:[.1,12],lfoPitch:[0,70],lfoFilter:[0,2400],drive:[0,1]});
 for(const voice of voices)Object.assign(defaults[voice],{sub:0,detune:0,osc2Wave:'sawtooth',...extended});
 function patch(value={},voice='lead'){
  const base=defaults[voice]??defaults.lead,result={wave:waves.includes(value.wave)?value.wave:base.wave,osc2Wave:waves.includes(value.osc2Wave)?value.osc2Wave:base.osc2Wave,curve:['linear','exponential'].includes(value.curve)?value.curve:base.curve};
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
  const check=p=>{if(p)p={harmonic:0,toneDecay:0,toneSustain:1,curve:'linear',sub:0,detune:0,osc2Wave:'sawtooth',...extended,...p};if(!p||!waves.includes(p.wave)||!waves.includes(p.osc2Wave)||!['linear','exponential'].includes(p.curve)||Object.entries(ranges).some(([k,[lo,hi]])=>!Number.isFinite(p[k])||p[k]<lo||p[k]>hi))throw Error('シンセ音色が不正です。');return patch(p,voice);};
  let previous=-Infinity;
  return {version:1,patch:check(value.patch),events:value.events.map(e=>{
   if(!e||!Number.isFinite(e.t)||e.t<-30||e.t>120||e.t<previous||!e.pad||!Number.isFinite(e.pad.amount)||e.pad.amount<0||e.pad.amount>1||!Number.isFinite(e.pad.volume)||e.pad.volume<0||e.pad.volume>1||!['lowpass','highpass'].includes(e.pad.mode))throw Error('シンセ操作履歴が不正です。');
   previous=e.t;return {t:e.t,patch:check(e.patch),pad:pad(e.pad)};
  })};
 }
 function at(snapshot,t){let result={patch:snapshot.patch,pad:pad()};for(const e of snapshot.events){if(e.t>t)break;result=e;}return result;}
 // Quantization moves the note, not the point in its recorded timbre automation.
 function noteTime(note){return typeof note==='number'?note:note.inputT??note.time??note.rawT??note.t;}
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
 function modifiers(s){return {attack:1,shield:1,accuracy:0,weaken:0};}
 function style(snapshot,notes,duration){
  const neutral={attack:1,shield:1,accuracy:0,weaken:0};
  if(!snapshot||!notes?.length||!duration)return neutral;
  const performed=monoNotes(notes).filter(n=>Number.isFinite(n.duration)&&n.duration>0);
  if(!performed.length)return neutral;
  const beat=duration/8;
  const avg=performed.reduce((sum,n)=>sum+Math.min(n.duration,beat*2),0)/performed.length;
  const short=clamp((beat*.75-avg)/(beat*.6)),long=clamp((avg-beat*.75)/(beat));
  const p=at(snapshot,Math.max(0,performed[0].rawT??performed[0].t??0)).patch;
  const crisp=1-clamp(p.attack/(beat*.7)),smooth=clamp((p.release+avg)/(beat*2));
  const shortFit=short*crisp,longFit=long*smooth;
  return {attack:1+.06*shortFit-.035*longFit,shield:1+.06*longFit-.035*shortFit,accuracy:0,weaken:0};
 }
 const labels={fire:'炎',water:'水',wind:'風',earth:'土'};
 function combine(bass,lead){const a=modifiers(bass),b=modifiers(lead);return {attack:1+((a.attack-1)+(b.attack-1))*.5,accuracy:(a.accuracy+b.accuracy)*.5,weaken:Math.min(.12,a.weaken+b.weaken)};}
 function describe(s){return '自由な音色（属性による強弱なし）。短音／長音の演奏との相性が戦闘スタイルに影響';}
 const percent=value=>{const n=Math.round(value*1000)/10;return (n>0?'+':'')+n.toFixed(1)+'%';};
 function combatGuide(value,voice,bpm=120){
  const beat=60/bpm,duration=beat*8,snapshot={version:1,patch:patch(value,voice),events:[]};
  return [{name:'短く刻む（0.25拍）',gate:.25},{name:'長く伸ばす（1.5拍）',gate:1.5}].map(example=>{
   const result=style(snapshot,[{t:0,duration:beat*example.gate}],duration);
   return {name:example.name,attack:percent((result.attack-1)*.5),shield:percent((result.shield-1)*(voice==='bass'?1:.5))};
  });
 }
 function combatText(result,voice){return `${voice.toUpperCase()}：攻撃への寄与 ${percent((result.attack-1)*.5)} / ${voice==='bass'?'Bass盾生成':'Bass元盾への支援'} ${percent((result.shield-1)*(voice==='bass'?1:.5))}`;}
 const settings={bass:patch({},'bass'),lead:patch({},'lead')},pads={bass:pad(),lead:pad()},listeners=new Set();
 let persistent=true;
 try{const data=JSON.parse(root.localStorage?.getItem('ridumu.synth.v1')??'null');for(const voice of voices)if(data?.[voice]){const saved=data[voice],oldLead={wave:'triangle',cutoff:3600,resonance:.8,attack:.008,decay:.08,sustain:.65,release:.18};const wasDefault=voice==='lead'&&saved.harmonic===undefined&&Object.entries(oldLead).every(([k,v])=>saved[k]===v);settings[voice]=wasDefault?patch({},voice):patch({harmonic:0,toneDecay:0,toneSustain:1,curve:'linear',...saved},voice);}}catch{persistent=false;}
 function emit(voice){for(const fn of listeners)fn(voice);}
 function setPatch(voice,value){if(!voices.includes(voice))return;settings[voice]=patch({...settings[voice],...value},voice);try{if(!root.localStorage)throw Error();root.localStorage.setItem('ridumu.synth.v1',JSON.stringify(settings));persistent=true;}catch{persistent=false;}emit(voice);}
 function setPad(voice,value){if(!voices.includes(voice))return;pads[voice]=pad(value);emit(voice);}
 const current=voice=>({patch:{...settings[voice]},pad:{...pads[voice]}});
 function engine(...args){if(!root.SynthAudio&&typeof require==='function')root.SynthAudio=require('./synth-audio.js');return root.SynthAudio.get(...args);}
 const preset=(voice,id,name,description,value)=>({id,name,description,patch:patch(value,voice)});
 const factoryPresets={
  bass:[
   preset('bass','deep-sub','Deep Sub / 深い低音','丸いSub。長めに伸ばしてKickの間を支える。',{wave:'sine',cutoff:480,attack:.012,decay:.18,sustain:.9,release:.16,harmonic:.08,sub:.35}),
   preset('bass','round-finger','Round Finger / 丸い芯','少しだけ倍音のある、短音にも長音にも使いやすい低音。',{wave:'triangle',cutoff:1800,resonance:.8,attack:.006,decay:.19,sustain:.57,release:.14,harmonic:.12,toneDecay:.16,toneSustain:.3,sub:.2}),
   preset('bass','pocket-pluck','Pocket Pluck / 短い刻み','弾いた瞬間に芯が出て素早く閉じる。細かいリズム向け。',{wave:'sawtooth',cutoff:2900,resonance:1.8,attack:.003,decay:.16,sustain:.22,release:.08,toneDecay:.14,toneSustain:.1,sub:.3}),
   preset('bass','warm-analog','Warm Analog / 太い持続','暗めのSawにわずかな揺らぎ。長音と後ノリ向け。',{wave:'sawtooth',cutoff:1200,resonance:1.1,attack:.015,decay:.2,sustain:.8,release:.22,sub:.35,detune:7}),
   preset('bass','rubber','Rubber / 弾むベース','共鳴するフィルターが素早く下がる、弾力のある音。',{wave:'square',cutoff:3800,resonance:3.2,attack:.004,decay:.22,sustain:.4,release:.12,toneDecay:.24,toneSustain:.07,sub:.15}),
   preset('bass','soft-drift','Soft Drift / 柔らかい揺れ','角を抑えたTriangle。ゆったりしたフレーズ向け。',{wave:'triangle',cutoff:1600,resonance:.5,attack:.055,decay:.3,sustain:.75,release:.38,harmonic:.07,sub:.15,detune:12})
  ],
  lead:[
   preset('lead','clear-pluck','Clear Pluck / 明瞭な刻み','速い立ち上がりと短い余韻。リズムの輪郭を出す。',{wave:'triangle',cutoff:6500,resonance:1.2,attack:.003,decay:.16,sustain:.22,release:.12,harmonic:.3,toneDecay:.2,toneSustain:.22,curve:'linear'}),
   preset('lead','velvet-keys','Velvet Keys / 柔らかい鍵盤','丸い音に薄いオクターブを重ねた、落ち着いた響き。',{wave:'sine',cutoff:4800,resonance:.5,attack:.009,decay:.3,sustain:.45,release:.38,harmonic:.35,toneDecay:.35,toneSustain:.55,curve:'linear'}),
   preset('lead','warm-solo','Warm Solo / 歌う旋律','伸ばして歌わせる温かいSaw。少しだけ厚みを加える。',{wave:'sawtooth',cutoff:2800,resonance:1,attack:.025,decay:.16,sustain:.76,release:.25,harmonic:.05,toneDecay:.25,toneSustain:.65,detune:6,curve:'linear'}),
   preset('lead','glass-bell','Glass Bell / 透き通る余韻','高い倍音と長めの減衰。間を空けた応答フレーズに。',{wave:'sine',cutoff:10000,resonance:.6,attack:.003,decay:.65,sustain:.09,release:.65,harmonic:.5,toneDecay:.5,toneSustain:.5,curve:'exponential'}),
   preset('lead','detuned-saw','Detuned Saw / 厚い響き','ずらしたSawを重ね、長音でも存在感のある音に。',{wave:'sawtooth',cutoff:4700,resonance:.8,attack:.018,decay:.2,sustain:.7,release:.32,harmonic:.08,toneDecay:.3,toneSustain:.7,detune:16,curve:'linear'}),
   preset('lead','hollow-square','Hollow Square / 抜ける四角波','空洞感のあるSquare。軽い刻みと跳ねるフレーズに。',{wave:'square',cutoff:3200,resonance:1.4,attack:.005,decay:.19,sustain:.42,release:.17,harmonic:.06,toneDecay:.2,toneSustain:.32,curve:'linear'})
  ]
 };
 for(const [voice,id,value] of [
  ['bass','warm-analog',{osc2Wave:'square',osc2Mix:.18,osc2Tune:-12,drive:.18}],
  ['bass','rubber',{drive:.25}],
  ['bass','soft-drift',{osc2Wave:'sine',osc2Mix:.2,osc2Fine:-9,lfoRate:.7,lfoFilter:160}],
  ['lead','warm-solo',{osc2Wave:'triangle',osc2Mix:.22,osc2Fine:-5,lfoRate:5.2,lfoPitch:8,drive:.12}],
  ['lead','glass-bell',{osc2Wave:'sine',osc2Mix:.12,osc2Tune:12,osc2Fine:13}],
  ['lead','detuned-saw',{osc2Wave:'square',osc2Mix:.18,osc2Fine:-8,lfoRate:.6,lfoFilter:120,drive:.12}]
 ])Object.assign(factoryPresets[voice].find(p=>p.id===id).patch,value);
 function applyPreset(voice,id){const selected=factoryPresets[voice]?.find(p=>p.id===id);if(!selected)return false;setPatch(voice,selected.patch);return true;}
 const api={voices,waves,ranges,defaults,factoryPresets,applyPreset,patch,pad,effectiveCutoff,traits,cleanSnapshot,at,noteTime,monoNotes,profile,modifiers,style,combine,describe,percent,combatGuide,combatText,envelopeChanged,labels,setPatch,setPad,current,engine,subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);},get persistent(){return persistent;}};
 root.Synth=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
