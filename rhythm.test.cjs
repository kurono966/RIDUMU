const {test}=require('node:test');const assert=require('node:assert/strict');const R=require('./rhythm.js');
const notes=(times,type)=>times.map(t=>({t,type}));

test('raw rhythmic consistency rewards regular playing and penalizes chaotic intervals independently of enemy affinity',()=>{
 const regular=R.analyze(notes([0,.5,1,1.5,2,2.5,3,3.5],'kick'));
 const chaotic=R.analyze(notes([.01,.04,.06,.51,.55,1.72,2.01,3.85],'kick'));
 assert.equal(regular.performanceQuality.multiplier,1.2);assert.ok(chaotic.performanceQuality.multiplier<.65);
 // Hold all other combat features constant to isolate the new performance layer.
 const common={...regular,power:60,hits:3,accuracy:.9};
 const good=R.resolve(common,{kind:'machine'}),bad=R.resolve({...common,performanceQuality:chaotic.performanceQuality},{kind:'machine'});
 assert.ok(good.total>bad.total*1.5);assert.equal(good.affinity,bad.affinity);
 assert.deepEqual(R.resolve(common,{kind:'machine'}),good);
});
test('repeated uneven motifs and consistent laid-back or drunk offsets count as skill',()=>{
 for(const offset of [q=>.035,q=>[.02,-.015,.04,-.01][q%4]]){
  const motif=[0,1,3,6,8,9,11,14,16,17,19,22,24,25,27,30];
  const a=R.analyze(motif.map(q=>({type:q%2?'snare':'kick',t:q*.125+offset(q)})));
  assert.ok(a.performanceQuality.multiplier>=1.1);assert.ok(a.performanceQuality.repetition>.9);
 }
});
test('sparse heavy attacks stay neutral while clustered spam cannot bypass low quality',()=>{
 assert.equal(R.analyze(notes([1.3,3.2],'kick')).performanceQuality.multiplier,1);
 const spam=R.analyze(notes([0,.001,.005,.008,.011,.017,.02,.027,.031,.039],'snare'));
 assert.ok(spam.performanceQuality.multiplier<.7);
});
test('playback quantization does not repair raw rhythmic quality, including merged notes',()=>{
 const Q=require('./quantize.js'),raw=notes([.01,.04,.06,.51,.55,1.72,2.01,3.85],'kick').map(n=>({...n,rawT:n.t,inputT:n.t,quantize:'just'}));
 const before=R.analyze(raw).performanceQuality,after=R.analyze(Q.render(raw,120,4)).performanceQuality;
 assert.deepEqual(after,before);assert.equal(after.count,raw.length);
});

test('matchup tuning raises effective attacks and lowers resisted attacks for every enemy',()=>{
 const base={...R.analyze(notes([0,1,2],'kick')),power:100,hits:1,accuracy:1};
 const cases=[
  ['stone',{element:'earth',weight:.95},{element:'wind',weight:.1}],
  ['fly',{element:'wind',density:6,weight:0},{element:'earth',density:.5,weight:.9}],
  ['machine',{element:'lightning'},{element:'earth'}],
  ['plant',{element:'fire'},{element:'wind'}],
  ['ghost',{element:'lightning'},{element:'earth'}],
  ['crystal',{element:'earth',alternation:1},{element:'lightning',alternation:0}]
 ];
 for(const [kind,good,bad] of cases){
  const effective=R.resolve({...base,...good},{kind}),weak=R.resolve({...base,...bad},{kind});
  const oldTotal=result=>Math.round(100*result.calculation.affinitySteps.slice(0,-1).reduce((v,s)=>v*s.multiplier,1)*result.efficiency);
  assert.ok(effective.total>oldTotal(effective),kind+' effective damage should increase');
  if(kind!=='machine')assert.ok(weak.total<oldTotal(weak),kind+' resisted damage should decrease');
  else assert.equal(weak.total,oldTotal(weak),'neutral attacks stay neutral');
  assert.ok(effective.total>weak.total);assert.deepEqual(R.resolve({...base,...good},{kind}),effective);
 }
});
test('stacked weaknesses stay capped and the contrast multiplier is visible in the ledger',()=>{
 const a={...R.analyze(notes([0,1,2],'kick')),element:'earth',weight:1,groove:{laidBack:1,pocket:1}};
 const result=R.resolve(a,{kind:'stone'});
 assert.equal(result.affinity,3);assert.equal(result.calculation.affinitySteps.at(-1).label,'相性メリハリ補正（有効↑・苦手↓）');
 assert.equal(result.breakdown.base+result.breakdown.form+result.breakdown.affinity,result.total);
});

test('calculation details match deterministic hits and contain no random rolls',()=>{
 const a=R.analyze(notes([0,.15,.35,.7,1.1,1.7,2.4,3.1],'snare'));
 const result=R.resolve(a,{kind:'machine'},()=>{throw Error('random must never be called')});
 const c=result.calculation;
 assert.deepEqual(c.hitDetails.map(h=>h.damage),result.damages);assert.equal(c.hitDetails.reduce((sum,h)=>sum+h.damage,0),result.total);
 for(const h of c.hitDetails)assert.equal(h.damage,Math.max(1,Math.round(c.power/c.divisor*c.affinity*c.efficiency)));
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

test('same pattern repeated at same timing yields high performanceQuality',()=>{
  const motif=[0,1,3,6,8,9,11,14];
  const repeated=[...motif.map(q=>({type:q%2?'snare':'kick',t:q*.125})),...motif.map(q=>({type:q%2?'snare':'kick',t:q*.125+2}))];
  const a=R.analyze(repeated);
  assert.ok(a.performanceQuality.multiplier>=1.1);
  assert.ok(a.performanceQuality.repetition>.8);
});

test('consistent laid-back repetition does not lower performanceQuality',()=>{
  const motif=[0,1,3,6,8,9,11,14];
  const laidback=motif.map(q=>({type:q%2?'snare':'kick',t:q*.125+.03}));
  const twice=[...laidback,...laidback.map(n=>({...n,t:n.t+2}))];
  const a=R.analyze(twice);
  assert.ok(a.performanceQuality.multiplier>=1.05);
});

test('consistent drunk pattern is evaluated highly',()=>{
  const offsets=[0,.025,-.02,.035];
  const motif=[0,1,3,6,8,9,11,14];
  const drunk=[];
  for(let i=0;i<motif.length;i++)drunk.push({type:motif[i]%2?'snare':'kick',t:motif[i]*.125+offsets[i%4]});
  const twice=[...drunk,...drunk.map(n=>({...n,t:n.t+2}))];
  const a=R.analyze(twice);
  assert.ok(a.performanceQuality.repetition>.8);
});

test('random jitter lowers performanceQuality even with same average interval',()=>{
  const regular=R.analyze([0,.5,1,1.5,2,2.5,3,3.5].map(t=>({t,type:'kick'})));
  const jittered=R.analyze([0.03,.47,1.02,1.48,2.05,2.45,3.01,3.49].map(t=>({t,type:'kick'})));
  assert.ok(regular.performanceQuality.multiplier>jittered.performanceQuality.multiplier);
});

test('irregularity alone does not directly penalize damage',()=>{
  const irregular=R.analyze([0,.1,.55,.62,1.3,1.72,2.4,3.85].map(t=>({t,type:'kick'})));
  
  const base={...irregular,power:60,hits:3,accuracy:.9};
  const result=R.resolve(base,{kind:'machine'});
  assert.ok(result.total>0);
});

test('resolve has no stabilityMultiplier or instability in calculation',()=>{
  const a=R.analyze([0,.5,1,1.5,2,2.5,3,3.5].map(t=>({t,type:'kick'})));
  const base={...a,power:60,hits:3,accuracy:.9};
  const result=R.resolve(base,{kind:'machine'});
  assert.ok(!('stabilityMultiplier' in result.calculation));
  assert.ok(!('instability' in result));
});

test('same input always produces identical damage result',()=>{
  const notes=[0,.5,1,1.5,2,2.5,3,3.5].map(t=>({t,type:'kick'}));
  const a=R.analyze(notes);
  const base={...a,power:60,hits:3,accuracy:.9};
  const r1=R.resolve(base,{kind:'machine'});
  const r2=R.resolve(base,{kind:'machine'});
  assert.deepEqual(r1,r2);
  assert.deepEqual(R.resolve(base,{kind:'machine'}),r1);
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
