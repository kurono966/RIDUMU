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
function ui(storage){
 const elements=new Map();
 function el(){const classes=new Set();return {textContent:'',dataset:{},children:[],classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),toggle:(n,on)=>on?classes.add(n):classes.delete(n),contains:n=>classes.has(n)},setAttribute(){},replaceChildren(){this.children=[]},append(...kids){this.children.push(...kids)}};}
 const $=id=>{if(!elements.has(id))elements.set(id,el());return elements.get(id);};
 const sandbox=vm.createContext({$,document:{getElementById:$,createElement:el},localStorage:storage,GridEffects:require('./grid-effects.js'),CombatFeedback:F,enemies:[{kind:'stone',name:'岩',description:'分厚い体。'}],stage:0,setTimeout(){},clearTimeout(){}});
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
