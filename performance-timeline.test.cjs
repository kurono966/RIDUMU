const {test}=require('node:test'),assert=require('node:assert/strict'),T=require('./performance-timeline.js');
const kick={type:'kick',t:0},snare={type:'snare',t:.5},bass={type:'kick',t:.25,midi:36,duration:.4},lead={type:'snare',t:.75,midi:67};
test('Bass and Lead retain the recorded reference parts in five distinct lanes',()=>{
 const tracks=new Map([['drums',[kick,snare]],['bass',[bass]]]);
 const lanes=T.model({tracks,hats:[{type:'hat',t:0}],notes:[lead],live:true,voice:'lead'});
 assert.deepEqual(lanes.map(l=>l.id),['hat','kick','snare','bass','lead']);
 assert.deepEqual(lanes.map(l=>l.notes.length),[1,1,1,1,1]);
 assert.deepEqual(lanes.filter(l=>l.active).map(l=>l.id),['lead']);
 assert.equal(lanes[3].notes[0],bass);assert.equal(lanes[4].notes[0],lead);
 assert.equal(tracks.has('lead'),false);assert.deepEqual(kick,{type:'kick',t:0});
});
test('live input replaces the previous take even before the first new note',()=>{
 const tracks=new Map([['drums',[kick,snare]],['bass',[bass]]]);
 const lanes=T.model({tracks,live:true,voice:'bass',notes:[]});
 assert.equal(lanes[3].notes.length,0);assert.equal(lanes[1].notes.length,1);
 assert.deepEqual(T.model({tracks,live:true,voice:'drums'}).filter(l=>l.active).map(l=>l.id),['kick','snare']);
 assert.deepEqual(T.model({live:true,phase:'hat'}).filter(l=>l.active).map(l=>l.id),['hat']);
});
test('reference notes follow rendered backing timing while live input stays raw',()=>{
 const lanes=T.model({tracks:new Map([['drums',[kick]]]),hats:[kick],voice:'bass',live:true,notes:[bass],render:ns=>ns.map(n=>({...n,t:n.t+.1}))});
 assert.equal(lanes[1].notes[0].t,.1);assert.equal(lanes[0].notes[0].t,.1);assert.equal(lanes[3].notes[0].t,.25);assert.equal(kick.t,0);
});
test('attack and replay use their saved mix rather than the next live take',()=>{
 const lanes=T.model({tracks:new Map([['bass',[bass]]]),mix:[{voice:'lead',notes:[lead]}]});
 assert.equal(lanes[3].notes.length,0);assert.equal(lanes[4].notes[0],lead);assert(lanes.every(l=>!l.active));
});
test('all five lanes share time coordinates and long notes stay within the phrase',()=>{
 const g=T.geometry(1280,150,4);
 assert.equal(g.x(0),64);assert.equal(g.x(4),1278);assert.equal(g.x(6),1278);assert.equal(g.x(-1),64);
 assert.deepEqual([0,1,2,3,4].map(g.center),[15,45,75,105,135]);
 const lane={id:'bass',notes:[{midi:36},{midi:48}]};
 assert.equal(T.noteY(lane,3,g,lane.notes[0]),112.875);
 assert.equal(T.noteY(lane,3,g,lane.notes[1]),97.125);
 assert.equal(T.noteY(lane,3,g,lane.notes[1],n=>n.midi,[36,48]),97.125);
});
