const {test}=require('node:test'),assert=require('node:assert/strict'),F=require('./feedback-audio.js');
test('audio feedback uses existing approved notes, is bounded by its engine and can be fully disabled',()=>{
 const calls=[],h={emphasize(...args){calls.push(args);return true;},clearEmphasis(){calls.push('reset');}};F.setEnabled(true);
 assert.equal(F.apply(h,{kind:'lock',strength:.5},1),true);assert.deepEqual(calls[0],['lock',.5,1]);assert.equal(F.apply(h,{kind:'response',strength:1},2),true);
 for(const kind of ['up','down','hit','quality'])assert.equal(F.apply(h,{kind,strength:1},2),false);
 assert.equal(F.apply(null,{kind:'lock',strength:1},2),false);F.setEnabled(false);assert.equal(calls.at(-1),'reset');const count=calls.length;assert.equal(F.apply(h,{kind:'lock',strength:1},2),false);assert.equal(calls.length,count);F.setEnabled(true);
});
