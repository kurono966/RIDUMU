const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const R=require('./rhythm.js'),F=require('./feedback.js');
function ui(storage){
 const elements=new Map();
 function el(){const classes=new Set();return {textContent:'',dataset:{},children:[],classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),toggle:(n,on)=>on?classes.add(n):classes.delete(n),contains:n=>classes.has(n)},setAttribute(){},replaceChildren(){this.children=[]},append(...kids){this.children.push(...kids)}};}
 const $=id=>{if(!elements.has(id))elements.set(id,el());return elements.get(id);};
 const sandbox=vm.createContext({$,document:{getElementById:$,createElement:el},localStorage:storage,CombatFeedback:F,enemies:[{kind:'stone',name:'岩',description:'分厚い体。'}],stage:0,setTimeout(){},clearTimeout(){}});
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
