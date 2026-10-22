const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const R=require('./rhythm.js'),F=require('./feedback.js');

test('damage details render real calculation and clear after non-attack results',()=>{
 const x=ui({getItem:()=>null,setItem(){}});x.run('renderReport(testReport);renderDamageCalculation(damageCalculation)');
 assert.equal(x.$('damageLabel').disabled,false);
 assert.match(x.$('damageCalculation').children[0].textContent,/DAMAGE/);
 const table=x.$('damageCalculation').children.find(n=>n.children?.[0]?.children?.[0]?.textContent==='打撃');assert.ok(table);
 assert.equal(table.children[0].children.length,2);
 const text=node=>[node.textContent,...(node.children??[]).map(text)].join(' ');
 assert.doesNotMatch(text(x.$('damageCalculation')),/抽選|振れ幅|MISS|variation|命中率|NaN|undefined|演奏の安定度/);
 assert.match(text(x.$('damageCalculation')),/リズム精度/);
 assert.match(text(x.$('damageCalculation')),/固定倍率/);
 assert.equal(table.children.length,x.run('testReport.calculation.hitDetails.length')+1);
 x.run('renderReport({...testReport,calculation:null})');assert.equal(x.$('damageLabel').disabled,true);assert.equal(x.run('damageCalculation'),null);
});
test('accuracy is visible for evaluated groove and clears for insufficient input',()=>{
 const x=ui({getItem:()=>null,setItem(){}});
 x.run(`const h=Array.from({length:16},(_,i)=>({type:'hat',t:i*.25}));
 const d=Array.from({length:8},(_,i)=>({type:i%2?'snare':'kick',inputT:i*.5+(i%2?-.03:0)}));
 renderReport({...testReport,timingGroove:Groove.analyzeRelations(d,h,120,4)});`);
 assert.match(x.$('timingAccuracy').textContent,/正確さ 100.0% · 前ノリスネア/);
 assert.match(x.$('performanceSummary').textContent,/平均誤差 0.0ms/);
 x.run(`renderReport({...testReport,partTiming:{bass:{score:90,own:{score:95},relations:[{voice:'drums',score:88,offsetMs:20}],multiplier:1.16}}});`);
 assert.equal(x.$('partTimingAccuracy').hidden,false);
 assert.match(x.$('partTimingAccuracy').textContent,/Bass 90.0%/);
 assert.match(x.$('partTimingSummary').textContent,/drumsとの間隔 88.0%.*盾・支援 ×1.16/);
 x.run(`renderReport({...testReport,partTiming:{bass:{score:100,own:{score:100},relations:[],multiplier:1.2,placement:{style:'behind',delayMs:30,errorMs:0}}}});`);
 assert.match(x.$('partTimingAccuracy').textContent,/後ノリ/);assert.match(x.$('partTimingSummary').textContent,/Kickより平均30.0ms後ろ/);
 x.run('renderReport(testReport)');assert.equal(x.$('timingAccuracy').textContent,'正確さ — 判定待ち');
 assert.equal(x.$('partTimingAccuracy').hidden,true);assert.equal(x.$('partTimingSummary').textContent,'');
});
function ui(storage){
 const elements=new Map();
 function el(){const classes=new Set();return {textContent:'',dataset:{},children:[],classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),toggle:(n,on)=>on?classes.add(n):classes.delete(n),contains:n=>classes.has(n)},setAttribute(){},replaceChildren(){this.children=[]},append(...kids){this.children.push(...kids)}};}
 const $=id=>{if(!elements.has(id))elements.set(id,el());return elements.get(id);};
 const sandbox=vm.createContext({$,document:{getElementById:$,createElement:el},localStorage:storage,Groove:require('./groove.js'),GridEffects:require('./grid-effects.js'),CombatFeedback:F,enemies:[{kind:'stone',name:'岩',description:'分厚い体。'}],stage:0,setTimeout(){},clearTimeout(){}});
 vm.runInContext(fs.readFileSync('feedback-ui.js','utf8'),sandbox);
 const a=R.analyze([{t:1.3,type:'kick'},{t:3.2,type:'kick'}]);sandbox.testReport=F.explain(a,R.resolve(a,{kind:'stone'},()=>0),{kind:'stone'});
 return {run:code=>vm.runInContext(code,sandbox),$};
}
test('weakness is saved exactly once on a damaging hit, with a special notice',()=>{
 let saved=null,writes=0;const x=ui({getItem:()=>null,setItem:(key,value)=>{saved=JSON.parse(value);writes++;}});
 x.run('activeReport=testReport;showHitFeedback(0)');assert.equal(writes,0);
 x.run('showHitFeedback(20)');assert.equal(writes,1);assert.ok(saved.stone.includes('heavy'));
 assert.match(x.$('discoveryToast').textContent,/弱点発見/);assert.match(x.$('discoveries').textContent,/重い一撃/);
 x.run('showHitFeedback(20)');assert.equal(writes,1);
 x.run('clearHitFeedback()');assert.equal(x.$('arena').classList.contains('weak-hit'),false);
});
test('storage failures retain discoveries for this play session',()=>{
 const x=ui({getItem(){throw Error('denied')},setItem(){throw Error('denied')}});
 x.run('activeReport=testReport;showHitFeedback(20)');
 assert.match(x.$('discoveries').textContent,/土属性/);
 assert.equal(x.run('discoveryStorageAvailable'),false);
});
test('stored discoveries restore and malformed records do not break gameplay',()=>{
 const x=ui({getItem:()=>JSON.stringify({stone:['heavy','invalid']}),setItem(){}});
 x.run('renderDiscoveries()');assert.match(x.$('discoveries').textContent,/重い一撃/);assert.doesNotMatch(x.$('discoveries').textContent,/invalid/);
 const invalid=ui({getItem:()=>'{broken',setItem(){}});invalid.run('renderDiscoveries()');assert.match(invalid.$('discoveries').textContent,/未発見/);
});

test('discoveries for new enemy kinds survive browser storage reload',()=>{
 const x=ui({getItem:()=>JSON.stringify({plant:['fire','invalid'],ghost:['laidBack'],crystal:['earth','chain']}),setItem(){}});
 assert.equal(x.run('knownWeaknesses.plant.join()'),'fire');assert.equal(x.run('knownWeaknesses.ghost.join()'),'laidBack');assert.equal(x.run('knownWeaknesses.crystal.join()'),'earth,chain');
});


test('ensemble feedback renders the reason, applied bonus and marked cells for all parts',()=>{
 const x=ui({getItem:()=>null,setItem(){}});
 x.run("renderEnsemble({selected:[{name:'GROOVE LOCK',reason:'Kick + Bassが3か所で同期',effect:'攻撃 +10% / 盾 +4',cells:[{voice:'drums',q:0},{voice:'bass',q:0}]}]},new Map([['drums',[{type:'kick',t:0}]],['bass',[{type:'kick',t:0}]]]),120)");
 assert.equal(x.$('ensembleList').children.length,1);assert.match(x.$('ensembleList').children[0].children[1].textContent,/攻撃 \+10%/);
 assert.equal(x.$('ensembleSequence').children.length,3);
 assert.equal(x.$('ensembleSequence').children.flatMap(row=>row.children).filter(cell=>cell.className?.includes('synergy-cell')).length,2);
 x.run("setResultPanel('ensemble')");assert.equal(x.$('result').dataset.panel,'ensemble');
});
test('ensemble feedback clears stale highlights for the next partial recording',()=>{
 const x=ui({getItem:()=>null,setItem(){}});x.run('renderEnsemble(null)');
 assert.match(x.$('ensembleList').children[0].textContent,/3パート/);assert.equal(x.$('ensembleSequence').children.length,0);
});
