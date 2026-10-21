const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('./pitch-combat.js'),C=require('./performance-combat.js'),R=require('./rhythm.js'),H=require('./sequence-history.js');
const notes=(pitches,extra={})=>pitches.map((midi,i)=>({type:'kick',midi,t:i*.5,rawT:i*.5,duration:.3,...extra}));
const lead=p=>P.analyze(notes(p),'lead',120,4),bass=p=>P.analyze(notes(p),'bass',120,4);
const attack={power:100,accuracy:.8,effect:.5,count:4,hits:2,weight:.4,charged:0,alternation:0,density:1,element:'fire'};
test('nine-note upper pitches roundtrip through history, JSON, MIDI and legacy pitch evaluation',()=>{
 const entry=H.snapshot({bpm:120,duration:4,tracks:[{voice:'lead',notes:[{type:'snare',t:0,pitch:7,midi:72},{type:'snare',t:1,pitch:8,midi:74}]}]});
 assert.deepEqual(H.validate(JSON.parse(JSON.stringify(entry))).tracks,entry.tracks);assert.equal(P.midi({pitch:7},'lead'),72);assert.equal(P.midi({pitch:8},'bass'),50);const data=Buffer.from(H.midi(entry));assert(data.includes(Buffer.from([0x91,72,80])));assert(data.includes(Buffer.from([0x91,74,80])));
});
test('semitone intervals distinguish repeat, small, medium, large and direction',()=>{
 assert.equal(lead([60,60,60,60]).effects.accuracy,.06);
 assert.equal(lead([60,61,62,64]).effects.element,.18);
 assert.equal(lead([60,63,66,70]).effects.attack,.22);
 assert.equal(lead([70,66,63,60]).effects.weaken,.16);
 assert.equal(lead([60,67,60,67]).effects.pierce,.3);assert.equal(lead([60,67,60,67]).effects.accuracy,-.05);
 assert.equal(lead([60]).effects.attack,0);assert.equal(lead([]).effects.accuracy,0);
});
test('melody effects use proportions and are invariant to transposition and note duration',()=>{
 const a=lead([60,63,63,70]),b=lead([24,27,27,34]);assert.deepEqual(a.effects,b.effects);
 assert.deepEqual(a.effects,P.analyze(notes([60,63,63,70],{duration:2}),'lead',120,4).effects);
 const repeat=lead([60,60,60,60]);assert.deepEqual(repeat.effects,lead([60,60,60,60,60,60,60,60]).effects);
});
test('simultaneous monophonic input and dense spam count only the final note in each cell',()=>{
 const a=notes([60,63,63,70]),spam=a.flatMap(n=>[{...n,midi:100},{...n}]);assert.deepEqual(P.analyze(spam,'lead',120,4).effects,lead([60,63,63,70]).effects);
 const dense=Array.from({length:1000},(_,i)=>({t:.001*i/1000,midi:i===999?60:100}));assert.equal(P.analyze(dense,'lead',120,4).points.length,1);
});
test('Bass register is relative to recorded palette and cannot be increased by transposition',()=>{
 const low=P.analyze(notes([36,36,36,36],{register:0}),'bass',120,4),high=P.analyze(notes([43,43,43,43],{register:1}),'bass',120,4);
 assert.equal(low.effects.shield,.24);assert.equal(high.effects.shield,-.039999999999999994);assert.equal(high.effects.attack,.1);
 assert.deepEqual(low.effects,P.analyze(notes([12,12,12,12],{register:0}),'bass',120,4).effects);
 assert(Math.abs(P.apply(attack,high,null).power-110)<1e-9);
 assert.equal(bass([36,36,36,36]).effects.shield,.08,'legacy same pitch is neutral register plus repeat');
 assert.equal(bass([36,43,36,43]).effects.resistance,.12);assert.equal(bass([36,38,40,43]).effects.resistance,0);
 assert.equal(P.register(36,[36,43]),0);assert.equal(P.register(43,[36,43]),1);assert.equal(P.register(36,[36,36]),.5);
});
test('two-note repeat and movement give useful choices without mode multipliers',()=>{
 const stable=lead([60,60,60,60]),moving=lead([60,63,60,63]),four=lead([60,63,67,70]),seven=lead([60,70,62,68]);
 assert(stable.effects.accuracy>0);assert(moving.effects.attack>0);assert(four.effects.attack>moving.effects.attack);assert(seven.effects.pierce>0);assert(seven.effects.accuracy<0);
 for(const row of [stable,moving,four,seven]){assert(row.effects.attack<=.22);assert(row.effects.pierce<=.3);assert(row.effects.weaken<=.16);}
});
test('actual damage includes pitch attack, deterministic accuracy cost and armored shield penetration',()=>{
 const jumps=lead([60,67,60,67]),a=P.apply(attack,null,jumps),armored={kind:'machine',guard:.3};
 assert.equal(a.accuracy,.75);assert.equal(a.pitchPierce,.3);assert.equal(R.resolve(a,armored).calculation.guard.multiplier,.79);
 const heavyAttack={...a,power:a.power*3};assert(R.resolve(heavyAttack,armored).total>R.resolve({...heavyAttack,pitchPierce:0},armored).total,'pitch penetration should improve meaningful damage after integer rounding');
 assert(R.resolve(P.apply(attack,null,lead([60,63,66,70])),{kind:'plant'}).total>R.resolve(attack,{kind:'plant'}).total);
 assert.deepEqual(R.resolve(a,armored),R.resolve(a,armored));assert.equal(R.resolve(a,{kind:'machine'}).calculation.guard.multiplier,1);
 const small=P.apply(attack,null,lead([60,61,62,63]));assert(small.effect>attack.effect);assert(R.resolve(small,{kind:'machine'}).total>R.resolve(attack,{kind:'machine'}).total);
});
test('same-note accuracy and small intervals expose the exact applied cap in feedback ledger',()=>{
 const a=P.apply({...attack,accuracy:.98,effect:.99},null,lead([60,60,60,60]));assert.equal(a.accuracy,.99);assert(Math.abs(a.pitchApplied.causes[0].value-.01)<1e-9);
 const e=P.apply({...attack,effect:1},null,lead([60,61,62,63]));assert.equal(e.pitchApplied.element,0);assert.equal(e.pitchApplied.causes.find(c=>c.field==='element').value,0);
});
test('bass shields and resistance and descending lead change actual incoming damage with shared caps',()=>{
 const l={pitch:lead([70,67,64,60]),weaken:.03},b={pitch:bass([36,43,36,43])},reduction=C.reduction(l,b,null,attack);
 assert(Math.abs(reduction.total-.31)<1e-9);assert(C.receive(100,0,100,reduction.total).damage<C.receive(100,0,100,.03).damage);
 const capped=C.reduction(l,b,{bonus:{resistance:.5}},attack);assert.equal(capped.total,.55);assert(capped.pitch<.03);
 const low=C.bass(notes([36,36,36,36],{register:0}),[],120,4,[]),high=C.bass(notes([43,43,43,43],{register:1}),[],120,4,[]);assert(low.shield>high.shield);assert.equal(low.shield,low.rhythmShield+low.pitchShield);
});
test('JSON storage preserves relative pitch after key changes and accepts older note records',()=>{
 const info={bpm:120,duration:4,tracks:[{voice:'bass',notes:notes([36,43,36,43],{register:0})}]},entry=H.snapshot(info),copy=H.validate(JSON.parse(JSON.stringify(entry)));
 assert.equal(copy.tracks[0].notes[0].register,0);assert.deepEqual(P.analyze(copy.tracks[0].notes,'bass').effects,P.analyze(info.tracks[0].notes,'bass').effects);
 delete entry.tracks[0].notes[0].register;assert(H.validate(entry));entry.tracks[0].notes[0].register=2;assert.throws(()=>H.validate(entry));
 assert.equal(P.analyze([{type:'kick',t:0},{type:'snare',t:1}],'lead').edges[0].semitones,3);
});
