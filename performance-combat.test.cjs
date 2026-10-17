const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const GridEffects=require('./grid-effects.js');
const Combat=require('./performance-combat.js');
const Rhythm=require('./rhythm.js');
const zones=[{type:'power',slots:[0,8,16]},{type:'shield',slots:[0,8,16]},{type:'boost',slots:[0,8,16]}];
const note=(q,type='kick',duration=.12,midi=36)=>({type,t:q*.125,rawT:q*.125,duration,midi});
test('Bass generates shields; strong beats, holds, repetition and Kick alignment contribute',()=>{
 const plain=Combat.bass([note(1)],[],120,4,[]);
 assert.ok(plain.shield>0);assert.equal(Combat.bass([],[],120,4,zones).shield,0);
 const bass=[note(0,'kick',1),note(16,'kick',1)];
 const held=Combat.bass(bass,bass,120,4,[]);
 assert.ok(held.shield>plain.shield);assert.equal(held.strong,2);assert.equal(held.locked,2);assert.equal(held.repetition,1);assert.equal(held.sustain,.5);
 assert.ok(Combat.bass(bass,bass,120,4,zones).shield>held.shield);
});
test('overlapping held Bass notes do not double-count sustain or zone rewards',()=>{
 const a=Combat.bass([note(0,'kick',2)],[],120,4,zones),b=Combat.bass(Array.from({length:20},()=>note(0,'kick',2)),[],120,4,zones);
 assert.equal(a.sustain,b.sustain);assert.equal(a.shield,b.shield);assert.equal(b.zone,1);
});
test('Drums POWER increases resolved attack while notes outside zones still attack',()=>{
 const drums=[note(0),note(8,'snare'),note(16)],a=Rhythm.analyze(drums),support=Combat.lead([],120,4,zones);
 const basic=Combat.enhance(a,drums,120,[],support),boosted=Combat.enhance(a,drums,120,zones,support);
 assert.ok(basic.power>0);assert.equal(boosted.powerHits,3);assert.ok(boosted.power>basic.power);
 assert.ok(Rhythm.resolve(boosted,{kind:'stone'},()=>.1).total>Rhythm.resolve(basic,{kind:'stone'},()=>.1).total);
});
test('Lead BOOST enhances support; pitch direction chooses different benefits',()=>{
 const rising=[note(0,'kick',.3,60),note(8,'kick',.3,64),note(16,'snare',.3,67)];
 const plain=Combat.lead(rising,120,4,[]),boost=Combat.lead(rising,120,4,zones);
 assert.ok(boost.attack>plain.attack);assert.ok(boost.shieldEfficiency>plain.shieldEfficiency);assert.equal(boost.zone,3);
 const falling=Combat.lead(rising.map((n,i)=>({...n,midi:[67,64,60][i]})),120,4,[]);
 assert.ok(falling.weaken>plain.weaken);assert.ok(plain.attack>falling.attack);
});
test('enemy attack consumes shield first, with only remaining damage reaching HP',()=>{
 assert.deepEqual(Combat.receive(100,20,32),{incoming:32,absorbed:20,damage:12,shield:0,hp:88});
 assert.deepEqual(Combat.receive(100,50,32),{incoming:32,absorbed:32,damage:0,shield:18,hp:100});
 assert.equal(Combat.receive(100,10,40,.25).hp,80);
});
test('grid effects use raw placement rather than playback correction, and move by turn',()=>{
 assert.equal(GridEffects.inspect([{t:.125,rawT:.125,inputT:0}],'drums',zones,120).power,1);
 assert.equal(GridEffects.inspect([note(0)],'bass',zones,120).power,undefined);
 assert.notDeepEqual(GridEffects.create(1,0),GridEffects.create(2,0));
 assert.equal(new Set(GridEffects.create(1,0).flatMap(z=>z.slots)).size,9);
});
test('old reactive defense code, UI and module are removed',()=>{
 const game=fs.readFileSync('game.js','utf8'),html=fs.readFileSync('index.html','utf8');
 assert.doesNotMatch(game,/defensePhase|defenseInput|defenseBattle|drawDefense|Defense\.press/);
 assert.doesNotMatch(html,/src="defense.js"|CHORD DEFENSE/);assert.equal(fs.existsSync('defense.js'),false);
});
