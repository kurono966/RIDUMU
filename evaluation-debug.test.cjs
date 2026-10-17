const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const D=require('./evaluation-debug.js'),R=require('./rhythm.js'),G=require('./groove.js'),Q=require('./quantize.js'),C=require('./performance-combat.js'),E=require('./ensemble.js');
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
 const f=fixture(),drums=f.tracks.get('drums'),ensemble=E.analyze(f.tracks,120,4),lead=E.support(C.lead(f.tracks.get('lead'),120,4,f.zones),ensemble);
 const a=E.attack(C.enhance(G.enrich(R.analyze(Q.render(drums,120,4),4,120),G.analyzeRelations(drums,f.hats,120,4)),drums,120,f.zones,lead),ensemble);
 assert.deepEqual(D.compare(f.tracks,f.hats,120,4,f.zones,f.enemy).normal.result,R.resolve(a,f.enemy));
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
