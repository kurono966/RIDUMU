const {test}=require('node:test'),assert=require('node:assert/strict'),G=require('./grid-hazards.js');
const poison=(extra={})=>({type:'poison',slots:[4,12],turns:4,power:3,...extra});
const press=(g,rawT,type='kick')=>g.onInput({type,rawT,bpm:120});
test('poison damages the occupied raw sixteenth slot and nearby danger range, not safe slots',()=>{
 const g=G.create();g.add(poison());assert.equal(press(g,.5).effects[0].amount,3);assert.equal(press(g,.575,'snare').slot,5);assert.equal(press(g,.575,'snare').effects[0].amount,3);
 assert.deepEqual(press(g,.6).effects,[]);assert.deepEqual(press(g,.75).effects,[]);assert.equal(press(g,1.5,'hat').effects[0].amount,3);
});
test('every manual input is evaluated independently, even at the same time',()=>{
 const g=G.create();g.add(poison());assert.equal([.5,.5,.52].reduce((damage,t)=>damage+press(g,t).effects[0].amount,0),9);assert.equal(g.active()[0].remainingTurns,4);
});
test('future contamination lasts exactly its specified input turns',()=>{
 const g=G.create();g.advanceToTurn(3);g.add(poison({fromTurn:4}));assert.deepEqual(g.active(),[]);assert.deepEqual(press(g,.5).effects,[]);
 for(const [turn,remaining] of [[4,4],[5,3],[6,2],[7,1]]){g.advanceToTurn(turn);g.advanceToTurn(turn);assert.equal(g.active()[0].remainingTurns,remaining);assert.equal(press(g,.5).effects[0].amount,3);}
 g.advanceToTurn(8);assert.deepEqual(g.active(),[]);assert.deepEqual(press(g,.5).effects,[]);
});
test('new and existing contamination coexist and expire independently',()=>{
 const g=G.create();g.add(poison());g.advanceToTurn(3);g.add(poison({slots:[8],turns:5,power:4}));assert.equal(g.active().length,2);assert.equal(press(g,.5).effects[0].amount,3);assert.equal(press(g,1).effects[0].amount,4);
 g.advanceToTurn(5);assert.equal(g.active().length,1);assert.deepEqual(press(g,.5).effects,[]);assert.equal(press(g,1).effects[0].amount,4);
});
test('overlapping poison uses the strongest damage once per input, without hiding either hazard',()=>{
 const g=G.create();g.add(poison());g.add(poison({power:5}));const hit=press(g,.5);assert.equal(hit.hits.length,2);assert.equal(hit.effects.length,1);assert.equal(hit.effects[0].amount,5);
});
test('early downbeats use raw distance without wrapping into the last cell',()=>{
 const g=G.create();g.add(poison({slots:[0,31]}));assert.equal(press(g,-.03).effects[0].amount,3);assert.deepEqual(press(g,-.2).effects,[]);assert.deepEqual(press(g,4).effects,[]);
});
test('reset clears pending and active contamination and starts a fresh battle clock',()=>{
 const g=G.create();g.add(poison());g.add(poison({fromTurn:4}));g.advanceToTurn(2);g.reset();assert.equal(g.turn,1);assert.deepEqual(g.active(),[]);g.advanceToTurn(4);assert.deepEqual(g.active(),[]);
});
test('registered future interventions receive musical context without implementing them by default',()=>{
 const g=G.create();g.add({type:'echo',slots:[4],turns:2});assert.deepEqual(press(g,.5).effects,[]);
 g.register('echo',context=>[{kind:'example',lane:context.inputType,slot:context.slot}]);assert.deepEqual(press(g,.5).effects,[{kind:'example',lane:'kick',slot:4}]);assert.ok(G.types.includes('forceQuantize'));
});
test('hazard snapshots cannot mutate live state and invalid configuration is rejected',()=>{
 const g=G.create(),spec=poison();g.add(spec);spec.slots.push(8);g.active()[0].slots.push(9);assert.deepEqual(press(g,1).effects,[]);assert.throws(()=>g.add(poison({power:NaN})));assert.throws(()=>g.add(poison({radiusSlots:Infinity})));assert.throws(()=>g.advanceToTurn(0));
});

test('future handlers receive isolated per-hazard parameters and original note context',()=>{
 const g=G.create(),params={delaySlots:1};g.add({type:'echo',slots:[4],turns:2,params});params.delaySlots=9;g.active()[0].params.delaySlots=8;
 g.register('echo',context=>[{kind:'example',slots:context.hazards[0].params.delaySlots,midi:context.input.note.midi}]);
 assert.deepEqual(g.onInput({type:'kick',rawT:.5,bpm:120,voice:'bass',note:{midi:36}}).effects,[{kind:'example',slots:1,midi:36}]);
});
