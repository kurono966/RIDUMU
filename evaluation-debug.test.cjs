const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const D=require('./evaluation-debug.js'),R=require('./rhythm.js'),G=require('./groove.js'),Q=require('./quantize.js'),C=require('./performance-combat.js'),E=require('./ensemble.js');
test('maximum charts establish effective laid-back or drunk timing before maximizing damage',()=>{
 const roster=[['stone',82,.2],['machine',120,.25],['plant',100,0],['ghost',72,0],['conductor',126,.18]];
 for(const [kind,bpm,guard] of roster)for(const intentId of [undefined,'guard']){
  const enemy={kind,guard,intentId},duration=480/bpm,plan=D.damageChart('max',bpm,duration,[],enemy);
  const expected=['laidBack','drunk'].filter(id=>G.affinity({[id]:1},kind).some(b=>b.id===id&&b.multiplier>1));
  assert.deepEqual(plan.preferredGrooves,expected);assert.ok(expected.includes(plan.grooveStyle),kind);
  const actual=D.compare(plan.parts,plan.hats,bpm,duration,[],enemy).normal;
  assert.equal(actual.result.total,plan.total);assert.equal(G.classify(actual.groove),plan.grooveStyle);
  assert.ok(actual.groove[plan.grooveStyle]>=.55);assert.ok(actual.groove.unstable<.35);
  // Musical constraints intentionally replace the previous unconstrained floor.
  assert.ok(plan.total>0,'effective groove must produce a nonempty attack: '+kind);
  for(const notes of [...plan.parts.values(),plan.hats])for(const n of notes){assert.equal(n.rawT,n.t);assert.equal(n.quantize,'off');assert.ok(n.t>=0&&n.t<duration);}
 }
});
test('musical maximum charts establish the pulse, develop both bars and resolve their melodies',()=>{
 const roster=[['stone',82,.2],['fly',150,0],['machine',120,.25],['plant',100,0],['ghost',72,0],['crystal',138,.3],['furnace',108,.15],['conductor',126,.18]];
 for(const [kind,bpm,guard] of roster)for(const intentId of ['guard','heavy','heal','pierce','buff','special']){
  const p=D.damageChart('max',bpm,480/bpm,[],{kind,guard,intentId}),step=60/bpm/4,drums=p.parts.get('drums'),bass=p.parts.get('bass'),lead=p.parts.get('lead');
  assert.equal(drums[0].type,'kick');assert.equal(drums[0].t,0,kind+' must establish the first beat');
  assert.equal(p.hats.length,16);p.hats.forEach((n,i)=>assert.equal(n.t,i*step*2,'Hat remains the audible clock'));
  for(const bar of [0,1]){
   const ns=drums.filter(n=>Math.round(n.t/step)>=bar*16&&Math.round(n.t/step)<(bar+1)*16);
   assert.ok(ns.length>=3,'each bar must have a voiced phrase');assert.ok(ns.some(n=>n.type==='snare'));
   assert.ok(bass.some(n=>n.t===bar*16*step&&n.pitch===0),'Bass supports each bar with its low tonic');
  }
  for(const ns of [bass,lead]){
   assert.equal(ns.at(-1).pitch,0,'melody returns to the tonic');
   assert.ok(ns.some((n,i)=>i&&n.t>ns[i-1].t+ns[i-1].duration+.01),'phrases have breathing room');
   ns.forEach((n,i)=>{assert.ok(n.duration>0);assert.ok(n.t+n.duration<=480/bpm+1e-8);if(i)assert.ok(ns[i-1].t+ns[i-1].duration<=n.t+1e-8);});
  }
  assert.ok(bass.some(n=>n.duration>=step*3),'Bass has sustained support');
  assert.notDeepEqual(bass.map(n=>n.t),lead.map(n=>n.t),'accompaniment and reply have distinct rhythms');
 }
});
test('weaknesses remain valuable while guard admits tactical elemental alternatives',()=>{
 const roster=[['stone',82,.2,'earth'],['fly',150,0,'wind'],['machine',120,.25,'lightning'],['plant',100,0,'fire'],['ghost',72,0,'lightning'],['crystal',138,.3,'earth'],['furnace',108,.15,'wind'],['conductor',126,.18,'fire']];
 for(const intentId of [undefined,'guard','buff'])for(const [kind,bpm,guard,weakness] of roster){
  const enemy={kind,guard,intentId},charts=['earth','wind','fire','lightning'].map(element=>D.damageChart('max',bpm,480/bpm,[],enemy,{element}));
  const best=charts.reduce((a,b)=>a.total>=b.total?a:b);
  if(!intentId)assert.equal(best.element,weakness,kind+' / normal');
  else assert.ok(charts.find(chart=>chart.element===weakness).total>=best.total*.65,'weakness remains viable: '+kind);
  if(!intentId){const auto=D.damageChart('max',bpm,480/bpm,[],enemy);assert.equal(auto.total,best.total,'auto input must compare fully supported elemental finalists');}
 }
});
test('automatic charts are deterministic, playable and reproduce their evaluated damage',()=>{
 for(const kind of ['stone','fly','machine','plant','ghost','crystal']){
  const enemy={kind,guard:.2,intentId:'guard'},bpm=120,duration=4;
  const max=D.damageChart('max',bpm,duration,[],enemy),min=D.damageChart('min',bpm,duration,[],enemy);
  assert.ok(max.total>0);assert.ok(max.candidates>100);
  assert.equal(D.compare(max.parts,max.hats,bpm,duration,[],enemy).normal.result.total,max.total);
  assert.equal(D.compare(min.parts,min.hats,bpm,duration,[],enemy).normal.result.total,0);
  for(const [voice,notes] of max.parts){
   const gaps=notes.slice(1).map((n,i)=>Math.round((n.t-notes[i].t)*1000));
   assert.ok(new Set(gaps).size>=2,voice+' must have rhythmic variation');
   if(voice==='drums')assert.equal(new Set(notes.map(n=>n.type)).size,2);
   else {assert.ok(new Set(notes.map(n=>n.pitch)).size>=3);assert.ok(new Set(notes.map(n=>n.duration)).size>=2);}
   for(const n of notes){assert.ok(n.t>=0&&n.t<duration);assert.equal(n.rawT,n.t);assert.equal(n.quantize,'off');if(voice!=='drums')assert.ok(n.t+n.duration<=duration+1e-8);}
  }
  assert.deepEqual(D.damageChart('max',bpm,duration,[],enemy),max);
 }
});
test('development selector provides all seven well-formed preset options',()=>{
 const select=fs.readFileSync('index.html','utf8').match(/<select id="debugPreset">(.*?)<\/select>/s)[1];
 const values=[...select.matchAll(/<option value="([^"]+)">[^<]+<\/option>/g)].map(m=>m[1]);
 assert.deepEqual(values,['recorded','off','just','laidBack','snarePushed','drunk','swing']);
});
function fixture(){
 const offsets=[.04,-.03,.05,-.01,-.045,.025,-.015,.045];
 const drums=offsets.map((delta,i)=>({type:i%2?'snare':'kick',t:Math.max(0,i*.5+delta),rawT:i*.5+delta,inputT:i*.5+delta,quantize:'off'}));
 return {tracks:new Map([['drums',drums],['bass',drums.filter(n=>n.type==='kick').map(n=>({...n,midi:36,duration:.3}))],['lead',drums.filter(n=>n.type==='snare').map(n=>({...n,midi:60,duration:.2}))]]),hats:Array.from({length:8},(_,i)=>({type:'hat',t:i*.5,rawT:i*.5})),zones:[{type:'power',slots:[0,8,16]},{type:'shield',slots:[0,8,16]},{type:'boost',slots:[4,12,20]}],enemy:{kind:'stone',name:'岩'}};
}
test('development evaluation uses quantized positions in all raw-based analyzers',()=>{
 const f=fixture(),snapshot=JSON.stringify([...f.tracks]);
 const result=D.compare(f.tracks,f.hats,120,4,f.zones,f.enemy,'just');
 assert.ok(result.quantized.analysis.performanceQuality.multiplier>result.normal.analysis.performanceQuality.multiplier);
 assert.ok(result.quantized.analysis.performanceQuality.multiplier>result.normal.analysis.performanceQuality.multiplier*1.2);
 assert.ok(result.quantized.groove.tight>result.normal.groove.tight);
 assert.ok(result.quantized.parts.drums.every(n=>n.inputT===n.rawT&&n.inputTimes.length===1&&n.inputTimes[0]===n.rawT));
 assert.equal(JSON.stringify([...f.tracks]),snapshot);
 assert.deepEqual(D.compare(f.tracks,f.hats,120,4,f.zones,f.enemy,'just'),result);
});
test('normal comparison exactly reproduces the existing attack evaluation pipeline',()=>{
 const f=fixture(),drums=f.tracks.get('drums'),ensemble=E.analyze(f.tracks,120,4),lead=E.support(C.lead(f.tracks.get('lead'),120,4,f.zones,{references:{hat:f.hats,drums,bass:f.tracks.get('bass')}}),ensemble);
 const a=E.attack(C.enhance(G.enrich(R.analyze(Q.render(drums,120,4),4,120),G.analyzeRelations(drums,f.hats,120,4)),drums,120,f.zones,lead),ensemble);
 const bass=C.bass(f.tracks.get('bass'),drums,120,4,f.zones,{}, {references:{hat:f.hats}}),withPitch=require('./pitch-combat.js').apply(a,bass.pitch,lead.pitch);
 assert.deepEqual(D.compare(f.tracks,f.hats,120,4,f.zones,f.enemy).normal.result,R.resolve(withPitch,f.enemy));
});
test('merged quantized notes are evaluated once and original timing provenance stays intact',()=>{
 const tracks=new Map([['drums',[.01,.02,.04,.51,.52,.53].map(t=>({type:'kick',t,rawT:t,inputT:t,quantize:'just'}))]]);
 const result=D.compare(tracks,[],120,4,[],{kind:'machine'});
 assert.equal(result.normal.analysis.performanceQuality.count,6);assert.equal(result.quantized.analysis.performanceQuality.count,2);assert.equal(tracks.get('drums').length,6);
});
function ui(search){
 const nodes=new Map(),$=id=>{if(!nodes.has(id))nodes.set(id,{children:[],replaceChildren(){this.children=[]},append(...n){this.children.push(...n)},showModal(){this.open=true},close(){this.open=false},value:'recorded'});return nodes.get(id);};
 const sandbox=vm.createContext({location:{search,hash:''},URLSearchParams,document:{getElementById:$,createElement:()=>({children:[],append(...n){this.children.push(...n)}})},$,EvaluationDebug:D,GridEffects:require('./grid-effects.js'),elements:{earth:['土'],wind:['風'],fire:['火'],lightning:['雷']}});
 vm.runInContext(fs.readFileSync('evaluation-debug-ui.js','utf8'),sandbox);return {$,sandbox};
}
test('normal play hides development controls and installs no evaluation hook',()=>{
 const x=ui('');assert.equal(x.$('openDebug').hidden,true);assert.equal(x.sandbox.captureEvaluationDebug,undefined);
});
test('debug mode snapshots the recording context and displays a comparison',()=>{
 const x=ui('?debug=1'),f=fixture();assert.equal(x.$('openDebug').hidden,false);
 x.sandbox.captureEvaluationDebug({parts:[...f.tracks],hats:f.hats,bpm:120,duration:4,zones:f.zones,enemy:f.enemy});
 f.tracks.clear();f.zones.length=0; // Moving to another round must not change the saved context.
 x.$('openDebug').onclick();assert.equal(x.$('debugDialog').open,true);
 assert.match(x.$('debugResults').children[0].textContent,/岩.*120/);
 assert.ok(x.$('debugResults').children.some(n=>n.children?.[0]?.children?.[0]?.textContent==='評価項目'));
});
