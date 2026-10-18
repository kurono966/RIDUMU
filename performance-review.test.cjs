const {test}=require('node:test'),assert=require('node:assert/strict'),Review=require('./performance-review.js'),S=require('./synth.js');
const ns=(midi=36)=>[0,.5,1,1.5,2,2.5,3,3.5].map((t,i)=>({type:i%2?'snare':'kick',t,rawT:t,midi,duration:.2,register:0}));
function packet(){return {enemy:{kind:'stone',hp:1000,attack:88,guard:.2},bpm:120,duration:4,conditions:{hp:100,shield:0,enemyHp:1000},tracks:[{voice:'drums',notes:ns().map(({midi,register,...n})=>n)},{voice:'bass',notes:ns().filter(n=>n.type==='kick')},{voice:'lead',notes:ns(60).map((n,i)=>({...n,midi:60+i%4*3}))}],hats:ns().map(n=>({...n,type:'hat'}))};}
test('counterfactual evaluation is deterministic, read-only and responds to every existing source',()=>{
 const p=packet(),original=JSON.stringify(p),a=Review.evaluate(p);assert(a.result.total>0);assert(a.shieldGenerated>0);assert.deepEqual(Review.evaluate(p),a);assert.equal(JSON.stringify(p),original);
 for(const id of ['drums','bass','lead','pitch','ensemble','rhythm','groove'])assert.notDeepEqual(Review.evaluate(p,{omit:id}),a);
 assert(Review.evaluate(p,{omit:'bass'}).shieldGenerated<a.shieldGenerated);
 assert.equal(Review.evaluate(p,{omit:'drums'}).result.total,0);
});
test('actual benefits respect overkill, held shields and zero-value caps',()=>{
 const p=packet();p.conditions.shield=90;p.conditions.enemyHp=1;
 const result=Review.factors(p);assert.equal(result.actual.damage,1);assert.equal(result.actual.shieldGenerated,0);assert.equal(result.actual.received.damage,0);
 assert(result.all.every(f=>f.damage>0||f.shield>0||f.saved>0));assert(!result.all.some(f=>['pitch','ensemble','timbre','groove','rhythm'].includes(f.id)));
 p.conditions.shield=0;const killed=Review.factors(p);assert(killed.actual.shieldGenerated>0);assert(!killed.all.some(f=>f.id==='bass'),'a shield discarded after killing the enemy is not a useful battle bonus');
});
test('normalization removes remaining HP, existing shields and enemy balance differences',()=>{
 const p=packet(),q=Review.copy(p);q.conditions={hp:1,shield:90,enemyHp:1};q.enemy.attack=500;q.enemy.guard=.5;
 const c=Review.compare(p,q);assert.equal(c.damage,0);assert.equal(c.shield,0);assert.equal(c.received,0);assert.match(c.conditions,/敵が生存/);
 q.enemy.kind='fly';assert.equal(Review.compare(p,q),null);
});
test('comparison explains changed melody, ensemble, groove and timbre through shared calculations',()=>{
 const p=packet(),q=Review.copy(p);q.tracks[2].notes=ns(60).map(n=>({...n,midi:60,register:.5}));const patch=S.patch({wave:'sawtooth',cutoff:6000},'bass');q.tracks[1].synth={version:1,patch,events:[]};
 const c=Review.compare(p,q);assert(c.changes.length>0);assert(c.changes.some(c=>c.id==='pitch'||c.id==='timbre'));
 assert.equal(c.damage,Review.evaluate(q,{neutral:true}).damage-Review.evaluate(p,{neutral:true}).damage);
});
test('live cues use the actual partial ensemble, never future notes, and are explicitly provisional',()=>{
 const p=packet(),parts=new Map(p.tracks.map(t=>[t.voice,t.notes]));const n=parts.get('bass')[0],cues=Review.live(parts,p.hats,'bass',n,120,4);
 assert(cues.some(c=>c.kind==='lock'));assert(cues.every(c=>c.provisional));
 const future=new Map(parts);future.set('drums',parts.get('drums').map(n=>({...n,t:n.t+1,rawT:n.rawT+1})));assert(!Review.live(future,p.hats,'bass',n,120,4).some(c=>c.kind==='lock'));
 const shifted=new Map(parts);shifted.set('bass',parts.get('bass').map(n=>({...n,t:n.t+.09,rawT:n.rawT+.09})));assert(!Review.live(shifted,p.hats,'bass',shifted.get('bass')[0],120,4).some(c=>c.kind==='lock'));
});
test('hints target missing effects, armor and damage and avoid immediately repeating themselves',()=>{
 const p=packet(),a=Review.evaluate(p),first=Review.hint(a,p.enemy),next=Review.hint(a,p.enemy,[first.id]);assert.notEqual(first.id,next.id);assert.equal(typeof first.text,'string');
 assert.equal(Review.hint(a,p.enemy).id,'armor');a.lead.pitch.effects.pierce=.3;assert.notEqual(Review.hint(a,p.enemy).id,'armor');
 p.tracks[0].notes=[];assert.match(Review.hint(Review.evaluate(p),p.enemy).text,/攻撃の土台/);
});
