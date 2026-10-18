const {test}=require('node:test');
const assert=require('node:assert/strict');
const {presentation}=require('./ui.js');
test('next action follows the real performance phase and current part',()=>{
 assert.equal(presentation({state:'ready',part:'bass',hat:true}).step,'hat');
 assert.equal(presentation({state:'ready',part:'bass',hat:false}).title,'ベース');
 assert.match(presentation({state:'attack',part:'lead'}).instruction,/攻撃中/);
 assert.match(presentation({state:'enemyAttack',part:'lead'}).instruction,/防いで/);
});
test('phrase progress uses the engine duration, stays bounded, and resets outside recording',()=>{
 assert.equal(presentation({state:'recording',remaining:3,duration:6}).progress,.5);
 assert.equal(presentation({state:'recording',remaining:-1,duration:6}).progress,1);
 assert.equal(presentation({state:'ready',remaining:0,duration:6}).progress,0);
});
