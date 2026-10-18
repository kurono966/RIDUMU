const test=require('node:test');
const assert=require('node:assert/strict');
const filter=require('./performance-filter.js');
test('filter combat effects are deterministic and bounded',()=>{
 filter.set(0,'lowpass');assert.deepEqual(filter.combat(),{shield:0,attack:1});
 filter.set(1,'lowpass');assert.deepEqual(filter.combat(),{shield:8,attack:1});
 filter.set(1,'highpass');assert.deepEqual(filter.combat(),{shield:0,attack:1.12});
 filter.set(10,'highpass');assert.equal(filter.state.amount,1);
 filter.set(-1,'lowpass');assert.equal(filter.state.amount,0);
});
test('cutoff responds in opposite directions by mode',()=>{
 filter.set(0,'lowpass');const lowOpen=filter.state.cutoff;
 filter.set(1,'lowpass');assert.ok(filter.state.cutoff<lowOpen);
 filter.set(0,'highpass');const highOpen=filter.state.cutoff;
 filter.set(1,'highpass');assert.ok(filter.state.cutoff>highOpen);
});
test('XY volume and filter are independent and smoothly applied to the audio chain',()=>{
 const connections=[],frequencies=[],levels=[];
 const destination={};
 const gain={gain:{setTargetAtTime:(...args)=>levels.push(args)},connect:target=>connections.push(target)};
 const node={Q:{value:0},frequency:{setTargetAtTime:(...args)=>frequencies.push(args)},connect:target=>connections.push(target)};
 const context={currentTime:2,createGain:()=>gain,createBiquadFilter:()=>node};
 filter.set(.6,'lowpass',.25);
 assert.equal(filter.connect(context,destination),node);
 assert.deepEqual(connections,[gain,destination]);
 assert.deepEqual(levels.at(-1),[.25,2,.018]);
 const cutoff=frequencies.at(-1)[0];
 filter.set(.6,'lowpass',0);
 assert.equal(frequencies.at(-1)[0],cutoff);
 assert.equal(levels.at(-1)[0],0);
 filter.set(.2,'highpass',2);
 assert.equal(filter.state.volume,1);
 filter.set(.4,'highpass');
 assert.equal(filter.state.volume,1);
 filter.set(.4,'highpass',-1);
 assert.equal(filter.state.volume,0);
});
