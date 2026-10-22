const {test}=require('node:test'),assert=require('node:assert/strict');
const Run=require('./roguelite'),R=require('./rhythm'),C=require('./performance-combat'),E=require('./ensemble'),G=require('./groove'),Review=require('./performance-review');
const roster=require('./scripts/audit-game.cjs').create().roster();
const rng=seed=>()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
const notes=(times,type='kick')=>times.map(t=>({type,t,rawT:t}));
const alternating=Array.from({length:8},(_,i)=>({type:i%2?'snare':'kick',t:i*.5,rawT:i*.5}));
function start(seed=1){const run=Run.create(roster,rng(seed));Run.rewardOffers(run,rng(seed));assert(Run.claim(run,run.rewards[0].id));return run;}
function collect(run,random){if(run.phase==='reward'){Run.rewardOffers(run,random);const item=run.rewards[0];assert(Run.claim(run,item.id));}}

test('runs offer stable routes, keep source enemies immutable, and end at the eighth boss',()=>{
 const snapshot=JSON.stringify(roster);
 for(let seed=1;seed<=40;seed++){
  const random=rng(seed),run=start(seed);
  while(run.floor<8){
   assert(Run.victory(run));assert.equal(Run.victory(run),false,'victory cannot be awarded twice');collect(run,random);
   const routes=Run.routes(run,roster,random);assert.deepEqual(Run.routes(run,roster,random),routes);
   if(run.floor===7){assert.equal(routes.length,1);assert.equal(routes[0].enemy.kind,'conductor');}
   else {assert.equal(routes[0].kind,'normal');assert.equal(routes[1].kind,'elite');}
   for(const route of routes.filter(o=>o.enemy))assert(!run.used.includes(route.enemy.kind));
   assert(Run.enter(run,routes[seed%2&&routes.length>1?1:0].id));assert.equal(new Set(run.gear.map(g=>g.id)).size,run.gear.length);
  }
  assert(Run.victory(run));assert.equal(run.phase,'complete');assert.equal(new Set(run.used).size,8);
 }
 assert.equal(JSON.stringify(roster),snapshot);
});

test('gear accumulates beyond four slots, choices persist, and duplicates keep leveling without replacement',()=>{
 const run=start();run.phase='reward';run.gear=[{id:'sub',rank:1},{id:'wind',rank:2},{id:'echo',rank:1},{id:'break',rank:1}];
 Run.rewardOffers(run,rng(2));const saved=JSON.stringify(run.rewards);assert.equal(JSON.stringify(Run.rewardOffers(run,rng(99))),saved);
 run.rewards=[{id:'sub',rank:2}];assert(Run.claim(run,'sub'));assert.equal(run.gear.length,4);assert.equal(run.gear[0].rank,2);assert.equal(Run.claim(run,'sub'),false);
 run.phase='reward';run.rewards=[{id:'response',rank:1}];const before=JSON.stringify(run.gear);
 assert(Run.claim(run,'response'));assert.equal(run.gear.length,5);assert(run.gear.some(g=>g.id==='echo'));assert.notEqual(JSON.stringify(run.gear),before);
 run.phase='reward';run.rewards=[{id:'sub',rank:3}];assert(Run.claim(run,'sub'));assert.equal(run.gear.find(g=>g.id==='sub').rank,3);assert(Run.upgrade(run,'sub'));assert.equal(run.gear.find(g=>g.id==='sub').rank,4);
 run.gear=Run.gear.map(g=>({id:g.id,rank:10}));run.rewards=null;assert(Run.rewardOffers(run,rng(6)).every(g=>g.rank===11));
});

test('elite previews and rewards carry the exact increased enemy stats and rank',()=>{
 const run=start();Run.victory(run);Run.skip(run);const elite=Run.routes(run,roster,rng(3)).find(o=>o.kind==='elite'),base=roster.find(e=>e.kind===elite.enemy.kind);
 assert.equal(elite.enemy.hp,Math.round(base.hp*1.2*1.1));assert.equal(elite.enemy.attack,Math.round(base.attack*1.12*1.035));
 assert(Run.enter(run,'elite'));Run.victory(run);assert(Run.rewardOffers(run,rng(1)).every(g=>g.rank===(run.gear.find(item=>item.id===g.id)?.rank??0)+2));
});

test('later encounters grow by floor while repeated upgrades keep increasing every combat benefit',()=>{
 const base=roster.find(e=>e.kind==='conductor'),first=Run.encounter(base,'normal',1),last=Run.encounter(base,'boss',8);
 assert(last.hp>first.hp);assert(last.attack>first.attack);assert.equal(last.hp,Math.round(base.hp*1.7));assert.equal(last.attackCap,Math.round(last.attack*1.6));
 for(const g of Run.gear){assert(Run.valueAt({id:g.id,rank:5})>Run.valueAt({id:g.id,rank:4}));assert(Run.valueAt({id:g.id,rank:4})>Run.valueAt({id:g.id,rank:2}));assert.match(Run.effectText({id:g.id,rank:5}),/\+/);}
 const run=start();run.gear=[{id:'sub',rank:8}];run.phase='bonus';assert(Run.bonus(run,'sub'));assert.equal(run.gear[0].rank,9);
});

test('rest is a single detour that exchanges exactly the next reward, without consuming a combat floor',()=>{
 const run=start();run.floor=2;run.phase='route';Run.routes(run,roster,rng(1));
 const before=run.floor;assert.equal(Run.rest(run,'not-owned'),null);const result=Run.rest(run,'heal');assert.equal(result.heal,35);assert.equal(run.floor,before);
 assert(!run.offers.some(o=>o.kind==='rest'));assert.equal(Run.rest(run,'heal'),null);
 Run.enter(run,'normal');assert(run.skipReward);Run.victory(run);assert.equal(run.phase,'route');assert.equal(run.skipReward,false);
 Run.routes(run,roster,rng(2));Run.enter(run,'normal');Run.victory(run);assert.equal(run.phase,'reward');
});

test('session progress requires real performance, persists across cycles and grants only one chosen upgrade',()=>{
 const run=start();run.floor=3;run.phase='route';Run.routes(run,roster,rng(1));
 assert.equal(Run.enter(run,'session','invalid'),false);assert(Run.enter(run,'session','repeat'));assert.equal(run.current.enemy.routeKind,'session');
 assert.equal(Run.checkChallenge(run,R.analyze([])),false);assert(Run.checkChallenge(run,R.analyze(alternating)));assert.equal(Run.checkChallenge(run,R.analyze(alternating)),false);
 Run.victory(run);assert.equal(run.phase,'bonus');assert.equal(Run.bonus(run,'invalid'),null);const id=run.gear[0].id;assert(Run.bonus(run,id));assert.equal(run.gear[0].rank,2);assert.equal(run.phase,'reward');assert.equal(Run.bonus(run,id),null);
 const failed=start();failed.floor=3;failed.phase='route';Run.routes(failed,roster,rng(1));Run.enter(failed,'session','space');Run.victory(failed);assert.equal(failed.phase,'reward');
});

test('every equipment condition is reachable through real rhythm, groove, pitch or ensemble analysis',()=>{
 const beat=Array.from({length:8},(_,i)=>i*.5),drums=notes(beat),bass=notes(beat).map(n=>({...n,midi:36,duration:.3})),lead=notes(beat.map(t=>t+.125),'snare').map((n,i)=>({...n,midi:60+i*2,duration:.12}));
 const b=C.bass(bass,drums,120,4,[],{id:'heavy'}),l=C.lead(lead,120,4,[]),ensemble=E.analyze({drums,bass,lead},120,4);
 const a=R.analyze(drums),conditions=Run.conditions(a,b,l,ensemble);
 for(const id of ['echo','break','response','lock','rise','anchor','sustain'])assert(conditions[id],id);
 assert(Run.conditions(R.analyze(notes([0,1.5,3]))).sub);
 assert(Run.conditions(R.analyze(alternating)).wind);
 assert(Run.conditions(R.analyze(notes([.25,.75,1.25,1.75,2.25,2.75,3.25,3.75]))).spark);
 const dialogue=drums.map((n,i)=>({...n,type:i<4?'kick':'snare'}));assert(Run.conditions(R.analyze(dialogue)).develop);
 const swingNotes=Array.from({length:16},(_,i)=>({type:i%2?'snare':'kick',t:i*.25+(i%2?1/12:0)})),hat=notes(beat,'hat');
 const swing=G.enrich(R.analyze(swingNotes),G.analyzeRelations(swingNotes,hat,120,4));assert(Run.conditions(swing).swing);
});

test('all matching equipment stacks past the old caps without mutating recordings or proccing on silence',()=>{
 const a={...R.analyze(alternating),syncopation:.7,offbeat:.5},snapshot=JSON.stringify(a),inventory=Run.gear.map(g=>({id:g.id,rank:2}));
 const effects=Run.effects(inventory,a,{prepared:1,sustain:1},{pitch:{points:[1,2,3,4],effects:{attack:.1}}},{selected:[{id:'response'},{id:'grooveLock'}]});
 assert(effects.attack>.25);assert(effects.shield>18);assert.equal(effects.heal,5);assert(effects.pierce>.24);
 const enhanced=Run.apply({...a,pitchPierce:.25},effects);assert.equal(enhanced.power,a.power*(1+effects.attack));assert(enhanced.pitchPierce>.3&&enhanced.pitchPierce<1);assert.equal(enhanced.element,a.element);assert.equal(enhanced.powerSteps.at(-1).value,enhanced.power);assert.equal(JSON.stringify(a),snapshot);
 const stronger=Run.apply({...a,pitchPierce:.25},{...effects,pierce:effects.pierce+1});assert(stronger.pitchPierce>enhanced.pitchPierce);assert(R.resolve(stronger,{kind:'neutral',guard:.6}).total>R.resolve(enhanced,{kind:'neutral',guard:.6}).total);
 const healing=Run.effects([{id:'response',rank:8}],a,{}, {},{selected:[{id:'response'}]});assert(healing.heal>6);
 const shieldLow=Run.shieldCapacity([{id:'sub',rank:1}]),shieldHigh=Run.shieldCapacity([{id:'sub',rank:5}]);assert(shieldLow>90&&shieldHigh>shieldLow);
 const silent=Run.effects(inventory,R.analyze([]),{prepared:1,sustain:1},{pitch:{points:[1,2,3,4],effects:{attack:1}}},{selected:[{id:'response'},{id:'grooveLock'}]});
 assert.deepEqual([silent.attack,silent.shield,silent.heal,silent.pierce],[0,0,0,0]);
});

test('audio rewards appear beside rhythm gear and rank upgrades improve both sound and combat',()=>{
 const audio=Run.gear.filter(g=>g.audio);assert.equal(audio.length,10);
 assert(audio.some(g=>g.audio.target==='master'&&g.audio.type==='distortion'));assert(audio.some(g=>g.audio.target==='master'&&g.audio.type==='reverb'));
 for(const target of ['bass','lead'])for(const type of ['chorus','flanger'])assert(audio.some(g=>g.audio.target===target&&g.audio.type===type));
 for(let seed=1;seed<=25;seed++){const run=Run.create(roster,rng(seed)),offers=Run.rewardOffers(run,rng(seed));assert(offers.some(o=>Run.byId(o.id).audio));assert(offers.some(o=>!Run.byId(o.id).audio));}
 const fixtures={...R.analyze(alternating),structure:{rest:.5,repetition:.8,development:.6},syncopation:.5,offbeat:.5,groove:{swing:.6,drunk:.6}};
 const bass={sustain:.7,locked:3},lead={pitch:{points:[1,2,3,4],effects:{attack:.1}}},ensemble={selected:[{id:'response'},{id:'grooveLock'}]};
 for(const g of audio){
  const low=Run.effects([{id:g.id,rank:1}],fixtures,bass,lead,ensemble),high=Run.effects([{id:g.id,rank:2}],fixtures,bass,lead,ensemble);
  assert.equal(low[g.kind],g.values[0],g.id);assert(high[g.kind]>low[g.kind],g.id);
 }
});

test('review includes the exact equipment attack, shields and healing and normalizes comparisons to one rig',()=>{
 const packet={enemy:{kind:'stone',hp:1000,attack:88,guard:.2,intentId:'heavy'},bpm:120,duration:4,conditions:{hp:70,shield:0,enemyHp:1000},hats:notes(Array.from({length:16},(_,i)=>i*.25),'hat'),tracks:[{voice:'drums',notes:alternating},{voice:'bass',notes:notes([0,1,2,3]).map(n=>({...n,duration:.5,midi:36}))},{voice:'lead',notes:notes([.125,1.125,2.125,3.125]).map(n=>({...n,midi:60,duration:.2}))}],gear:[{id:'wind',rank:1},{id:'echo',rank:2},{id:'response',rank:1}]};
 const actual=Review.evaluate(packet),without=Review.evaluate(packet,{omit:'gear'}),expected=Run.effects(packet.gear,without.analysis,without.bass,without.lead,without.ensemble);
 assert(actual.result.total>without.result.total);assert.equal(actual.shield,Math.min(Run.shieldCapacity(packet.gear),without.shield+expected.shield));assert.equal(actual.healed,expected.heal);assert.equal(actual.analysis.power,without.analysis.power*(1+expected.attack));assert(Review.factors(packet).all.some(f=>f.id==='gear'));
 const previous={...packet,gear:[]},comparison=Review.compare(previous,packet);assert.equal(comparison.damage,0);assert.equal(comparison.shield,0);
});
