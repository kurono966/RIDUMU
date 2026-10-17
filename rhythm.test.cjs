const {test}=require('node:test');const assert=require('node:assert/strict');const R=require('./rhythm.js');
const notes=(times,type)=>times.map(t=>({t,type}));

test('calculation details match deterministic hits and contain no random rolls',()=>{
 const a=R.analyze(notes([0,.15,.35,.7,1.1,1.7,2.4,3.1],'snare'));
 const result=R.resolve(a,{kind:'machine'},()=>{throw Error('random must never be called')});
 const c=result.calculation;
 assert.deepEqual(c.hitDetails.map(h=>h.damage),result.damages);assert.equal(c.hitDetails.reduce((sum,h)=>sum+h.damage,0),result.total);
 for(const h of c.hitDetails)assert.equal(h.damage,Math.max(1,Math.round(c.power/c.divisor*c.affinity*c.accuracyMultiplier*c.stabilityMultiplier)));
 assert.ok(Math.abs(c.affinitySteps.reduce((value,s)=>value*s.multiplier,1)-c.affinity)<1e-10);
 assert.doesNotMatch(JSON.stringify(c),/variation|roll/);
});
test('identical analysis and enemy always produce identical complete results without Math.random',()=>{
 const patterns=[[],notes([1.3,3.2],'kick'),notes(Array.from({length:28},(_,i)=>i*.14),'snare'),[.03,.29,.32,.8,1.7,2.1,3.8].map((t,i)=>({t,type:i%2?'kick':'snare'}))];
 const random=Math.random;Math.random=()=>{throw Error('combat cannot use randomness')};
 try{for(const kind of ['stone','fly','machine','plant','ghost','crystal'])for(const pattern of patterns){
  const a=R.analyze(pattern),snapshot=JSON.stringify(a),first=R.resolve(a,{kind});
  for(let i=0;i<20;i++)assert.deepEqual(R.resolve(a,{kind}),first);
  assert.equal(JSON.stringify(a),snapshot);assert.equal(first.damages.length,a.count?a.hits:0);assert.ok(new Set(first.damages).size<=1);
 }}finally{Math.random=random;}
});
test('accuracy and instability are fixed efficiency penalties rather than misses',()=>{
 const a={...R.analyze(notes([0,.25,.5,.75,1,1.25,1.5,1.75],'snare')),accuracy:1,instability:0};
 const full=R.resolve(a,{kind:'machine'}),lowAim=R.resolve({...a,accuracy:.5},{kind:'machine'}),unstable=R.resolve({...a,instability:.55},{kind:'machine'});
 assert.ok(lowAim.total<full.total);assert.ok(unstable.total<full.total);
 assert.equal(lowAim.damages.length,full.damages.length);assert.ok(lowAim.damages.every(d=>d>0));
 assert.equal(lowAim.accuracyMultiplier,.5);assert.equal(unstable.stabilityMultiplier,1-.3*.55);
 const zero=R.resolve({...a,accuracy:0},{kind:'machine'});assert.equal(zero.total,0);assert.equal(zero.damages.length,a.hits);
});
test('groove, zone, Lead and ensemble modifiers remain deterministic together',()=>{
 const G=require('./groove.js'),C=require('./performance-combat.js'),E=require('./ensemble.js');
 const drums=[0,1,2].map(t=>({type:'kick',t,rawT:t})),bass=drums.map(n=>({...n,duration:.5,midi:36})),lead=[0,.6,1.2].map((t,i)=>({type:'snare',t,rawT:t,midi:60+i*3,duration:.2}));
 const hat=Array.from({length:8},(_,i)=>({type:'hat',t:i*.5,rawT:i*.5}));
 const ensemble=E.analyze({drums,bass,lead}),support=E.support(C.lead(lead,120,4,[]),ensemble);
 const base=G.enrich(R.analyze(drums),G.analyzeRelations(drums,hat,120,4));
 const a=E.attack(C.enhance(base,drums,120,[{type:'power',slots:[0,8,16]}],support),ensemble);
 assert.equal(a.powerHits,3);assert.ok(ensemble.selected.length>0);assert.ok(a.power>base.power);
 const snapshot=JSON.stringify(a),result=R.resolve(a,{kind:'stone'});
 for(let i=0;i<50;i++)assert.deepEqual(R.resolve(a,{kind:'stone'}),result);
 assert.equal(JSON.stringify(a),snapshot);assert.equal(result.calculation.powerSteps.length,4);
 assert.equal(result.calculation.hitDetails.length,a.hits);
});

test('silence does no damage and features remain finite',()=>{const a=R.analyze([]);assert.equal(R.resolve(a,{kind:'stone'},()=>0).total,0);for(const v of Object.values(a))if(typeof v==='number')assert.ok(Number.isFinite(v));});
test('sparse kick is heavy, rapid snare is multi hit',()=>{const heavy=R.analyze(notes([1.3,3.2],'kick')),fast=R.analyze(notes(Array.from({length:28},(_,i)=>i*.14),'snare'));assert.equal(heavy.element,'earth');assert.equal(fast.element,'wind');assert.ok(heavy.weight>fast.weight);assert.ok(fast.hits>heavy.hits);assert.ok(heavy.power/heavy.hits>fast.power/fast.hits);});
test('late acceleration creates fire, irregular offbeats create lightning',()=>{assert.equal(R.analyze(notes([.1,2.1,2.25,2.4,2.55,2.7,2.85,3,3.15,3.3,3.45,3.6,3.75],'kick')).element,'fire');assert.equal(R.analyze([.125,.38,1.12,1.36,2.87,3.13].map((t,i)=>({t,type:i%2?'snare':'kick'}))).element,'lightning');});
test('regular alternation repeats and raw timing survives grid analysis',()=>{const a=R.analyze(Array.from({length:16},(_,i)=>({t:i*.25+.013,type:i%2?'snare':'kick'})));assert.ok(a.regularity>.99);assert.equal(a.alternation,1);assert.equal(a.repetition,1);assert.equal(a.grid[0].t,.013);assert.equal(a.grid[0].q,0);});
test('enemy traits change damage and accuracy',()=>{const a=R.analyze(notes([1.3,3.2],'kick'));assert.ok(R.resolve(a,{kind:'stone'},()=>0).total>R.resolve(a,{kind:'fly'},()=>0).total);assert.ok(R.resolve(a,{kind:'fly'},()=>0).accuracy<a.accuracy);});
test('simultaneous input and boundary notes are safe',()=>{const a=R.analyze([{t:0,type:'kick'},{t:0,type:'snare'},{t:3.99,type:'snare'},{t:4,type:'kick'}]);assert.equal(a.count,3);assert.ok(a.grid.every(n=>n.q>=0&&n.q<32));assert.ok(Number.isFinite(a.accuracy));});
test('attack replay keeps raw spacing including the last count-in beat',()=>{
 const timeline=R.attackTimeline([{type:'kick',t:0,rawT:-.5},{type:'snare',t:.13,rawT:.13},{type:'kick',t:2.7,rawT:2.7}],[12,7]);
 assert.deepEqual(timeline.events.map(n=>n.at),[0,.63,3.2]);
 assert.equal(timeline.duration,4.5);
 assert.deepEqual(timeline.events.map(n=>n.damages),[[12],[],[7]]);
});
test('playback preserves resolved damage without adding damage for extra notes',()=>{
 const timeline=R.attackTimeline(notes([0,.1,.3,.8,2,3.8],'snare'),[5,0,9]);
 assert.equal(timeline.events.flatMap(n=>n.damages).reduce((a,b)=>a+b,0),14);
 assert.equal(timeline.events.filter(n=>n.damages.length).length,3);
 assert.equal(timeline.events.length,6);
 assert.deepEqual(R.attackTimeline(notes([0,1,3],'kick'),[40]).events.map(n=>n.damages),[[],[],[40]]);
 assert.equal(R.attackTimeline([],[]).events.length,0);
});
test('layered replay aligns every part to the same clock and damages only the new part',()=>{
 const tracks=[{voice:'drums',notes:[{type:'kick',t:0,rawT:-.5},{type:'snare',t:1}]},{voice:'bass',notes:[{type:'kick',t:0},{type:'snare',t:2}]},{voice:'lead',notes:[{type:'snare',t:3}]}];
 const mix=R.mixTimeline(tracks,'lead',[30]);
 assert.equal(mix.offset,-.5);assert.equal(mix.duration,4.5);
 assert.deepEqual(mix.events.map(n=>n.at),[0,.5,1.5,2.5,3.5]);
 assert.equal(mix.events.filter(n=>n.damages.length).length,1);
 assert.equal(mix.events.at(-1).voice,'lead');assert.deepEqual(mix.events.at(-1).damages,[30]);
 assert.ok(R.mixTimeline(tracks,null).events.every(n=>n.damages.length===0));
});
