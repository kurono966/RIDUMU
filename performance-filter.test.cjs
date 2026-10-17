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
