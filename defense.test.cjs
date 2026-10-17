const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('./defense.js');
test('enemy note patterns use their BPM, distinct grooves, and preserve the attack damage budget',()=>{
 const cases=[['stone',82,3],['fly',150,6],['machine',120,4]];
 for(const [kind,bpm,count] of cases){
  const b=D.create(kind,bpm,1,17);
  assert.equal(b.events.length,count);assert.equal(b.leadIn,240/bpm);
  assert.equal(b.events.reduce((s,n)=>s+n.baseDamage,0),17);
  assert.ok(b.events.every(n=>n.at>=b.leadIn&&n.at<b.leadIn+240/bpm));
  assert.notDeepEqual(b.events.map(n=>n.type),D.create(kind,bpm,2,17).events.map(n=>n.type));
 }
});
test('no input takes exactly the original attack damage once',()=>{
 const b=D.create('stone',82,1,12);assert.deepEqual(D.advance(b,0),[]);
 assert.equal(D.advance(b,b.duration).reduce((s,n)=>s+n.damage,0),12);
 assert.deepEqual(D.advance(b,b.duration+1),[]);assert.equal(D.summary(b).counts.MISS,3);
});
test('perfect defense on every note prevents all damage',()=>{
 for(const [kind,bpm] of [['stone',82],['fly',150],['machine',120]]){
  const b=D.create(kind,bpm,1,16);
  for(const n of b.events)assert.equal(D.press(b,n.type,n.at).grade,'PERFECT');
  D.advance(b,b.duration);assert.equal(b.damage,0);assert.equal(D.summary(b).prevented,16);
 }
});
test('early and late taps use symmetric real-time windows without quantization',()=>{
 for(const [offset,grade] of [[-.05,'PERFECT'],[.05,'PERFECT'],[-.11,'GOOD'],[.11,'GOOD'],[-.17,'GUARD'],[.17,'GUARD']]){
  const b=D.create('machine',120,1,16),n=b.events[0];
  assert.equal(D.press(b,n.type,n.at+offset).grade,grade);
 }
 const b=D.create('machine',120,1,16);assert.equal(D.press(b,'kick',b.events[0].at-.171),null);
});
test('wrong lanes and extra taps cannot consume or upgrade another note',()=>{
 const b=D.create('machine',120,1,16),n=b.events[0];
 assert.equal(D.press(b,'snare',n.at).grade,'EMPTY');assert.equal(n.grade,null);
 assert.equal(D.press(b,'kick',n.at-.16).grade,'GUARD');
 assert.equal(D.press(b,'kick',n.at).grade,'EMPTY');assert.equal(n.grade,'GUARD');
 assert.equal(D.press(b,'hat',n.at),null);
});
test('rapid retries are ignored and grades produce different damage reductions',()=>{
 const b=D.create('machine',120,1,16);
 assert.equal(D.press(b,'kick',b.events[2].at-.18).grade,'EMPTY');
 assert.equal(D.press(b,'kick',b.events[2].at-.1),null);
 D.press(b,'snare',b.events[1].at+.08);D.press(b,'kick',b.events[2].at+.14);D.press(b,'snare',b.events[3].at);
 const hits=D.advance(b,b.duration);assert.deepEqual(hits.map(n=>n.damage),[4,1,2,0]);
 assert.equal(D.summary(b).damage,7);assert.equal(D.summary(b).prevented,9);
});

test('new enemy types have distinct patterns, turn variants and exact increased damage budgets',()=>{
 const types=[['plant',100,34,5],['ghost',72,32,3],['crystal',138,40,6]];
 const patterns=[];
 for(const [kind,bpm,damage,count] of types){
  const b=D.create(kind,bpm,1,damage);assert.equal(b.events.length,count);
  assert.equal(b.events.reduce((s,n)=>s+n.baseDamage,0),damage);
  assert.ok(b.events.every(n=>n.at>=b.leadIn&&n.at<b.leadIn+4*b.beat));
  patterns.push(JSON.stringify(b.events.map(n=>[n.type,(n.at-b.leadIn)/b.beat])));
  assert.notDeepEqual(b.events.map(n=>n.type),D.create(kind,bpm,2,damage).events.map(n=>n.type));
  D.advance(b,b.duration);assert.equal(D.summary(b).damage,damage);
  const perfect=D.create(kind,bpm,1,damage);for(const n of perfect.events)D.press(perfect,n.type,n.at);D.advance(perfect,perfect.duration);assert.equal(perfect.damage,0);
 }
 assert.equal(new Set(patterns).size,3);
});
