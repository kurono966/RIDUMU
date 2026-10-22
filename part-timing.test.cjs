const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('./performance-combat'),Q=require('./quantize'),Review=require('./performance-review');
const notes=(bpm,offset=()=>0)=>Array.from({length:16},(_,i)=>({type:'kick',inputT:i*30/bpm+offset(i),t:i*30/bpm+offset(i),duration:.15,midi:48}));
test('alignment, constant displacement, swing and drunk motifs all earn precise part timing',()=>{
 for(const bpm of [82,120,150])for(const pattern of [()=>0,()=>.03,i=>i%2?60/bpm/6:0,i=>[0,.025,-.02,.035][i%4]]){
  const ref=notes(bpm),part=notes(bpm,pattern),p=C.timing(part,{drums:ref},bpm,480/bpm);
  assert.ok(p.score>99.9);assert.ok(p.multiplier>1.19);assert.ok(p.relations[0].score>99.9);
 }
});
test('inconsistent relationships reduce shield and melodic support; relative timing has greater weight',()=>{
 const ref=notes(120),good=notes(120,()=>.03),bad=notes(120,i=>[0,.04,-.02,.03,-.03,.01,.04,-.02,.04,-.01,.035,-.025,.02,-.035,.005,.03][i]);
 const precise=C.timing(good,{hat:ref,drums:ref,bass:ref},120,4),noisy=C.timing(good,{drums:bad},120,4);
 assert.ok(precise.score>99.9);assert.ok(noisy.score<precise.score);assert.equal(precise.relations.length,3);
 assert.ok(Math.abs(noisy.score-(.35*noisy.own.score+.65*noisy.relations[0].score))<1e-8);
 assert.ok(C.bass(good,ref,120,4,[]).shield>C.bass(bad,ref,120,4,[]).shield);
 const lead=n=>C.lead(n,120,4,[],{references:{drums:ref}});
 assert.ok(lead(good).shieldEfficiency>lead(bad).shieldEfficiency);
 assert.ok(lead(good).pitch.effects.accuracy>lead(bad).pitch.effects.accuracy);
 assert.ok(lead(good).attack>C.lead(good,120,4,[],{enabled:false,references:{drums:ref}}).attack);
 assert.ok(lead(bad).shieldEfficiency<C.lead(bad,120,4,[],{enabled:false,references:{drums:ref}}).shieldEfficiency);
});
test('sparse notes remain neutral and quantization cannot improve recorded precision',()=>{
 const ref=notes(120),part=notes(120,i=>[0,.04,-.02,.03][i%4]+(i>=8?.01:0)),snapshot=JSON.stringify(part);
 assert.equal(C.timing(part.slice(0,3),{drums:ref},120,4).multiplier,1);
 assert.equal(C.timing(part.slice(0,4),{drums:ref},120,4).multiplier,1);
 assert.equal(C.timing([],{drums:ref},120,4).score,null);
 assert.deepEqual(C.timing(Q.render(part.map(n=>({...n,quantize:'just'})),120,4),{drums:ref},120,4),C.timing(part,{drums:ref},120,4));
 assert.equal(JSON.stringify(part),snapshot);
 assert.equal(C.timing(part,{drums:ref},120,4,false).multiplier,1);
});
test('review applies timing to real defense and attack and can explain its benefit',()=>{
 const n=notes(120),p={enemy:{kind:'machine',hp:2000,attack:88},bpm:120,duration:4,hats:n.map(n=>({...n,type:'hat'})),tracks:['drums','bass','lead'].map(voice=>({voice,notes:n}))};
 const actual=Review.evaluate(p),neutral=Review.evaluate(p,{omit:'timing'});
 assert.ok(actual.shield>neutral.shield);assert.ok(actual.result.total>neutral.result.total);
 assert.ok(actual.bass.timing.multiplier>1);assert.ok(actual.lead.timing.multiplier>1);
 assert.ok(Review.factors(p).all.some(f=>f.id==='timing'));
});
