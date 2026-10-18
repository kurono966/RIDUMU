const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const H=require('./sequence-history.js');
function fixture(){
 const elements=new Map(),blobs=[],links=[],calls=[],released=[],timers=new Map();let clock=0,stored=null;
 const element=()=>({children:[],open:false,textContent:'',replaceChildren(){this.children=[]},append(...nodes){this.children.push(...nodes)},addEventListener(name,fn){this[name]=fn},click(){this.onclick?.()},remove(){}});
 const $=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 const sandbox=vm.createContext({$,document:{createElement:element,body:{append:node=>links.push(node)}},SequenceHistory:H,Rhythm:require('./rhythm.js'),localStorage:{getItem:()=>stored,setItem:(k,v)=>stored=v},state:'ready',hp:100,enemyHp:150,ctx:{currentTime:0,resume:()=>Promise.resolve()},audio(){},releaseAllInputs(){},stopReplay(){},sound(...args){calls.push(args);return {release(){released.push(args)}}},DrumAudio:{ready:Promise.resolve(true),duration:()=>.5},setInterval(fn){timers.set(++clock,fn);return clock},clearInterval(id){timers.delete(id)},setTimeout(){},Blob,URL:{createObjectURL(blob){blobs.push(blob);return 'blob:test'},revokeObjectURL(){}}});
 vm.runInContext(fs.readFileSync('history-ui.js','utf8'),sandbox);vm.runInContext('stopReplay=()=>stopHistoryPlayback()',sandbox);
 return {$,calls,released,blobs,links,run:code=>vm.runInContext(code,sandbox),tick(){for(const fn of [...timers.values()])fn()}};
}
const info=()=>({bpm:120,duration:4,title:'テスト演奏',enemy:'岩',turn:3,tracks:[{voice:'bass',notes:[{type:'kick',t:.2,midi:45,duration:.7}]},{voice:'chord',notes:[{type:'kick',t:.8,duration:.32,pitches:[64,67,71,74]}]}]});
test('history capture lists snapshots and exported MIDI/JSON can be saved',async()=>{
 const x=fixture();x.run('captureHistory('+JSON.stringify(info())+');renderHistory()');assert.equal(x.$('historyList').children.length,1);
 x.run("downloadSequence(sequenceStore.list()[0],'mid')");assert.match(x.links[0].download,/\.mid$/);assert.equal(x.blobs[0].type,'audio/midi');assert.equal(Buffer.from(await x.blobs[0].arrayBuffer()).subarray(0,4).toString(),'MThd');
 x.run("downloadSequence(sequenceStore.list()[0],'json')");assert.equal(JSON.parse(await x.blobs[1].text()).tracks[0].notes[0].midi,45);
});
test('history playback preserves held notes and historical chord pitches without affecting combat',async()=>{
 const x=fixture();x.run('captureHistory('+JSON.stringify(info())+');$("historyDialog").open=true');
 await x.run('playHistory(sequenceStore.list()[0])');x.run('ctx.currentTime=.2');x.tick();x.run('ctx.currentTime=.8');x.tick();
 assert.equal(x.calls[0][2],'bass');assert.equal(x.calls[0][4],.7);assert.equal(x.calls[0][6],45);assert.equal(x.calls[1][2],'chord');assert.deepEqual([...x.calls[1][7]],[64,67,71,74]);
 assert.equal(x.run('hp'),100);assert.equal(x.run('enemyHp'),150);assert.equal(x.run('state'),'ready');x.run('stopHistoryPlayback()');assert.equal(x.released.length,2);assert.equal(x.run('historyPlaying'),null);
});

test('history replay starts its saved accompaniment on the grid downbeat and stops it with playback',async()=>{
 const x=fixture(),saved=require('./enemy-music.js').snapshot('ghost',120),data=info();data.accompaniment=saved;data.tracks[0].notes[0]={type:'kick',t:0,rawT:-.1,midi:45,duration:.7};
 x.run('let musicCalls=[],musicStops=[];globalThis.startSavedMusic=(...args)=>musicCalls.push(args);globalThis.stopSavedMusic=owner=>musicStops.push(owner);captureHistory('+JSON.stringify(data)+')');
 await x.run('playHistory(sequenceStore.list()[0])');assert.equal(x.run('musicCalls[0][0].tone.wave'),'sine');assert.ok(Math.abs(x.run('musicCalls[0][1]')-.16)<1e-9);assert.equal(x.run('musicCalls[0][3]'),'history');
 assert.ok(Math.abs(x.run('musicCalls[0][2]')-4.16)<1e-9);x.run('stopHistoryPlayback()');assert.equal(x.run('musicStops.at(-1)'),'history');
});
test('JSON import restores a sequence and rejects unrelated or oversized files',async()=>{
 const x=fixture(),entry=H.snapshot(info());x.$('historyImport').files=[{size:100,text:async()=>JSON.stringify(entry)}];await x.run('$("historyImport").onchange()');assert.equal(x.run('sequenceStore.list().length'),1);
 x.$('historyImport').files=[{size:100,text:async()=>'{"version":999}'}];await x.run('$("historyImport").onchange()');assert.equal(x.run('sequenceStore.list().length'),1);assert.match(x.$('historyMessage').textContent,/RIDUMU/);
 x.$('historyImport').files=[{size:6*1024*1024}];await x.run('$("historyImport").onchange()');assert.match(x.$('historyMessage').textContent,/5MB/);
});

test('an invalid optional history snapshot cannot interrupt gameplay',()=>{
 const x=fixture();assert.doesNotThrow(()=>x.run('captureHistory('+JSON.stringify({...info(),bpm:0})+')'));assert.equal(x.run('state'),'ready');assert.equal(x.run('sequenceStore.list().length'),0);
});
