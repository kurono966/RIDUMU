const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Art=require('./enemy-art.js'),roster=JSON.parse(JSON.stringify(require('./scripts/audit-game.cjs').create().roster()));

test('all existing enemies have distinct sculptures with three colours and a small geometry budget',()=>{
 assert.deepEqual(Object.keys(Art.definitions).sort(),roster.map(e=>e.kind).sort());
 const silhouettes=new Set();
 for(const enemy of roster){
  const def=Art.definitions[enemy.kind];assert.equal(def.name,enemy.name);assert(def.concept.length>5);assert.equal(new Set(def.palette).size,3);
  assert(def.parts.length>=3&&def.parts.length<=5);assert(def.parts.flatMap(p=>p.shapes).length<=9);
  const svg=Art.toSVG(enemy.kind);assert.match(svg,/role="img"/);assert(svg.includes(enemy.name));
  assert.doesNotMatch(svg,/<(?:image|filter|linearGradient|radialGradient|foreignObject|script)\b|href=|url\(|NaN|Infinity/);
  silhouettes.add(def.parts.flatMap(p=>p.shapes).map(s=>s.attrs.d).join(''));
 }assert.equal(silhouettes.size,8);
});

test('attacks, preparation and defence articulate each sculpture and always return to its base pose',()=>{
 const snapshot=JSON.stringify(Art.definitions);
 for(const kind of Object.keys(Art.definitions)){
  const base=Art.sample(kind,{time:0});
  for(const options of [{guard:1},{charge:1},{reaction:'strike',age:Art.durations.strike/2},{reaction:'weak',age:Art.durations.weak/2},{reaction:'guard',age:Art.durations.guard/2}])assert.notDeepEqual(Art.sample(kind,{time:0,...options}),base,kind+' '+JSON.stringify(options));
  for(const [reaction,duration] of Object.entries(Art.durations)){
   for(const age of [0,duration*.25,duration*.5,duration,duration+1]){
    const state=Art.sample(kind,{time:2,beat:.1,reaction,age,guard:.8,charge:1});assert.doesNotMatch(JSON.stringify(state),/NaN|Infinity|null/);
   }
   assert.deepEqual(Art.sample(kind,{time:0,reaction,age:duration+1}),base,kind+' must settle after '+reaction);
  }
 }assert.equal(JSON.stringify(Art.definitions),snapshot,'sampling cannot mutate reusable geometry');
});

test('beat response is limited to one small articulation and idle timing does not invent musical beats',()=>{
 for(const kind of Object.keys(Art.definitions)){
  const quiet=Art.sample(kind,{time:0}),beat=Art.sample(kind,{time:0,beat:0});
  assert.equal(quiet.root,beat.root);assert.equal(beat.parts.filter((p,i)=>p.transform!==quiet.parts[i].transform).length,1);
  // BPM enters through the actual playing beat clock, not a free-running pulse.
  const slow=Art.sample(kind,{time:0,beat:.1*82/60}),fast=Art.sample(kind,{time:0,beat:.1*150/60});assert.notDeepEqual(slow,fast);
 }
});

test('reduced motion keeps a stable silhouette, while static defence and preparation stay legible',()=>{
 for(const kind of Object.keys(Art.definitions)){
  const a=Art.sample(kind,{time:0,beat:0,reduced:true}),b=Art.sample(kind,{time:8,beat:.7,reduced:true});assert.deepEqual(a,b);
  assert.notDeepEqual(a,Art.sample(kind,{time:8,guard:1,reduced:true}));assert.notDeepEqual(a,Art.sample(kind,{time:8,charge:1,reduced:true}));
  assert.equal(Art.sample(kind,{time:1,reaction:'weak',age:.1,reduced:true}).parts[0].opacity,.82);
 }
});

test('the game keeps the background waveform and replaces the old shared humanoid markup',()=>{
 const html=fs.readFileSync('index.html','utf8'),game=fs.readFileSync('game.js','utf8');
 assert.match(html,/<canvas id="battleWaveform"/);assert.match(html,/<div id="enemy" class="creature stone"><\/div>/);
 assert.doesNotMatch(html,/class="eyes"|class="enemy-aura"|class="enemy-sparks"/);
 assert.match(game,/EnemyArt\?\.react\(enemy,kind\)/);assert.match(game,/EnemyArt\?\.update/);
 assert.match(game,/attackPlayhead\/\(60\/lastBpm\)/);
});
