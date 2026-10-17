const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function game(){
 const elements=new Map();
 const document={getElementById(id){if(!elements.has(id))elements.set(id,{addEventListener(){}});return elements.get(id);},addEventListener(){}};
 const sandbox=vm.createContext({document,setTimeout(){},clearTimeout(){}});
 vm.runInContext(fs.readFileSync('game.js','utf8').split("const canvas=$('scope')")[0],sandbox);
 vm.runInContext("ctx={currentTime:10,state:'running'};recordAudioAt=10;state='countin';sound=()=>{};flash=()=>{};",sandbox);
 return {run:code=>vm.runInContext(code,sandbox)};
}
test('anticipated downbeat is recorded during count-in with raw timing preserved',()=>{
 const g=game();g.run("ctx.currentTime=9.9;input('kick')");
 assert.equal(g.run('notes.length'),1);assert.equal(g.run('notes[0].t'),0);
 assert.ok(Math.abs(g.run('notes[0].rawT')+.1)<1e-9);
});
test('first beat is accepted even before the UI timer changes state',()=>{
 const g=game();g.run("ctx.currentTime=10.001;input('snare')");
 assert.equal(g.run('notes.length'),1);assert.ok(g.run('notes[0].t')>0);
});
test('final count-in rimshot and the rest of that beat are accepted',()=>{
 const g=game();g.run("ctx.currentTime=9.5;input('kick');ctx.currentTime=9.7;input('snare')");
 assert.equal(g.run('notes.length'),2);
 assert.equal(g.run('notes[0].rawT'),-.5);
});
test('earlier count-in beats and inputs at the end are excluded',()=>{
 const g=game();g.run("ctx.currentTime=9.499;input('kick');ctx.currentTime=14;input('snare')");
 assert.equal(g.run('notes.length'),0);
});
test('rapid opening notes are all retained and preserve their spacing',()=>{
 const g=game();g.run("[9.89,9.96,10.03,10.1].forEach(t=>{ctx.currentTime=t;input('snare')})");
 assert.equal(g.run('notes.length'),4);
 assert.ok(Math.abs(g.run('notes[1].rawT-notes[0].rawT')-.07)<1e-9);
});
