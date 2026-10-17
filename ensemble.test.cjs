const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('./ensemble.js');
const n=(q,type='kick',delta=0)=>({type,t:q*.125+delta,rawT:q*.125+delta});
const score=(tracks,id)=>E.analyze(tracks,120,4).scores[id];
test('GROOVE LOCK accepts consistent natural microtiming between Kick and Bass',()=>{
 const tracks={drums:[0,8,16].map(q=>n(q)),bass:[0,8,16].map(q=>n(q,'kick',.03))};
 const result=E.analyze(tracks);assert.ok(result.scores.grooveLock>.9);assert.ok(result.bonus.attack>0);assert.ok(result.bonus.shield>0);
 assert.equal(result.selected[0].cells.length,6);
});
test('RESPONSE rewards Lead answering Snare rather than simultaneous notes',()=>{
 const drums=[4,12,20].map(q=>n(q,'snare'));
 assert.ok(score({drums,lead:[5,13,21].map(q=>n(q))},'response')>.9);
 assert.equal(score({drums,lead:[4,12,20].map(q=>n(q))},'response'),0);
});
test('INTERLOCK rewards sparse gap filling, and not filling every grid cell',()=>{
 const drums=[0,8,16,24].map(q=>n(q)),bass=[2,10,18,26].map(q=>n(q));
 const result=E.analyze({drums,bass});assert.ok(result.scores.interlock>.9);assert.ok(result.bonus.accuracy>0);assert.ok(result.bonus.shieldEfficiency>0);
 const dense=Array.from({length:32},(_,q)=>n(q));assert.equal(score({drums,bass:dense},'interlock'),0);
});
test('unrelated separated phrases and solo parts do not invent synergy',()=>{
 const unrelated=E.analyze({drums:[1,2].map(q=>n(q,'snare')),bass:[18,19].map(q=>n(q)),lead:[28,29].map(q=>n(q))});
 assert.equal(unrelated.selected.length,0);
 for(const voice of ['drums','bass','lead'])assert.equal(E.analyze({[voice]:[0,4,8].map(q=>n(q))}).selected.length,0);
});
test('UNISON rewards limited important accents, not arbitrary simultaneous slots',()=>{
 const notes=[0,16].map(q=>n(q));assert.ok(score({drums:notes,bass:notes,lead:notes},'unison')>.9);
 const off=[3,11].map(q=>n(q));assert.equal(score({drums:off,bass:off,lead:off},'unison'),0);
});
test('CALL & RESPONSE compares delayed nonuniform rhythm shapes, allowing small timing changes',()=>{
 const drums=[0,1,3].map(q=>n(q)),lead=[8,9,11].map(q=>n(q,'snare',.02));
 assert.ok(score({drums,lead},'callResponse')>.7);
 assert.equal(score({drums,lead:[8,9,14].map(q=>n(q))},'callResponse'),0);
});
test('duplicate input spam cannot stack bonuses and only two synergies contribute',()=>{
 const notes=[0,8,16].map(q=>n(q)),base={drums:notes,bass:notes,lead:notes};
 const once=E.analyze(base),spam=E.analyze(Object.fromEntries(Object.entries(base).map(([v,a])=>[v,a.flatMap(n=>Array(20).fill(n))])));
 assert.deepEqual(spam.bonus,once.bonus);assert.ok(spam.selected.length<=2);assert.ok(spam.bonus.attack<=.18);assert.ok(spam.bonus.shield<=6);
 const full=Array.from({length:32},(_,q)=>n(q));assert.equal(E.analyze({drums:full,bass:full,lead:full}).selected.length,0);
});
test('playback quantization cannot fabricate a raw-timing lock',()=>{
 const drums=[0,8,16].map(q=>n(q)),bass=[0,8,16].map(q=>({...n(q),inputT:q*.125+.085}));
 assert.equal(score({drums,bass},'grooveLock'),0);
});
test('synergy modifies attack and support without replacing roles or mutating source values',()=>{
 const notes=[0,8,16].map(q=>n(q)),lock=E.analyze({drums:notes,bass:notes});
 const base={power:40,accuracy:.9,effect:.5,breakPower:.2,hits:3,element:'earth'},attack=E.attack(base,lock);
 assert.ok(attack.power>40);assert.equal(base.power,40);assert.equal(attack.hits,3);assert.equal(attack.element,'earth');
 const response=E.analyze({drums:[4,12,20].map(q=>n(q,'snare')),lead:[5,13,21].map(q=>n(q))});
 const support={attack:.2,expose:.1,accuracy:.03,element:.1,shieldEfficiency:.1,weaken:.05};
 assert.ok(E.support(support,response).attack>support.attack);assert.equal(support.attack,.2);
});
