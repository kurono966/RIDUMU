/* Enemy notes use the audio clock; playback quantization never changes guard input. */
(function(root){
const patterns={
 stone:[[[0,'kick'],[1.5,'kick'],[3,'snare']],[[0,'kick'],[2,'snare'],[3,'kick']]],
 fly:[[[0,'kick'],[.5,'snare'],[1,'kick'],[2,'snare'],[2.5,'kick'],[3,'snare']],[[0,'snare'],[1,'kick'],[1.5,'snare'],[2,'kick'],[3,'snare'],[3.5,'kick']]],
 plant:[[[0,'kick'],[.75,'snare'],[1.5,'kick'],[3,'snare'],[3.5,'snare']],[[0,'snare'],[.75,'kick'],[2,'snare'],[2.75,'kick'],[3.5,'kick']]],
 ghost:[[[0,'snare'],[1.75,'kick'],[3.25,'snare']],[[0,'kick'],[1.25,'snare'],[3.25,'kick']]],
 crystal:[[[0,'kick'],[.5,'kick'],[1,'snare'],[2,'snare'],[2.5,'kick'],[3.5,'snare']],[[0,'snare'],[.5,'snare'],[1,'kick'],[2,'kick'],[2.5,'snare'],[3.5,'kick']]],
 machine:[[[0,'kick'],[1,'snare'],[2,'kick'],[3,'snare']],[[0,'snare'],[1,'kick'],[2,'snare'],[3,'kick']]]
};
const windows={perfect:.05,good:.11,guard:.17};
const reductions={PERFECT:0,GOOD:.25,GUARD:.6,MISS:1};
function create(kind,bpm,turn,damage){
 const beat=60/bpm,leadIn=4*beat,choices=patterns[kind]??patterns.machine,pattern=choices[(Math.max(1,turn)-1)%choices.length];
 const total=Math.max(0,Math.round(damage)),base=Math.floor(total/pattern.length),extra=total%pattern.length;
 return {beat,leadIn,duration:leadIn+4*beat+windows.guard+.12,lastPress:{kick:-Infinity,snare:-Infinity},
  events:pattern.map(([position,type],i)=>({at:leadIn+position*beat,type,baseDamage:base+(i<extra?1:0),grade:null,settled:false})),total,damage:0};
}
function press(battle,type,time){
 if(!['kick','snare'].includes(type)||time<battle.leadIn-windows.guard||time>battle.duration)return null;
 // Each tap may guard one note; repeated taps cannot retry an already judged note.
 if(time-battle.lastPress[type]<.12-1e-9)return null;
 battle.lastPress[type]=time;
 const event=battle.events.filter(n=>n.type===type&&!n.grade&&!n.settled&&Math.abs(n.at-time)<=windows.guard+1e-9).sort((a,b)=>Math.abs(a.at-time)-Math.abs(b.at-time))[0];
 if(!event)return {grade:'EMPTY'};
 const offset=time-event.at,error=Math.abs(offset);
 event.grade=error<=windows.perfect+1e-9?'PERFECT':error<=windows.good+1e-9?'GOOD':'GUARD';event.offset=offset;
 return {event,grade:event.grade,offset};
}
function advance(battle,time){
 const resolved=[];
 for(const event of battle.events){
  if(event.settled||time<event.at+windows.guard-1e-9)continue;
  event.grade??='MISS';event.settled=true;
  const damage=Math.round(event.baseDamage*reductions[event.grade]);battle.damage+=damage;resolved.push({event,damage});
 }
 return resolved;
}
function summary(battle){
 const counts={PERFECT:0,GOOD:0,GUARD:0,MISS:0};battle.events.forEach(n=>{if(n.grade)counts[n.grade]++;});
 return {counts,damage:battle.damage,prevented:battle.total-battle.damage,total:battle.total};
}
root.Defense={create,press,advance,summary,windows};if(typeof module!=='undefined')module.exports=root.Defense;
})(typeof window!=='undefined'?window:globalThis);
