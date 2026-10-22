const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const S=require('./synth.js'),H=require('./sequence-history.js');
const snapshot=(p=S.patch(),events=[])=>({version:1,patch:p,events});
const point=(t,p,xy={})=>({t,patch:p,pad:S.pad(xy)});

test('factory presets are complete, distinct and apply independently without changing the catalog',()=>{
 const original=JSON.stringify(S.factoryPresets),lead=S.current('lead').patch;
 for(const voice of S.voices){
  const items=S.factoryPresets[voice];assert.equal(items.length,6);assert.equal(new Set(items.map(p=>JSON.stringify(p.patch))).size,6);
  for(const item of items){assert.ok(item.description.length>8);assert.deepEqual(S.cleanSnapshot(snapshot(item.patch),voice).patch,item.patch);}
 }
 assert.equal(S.applyPreset('bass','warm-analog'),true);assert.equal(S.current('bass').patch.detune,7);assert.equal(S.current('bass').patch.sub,.35);assert.deepEqual(S.current('lead').patch,lead);
 const before=S.current('bass').patch;assert.equal(S.applyPreset('bass','missing'),false);assert.deepEqual(S.current('bass').patch,before);
 S.setPatch('bass',{sub:.6,detune:20});assert.equal(JSON.stringify(S.factoryPresets),original);
 S.setPatch('bass',S.defaults.bass);
});

test('new layer parameters survive snapshots and old recordings restore with both layers disabled',()=>{
 const p=S.patch({sub:.4,detune:16}),data=snapshot(p,[point(.2,{...p,sub:.2,detune:7})]);
 const saved=S.cleanSnapshot(JSON.parse(JSON.stringify(data)));assert.equal(saved.patch.sub,.4);assert.equal(saved.events[0].patch.detune,7);
 const old={...p};delete old.sub;delete old.detune;const legacy=S.cleanSnapshot(snapshot(old));assert.equal(legacy.patch.sub,0);assert.equal(legacy.patch.detune,0);
 for(const patch of [{...p,sub:Infinity},{...p,detune:31}])assert.throws(()=>S.cleanSnapshot(snapshot(patch)));
});

test('advanced oscillators, modulation and Drive survive automation; legacy recordings disable them',()=>{
 const p=S.patch({osc2Wave:'square',osc2Mix:.6,osc2Tune:-12,osc2Fine:9,lfoRate:5,lfoPitch:12,lfoFilter:800,drive:.4});
 const saved=S.cleanSnapshot(snapshot(p,[point(.3,{...p,osc2Wave:'sine',osc2Tune:7,lfoFilter:1200,drive:.8})]));
 assert.deepEqual(saved.patch,p);assert.equal(saved.events[0].patch.osc2Wave,'sine');assert.equal(saved.events[0].patch.drive,.8);
 const legacy={...p};for(const key of ['osc2Wave','osc2Mix','osc2Tune','osc2Fine','lfoRate','lfoPitch','lfoFilter','drive'])delete legacy[key];
 const restored=S.cleanSnapshot(snapshot(legacy));for(const key of ['osc2Mix','lfoPitch','lfoFilter','drive'])assert.equal(restored.patch[key],0);
 for(const value of [{...p,osc2Wave:'noise'},{...p,lfoRate:0},{...p,lfoFilter:Infinity},{...p,drive:2}])assert.throws(()=>S.cleanSnapshot(snapshot(value)));
});

test('combat guidance uses the actual style calculation and counts each part at its real weight',()=>{
 const p=S.patch({attack:.003,release:.6}),bpm=78,beat=60/bpm;
 for(const voice of S.voices){const guide=S.combatGuide(p,voice,bpm);for(const [i,gate] of [.25,1.5].entries()){
  const actual=S.style(snapshot(p),[{t:0,duration:beat*gate}],beat*8);
  assert.equal(guide[i].attack,S.percent((actual.attack-1)*.5));assert.equal(guide[i].shield,S.percent((actual.shield-1)*(voice==='bass'?1:.5)));
  assert.match(S.combatText(actual,voice),/攻撃への寄与/);
 }}
 const soundOnly={...p,osc2Mix:1,osc2Wave:'square',sub:.7,detune:25,cutoff:100,drive:1,lfoPitch:70,lfoFilter:2400};
 assert.deepEqual(S.combatGuide(soundOnly,'bass',bpm),S.combatGuide(p,'bass',bpm));
 assert.notDeepEqual(S.combatGuide({...p,attack:1,release:.02},'bass',bpm),S.combatGuide(p,'bass',bpm));
});
test('traits are deterministic, normalized and require combinations of timbre features',()=>{
 const p=S.patch({wave:'sawtooth',cutoff:12000,attack:.005,sustain:.3});
 assert.deepEqual(S.traits(p),S.traits({...p}));
 assert(Math.abs(Object.values(S.traits(p)).reduce((a,b)=>a+b,0)-1)<1e-12);
 const dark=S.traits({...p,cutoff:100});assert(S.traits(p).fire>dark.fire);
 const slow=S.traits({...p,attack:2});assert(S.traits(p).fire>slow.fire);
 const round=S.traits({...p,wave:'sine',release:2});assert(round.water>S.traits(p).water);
 assert(S.traits(S.patch({cutoff:100,sustain:1,wave:'triangle'})).earth>dark.wind);
});
test('timbre is element-neutral and articulation changes play style',()=>{
 const fire={fire:1,water:0,wind:0,earth:0};
 assert.deepEqual(S.modifiers(fire),{attack:1,shield:1,accuracy:0,weaken:0});
 const fast=S.patch({attack:.003,release:.02}),slow=S.patch({attack:.3,release:1});
 const short=[{t:0,duration:.08},{t:.5,duration:.08},{t:1,duration:.08}];
 const long=[{t:0,duration:.9},{t:1,duration:.9},{t:2,duration:.9}];
 const quick=S.style(snapshot(fast),short,4),sustained=S.style(snapshot(slow),long,4);
 assert(quick.attack>1&&quick.shield<1);
 assert(sustained.shield>1&&sustained.attack<1);
 assert.deepEqual(S.style(snapshot(fast),[],4),{attack:1,shield:1,accuracy:0,weaken:0});
 assert.equal(S.style(snapshot(fast),short,4).attack,S.style(snapshot(fast),short,4).attack);
});
test('profile integrates recorded changes over audible gates without duplicate-note bonuses',()=>{
 const a=S.patch({wave:'sine',cutoff:200,release:2,attack:.01,decay:.1,sustain:1,harmonic:0,toneDecay:0,curve:'linear'}),b=S.patch({...a,wave:'sawtooth',cutoff:14000,release:.02});
 const data=snapshot(a,[point(0,a),point(1,b)]),notes=[{t:0,duration:2}];
 const p=S.profile(data,notes,2),left=S.traits(a),right=S.traits(b);
 for(const k in p)assert(Math.abs(p[k]-(left[k]*.995+right[k])/1.995)<1e-10);
 assert.deepEqual(p,S.profile(data,[...notes,...notes],2));
 const percussive={...a,sustain:0,decay:.02};const early=snapshot(percussive,[point(0,percussive),point(1,{...percussive,wave:'square'})]);for(const k in p)assert(Math.abs(S.profile(early,notes,2)[k]-S.traits(percussive)[k])<1e-10);
 const silent=snapshot(a,[point(0,a,{volume:0}),point(1,b)]);
 for(const k in right)assert(Math.abs(S.profile(silent,notes,2)[k]-right[k])<1e-10);
 assert.deepEqual(S.profile(snapshot(a,[point(0,a,{volume:0})]),notes,2),{fire:0,water:0,wind:0,earth:0});
});
test('pad cutoff and attributes return to the configured patch at neutral',()=>{
 const p=S.patch({cutoff:3000});assert.equal(S.effectiveCutoff(p),3000);
 assert(S.effectiveCutoff(p,{amount:1})<3000);assert(S.effectiveCutoff(p,{amount:1,mode:'highpass'})>3000);
 assert.notDeepEqual(S.traits(p),S.traits(p,{amount:1}));assert.deepEqual(S.traits(p),S.traits(p,{amount:0,volume:1}));
});
test('bass and lead settings persist independently and malformed storage falls back safely',()=>{
 let saved;const box=vm.createContext({localStorage:{getItem:()=>saved??'{broken',setItem:(key,value)=>saved=value}});vm.runInContext(fs.readFileSync('synth.js','utf8'),box);
 const synth=box.Synth,lead={...synth.current('lead').patch};synth.setPatch('bass',{cutoff:2100,wave:'square',sub:.3,detune:11});
 assert.deepEqual({...synth.current('lead').patch},lead);assert.equal(synth.current('bass').patch.cutoff,2100);
 const restored=vm.createContext({localStorage:{getItem:()=>saved}});vm.runInContext(fs.readFileSync('synth.js','utf8'),restored);assert.equal(restored.Synth.current('bass').patch.wave,'square');assert.equal(restored.Synth.current('bass').patch.sub,.3);assert.equal(restored.Synth.current('bass').patch.detune,11);
});
test('history JSON round-trips full per-part patches and automation without aliasing live settings',()=>{
 const p=S.patch({wave:'square',sub:.4,detune:12}),data=snapshot(p,[point(0,p),point(.5,{...p,cutoff:300,detune:18},{amount:.7,volume:.4})]);
 const entry=H.snapshot({bpm:120,duration:4,tracks:[{voice:'bass',notes:[{type:'kick',t:0,duration:1,midi:36}],synth:data},{voice:'drums',notes:[{type:'snare',t:1}],effects:[{t:0,amount:0,mode:'lowpass',volume:1},{t:.8,amount:.4,mode:'highpass',volume:.3}]}]});
 const restored=H.validate(JSON.parse(JSON.stringify(entry)));assert.deepEqual(restored.tracks,entry.tracks);
 data.events[1].patch.cutoff=16000;assert.equal(restored.tracks[0].synth.events[1].patch.cutoff,300);
 S.setPatch('bass',{wave:'sine'});assert.equal(restored.tracks[0].synth.patch.wave,'square');
 assert.equal(H.validate({...entry,tracks:[{voice:'bass',notes:[{type:'kick',t:0}]}]}).tracks[0].synth,undefined);
 for(const corrupt of [{...data,events:[point(2,p),point(1,p)]},{...data,patch:{...p,wave:'invalid'}},{...data,events:[{...point(0,p),pad:{volume:9,mode:'lowpass',amount:0}}]}])assert.throws(()=>H.validate({...entry,tracks:[{...entry.tracks[0],synth:corrupt}]}));
 assert.throws(()=>H.validate({...entry,tracks:[{...entry.tracks[1],effects:[{t:0,mode:'lowpass',amount:NaN,volume:1}]}]}));
});
test('recorded audio schedules waveform/cutoff/volume changes at the audio clock and releases from its current envelope',()=>{
 const calls=[],stops=[],param=()=>({value:0,setValueAtTime(v,t){calls.push(['set',v,t])},exponentialRampToValueAtTime(v,t){calls.push(['exp',v,t])},linearRampToValueAtTime(v,t){calls.push(['ramp',v,t])},setTargetAtTime(v,t){calls.push(['target',v,t])},cancelScheduledValues(t){calls.push(['cancel',t])}});
 const node=()=>({gain:param(),frequency:param(),Q:param(),connect(){},disconnect(){}});
 const ctx={currentTime:0,destination:{},createGain:node,createBiquadFilter:node,createDynamicsCompressor:()=>({...node(),threshold:{},ratio:{},knee:{}}),createOscillator:()=>({...node(),start(){},stop(t){stops.push(t)}})};
 const p=S.patch({attack:1,decay:.5,sustain:.5,release:.3,curve:'linear'}),data=snapshot(p,[point(0,p),point(.1,{...p,wave:'square',cutoff:500},{volume:.4})]);
 S.engine(ctx).play('lead',440,2,1,.2,{snapshot:data,noteTime:0});
 assert(calls.some(c=>c[0]==='target'&&c[1]===.4&&c[2]===2.1));assert(calls.some(c=>c[0]==='target'&&c[1]===1&&c[2]===2.1));
 // Releasing during attack starts at the actual envelope, never the full sustain.
 assert(calls.some(c=>c[0]==='set'&&Math.abs(c[1]-.024)<1e-9&&c[2]===2.2));assert.equal(stops.length,15);assert(Math.abs(stops[0]-2.525)<1e-9);
});

test('monophonic gates use last-note priority, including same-time notes, without mutating the source',()=>{
 const notes=[{t:0,duration:3,midi:36},{t:1,duration:.2,midi:40},{t:1,duration:.5,midi:43},{t:2,duration:1,midi:48}];
 const mono=S.monoNotes(notes);assert.deepEqual(mono.map(n=>[n.t,n.duration,n.midi]),[[0,1,36],[1,.5,43],[2,1,48]]);assert.equal(notes[0].duration,3);
 const raw=S.monoNotes([{t:.25,rawT:.1,duration:1},{t:.5,rawT:.3,duration:1}]);assert(Math.abs(raw[0].duration-.2)<1e-10);
});
test('scheduled monophonic note stealing cuts only its own part at note onset and survives release or automation',()=>{
 const nodes=[],oscillators=[];
 const param=()=>({value:0,calls:[],setValueAtTime(v,t){this.calls.push(['set',v,t])},exponentialRampToValueAtTime(v,t){this.calls.push(['exp',v,t])},linearRampToValueAtTime(v,t){this.calls.push(['ramp',v,t])},setTargetAtTime(v,t){this.calls.push(['target',v,t])},cancelScheduledValues(t){this.calls.push(['cancel',t])}});
 const node=()=>{const n={gain:param(),frequency:param(),Q:param(),connect(){},disconnect(){}};nodes.push(n);return n;};
 const ctx={currentTime:0,destination:{},createGain:node,createBiquadFilter:node,createDynamicsCompressor:()=>({...node(),threshold:{},ratio:{},knee:{}}),createOscillator:()=>{const n={...node(),start(){},stops:[],stop(t){this.stops.push(t)}};oscillators.push(n);return n;}};
 const engine=S.engine(ctx),first=engine.play('bass',110,1,1,Infinity),lead=engine.play('lead',440,1,1,Infinity);
 const before=nodes.length;engine.play('bass',220,2,1,Infinity);
 assert(oscillators.slice(0,15).every(o=>o.stops.at(-1)===2.025));assert(oscillators.slice(15,30).every(o=>!o.stops.length));
 const gate=nodes.slice(0,before).find(n=>n.gain.calls.some(c=>c[0]==='ramp'&&c[1]===0&&c[2]===2));assert(gate);assert(gate.gain.calls.some(c=>c[0]==='set'&&c[1]===1&&c[2]===1.997));
 first.release(2.5);assert(oscillators.slice(0,15).every(o=>o.stops.at(-1)<=2.025));
 S.setPad('bass',{amount:.7,volume:1});assert.equal(gate.gain.calls.at(-1)[1],0);
 lead.release(3);assert(oscillators.slice(15,30).every(o=>o.stops.length));
});


test('classic lead defaults restore its octave layer, filter sweep and exponential ADSR',()=>{
 const p=S.patch({},'lead');assert.equal(p.wave,'triangle');assert.equal(p.harmonic,.18);assert.equal(p.curve,'exponential');assert.equal(p.attack,.008);assert(Math.abs(p.attack+p.decay-.08)<1e-12);assert.equal(p.release,.12);
 assert.equal(S.effectiveCutoff(p,{},0),3600);assert.equal(S.effectiveCutoff(p,{},.12),1800);assert.equal(S.effectiveCutoff(p,{},2),1800);
 const copy=S.cleanSnapshot(snapshot(p,[point(0,p),point(.2,{...p,harmonic:.4,toneDecay:.4,toneSustain:.3})]),'lead');assert.equal(copy.events[1].patch.harmonic,.4);assert.equal(copy.events[1].patch.toneSustain,.3);
 const old={wave:'triangle',cutoff:3600,resonance:.8,attack:.008,decay:.08,sustain:.65,release:.18};const restored=S.cleanSnapshot(snapshot(old),'lead');assert.equal(restored.patch.harmonic,0);assert.equal(restored.patch.toneDecay,0);assert.equal(restored.patch.curve,'linear');
 assert.throws(()=>S.cleanSnapshot(snapshot({...p,harmonic:1}),'lead'));
});
test('previous unchanged lead defaults migrate while custom sounds remain intact',()=>{
 const old={wave:'triangle',cutoff:3600,resonance:.8,attack:.008,decay:.08,sustain:.65,release:.18};
 function load(value){const box=vm.createContext({localStorage:{getItem:()=>JSON.stringify({lead:value})}});vm.runInContext(fs.readFileSync('synth.js','utf8'),box);return box.Synth.current('lead').patch;}
 assert.equal(load(old).harmonic,.18);assert.equal(load(old).decay,.072);
 const custom=load({...old,cutoff:2100});assert.equal(custom.cutoff,2100);assert.equal(custom.harmonic,0);assert.equal(custom.curve,'linear');
});
