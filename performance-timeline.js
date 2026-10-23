/* Presentation only. Never modifies recorded notes, timing or combat analysis. */
(function(root){
 'use strict';
 const definitions=[['hat','HI-HAT','#e5cb82'],['kick','KICK','#d4f77d'],['snare','SNARE','#efa568'],['bass','BASS','#8edcdd'],['lead','LEAD','#c6b0ff']];
 const left=64;
 function model({tracks=new Map(),hats=[],notes=[],voice='drums',phase='parts',live=false,mix=null,render=ns=>ns}={}){
  const parts=mix?new Map(mix.map(track=>[track.voice,track.notes])):new Map([...tracks].map(([id,ns])=>[id,render(ns)]));
  if(!mix)parts.set('hat',render(hats));
  if(live)parts.set(phase==='hat'?'hat':voice,notes);
  const current=live?(phase==='hat'?'hat':voice):null;
  return definitions.map(([id,label,color])=>{
   const source=id==='kick'||id==='snare'?'drums':id;
   const values=parts.get(source)??[];
   return {id,label,color,active:current===source,notes:source==='drums'?values.filter(n=>n.type===id):values};
  });
 }
 function geometry(width,height,duration){
  const span=Math.max(1,width-left-2),row=height/5;
  return {left,row,x:time=>left+span*Math.max(0,Math.min(1,time/duration)),center:index=>(index+.5)*row};
 }
 function draw(p,width,height,{lanes,duration,held=[],now=0,recordAt=0,midi=n=>n.midi,selected=null}={}){
  const g=geometry(width,height,duration);
  p.save();
  lanes.forEach((lane,index)=>{
   const top=index*g.row,center=g.center(index);
   p.fillStyle=lane.active?'#d4f77d0c':index%2?'#ffffff03':'#00000008';p.fillRect(0,top,width,g.row);
   p.strokeStyle='#46513c';p.lineWidth=.5;p.beginPath();p.moveTo(0,top+g.row);p.lineTo(width,top+g.row);p.stroke();
   p.fillStyle='#141b12';p.fillRect(0,top,left-3,g.row);
   if(lane.active){p.fillStyle=lane.color;p.fillRect(0,top,3,g.row);}
   p.font=(lane.active?'bold ':'')+'9px Arial';p.fillStyle=lane.active?lane.color:lane.notes.length?'#b5c0ab':'#67715f';p.fillText(lane.label,7,center+3);
   p.save();p.beginPath();p.rect(left,top,width-left,g.row);p.clip();
   const melodic=['bass','lead'].includes(lane.id),pitched=lane.notes.map(n=>midi(n,lane.id)).filter(Number.isFinite);
   const low=Math.min(...pitched),high=Math.max(...pitched);
   const y=n=>melodic?center-(Number.isFinite(n.register)?n.register-.5:high>low?(midi(n,lane.id)-low)/(high-low)-.5:0)*Math.max(0,g.row-9)*.75:center;
   p.globalAlpha=lane.active?1:.55;
   if(melodic){
    p.strokeStyle=lane.color;p.lineWidth=1;p.setLineDash(lane.active?[]:[2,3]);
    const ordered=[...lane.notes].sort((a,b)=>a.t-b.t);
    p.beginPath();ordered.forEach((n,i)=>{if(i)p.lineTo(g.x(n.t),y(n));else p.moveTo(g.x(n.t),y(n));});p.stroke();p.setLineDash([]);
   }
   lane.notes.forEach((n,index)=>{
    if(!Number.isFinite(n.t)||n.t<0||n.t>=duration)return;
    const x=g.x(n.t),atY=y(n),holding=lane.active?held.find(v=>v.note===n):null;
    const gate=holding?Math.max(0,Math.min(now,recordAt+duration)-holding.at):Math.max(0,n.duration??0);
    p.fillStyle=selected?.voice===lane.id&&selected.indices.includes(index)?'#fff':lane.color;p.strokeStyle=p.fillStyle;
    if(gate>0)p.fillRect(x,atY-2,Math.max(2,g.x(n.t+gate)-x),4);
    if(lane.active){p.beginPath();p.arc(x,atY,3,0,Math.PI*2);p.fill();}
    else{p.lineWidth=1.5;p.strokeRect(x-2.5,atY-2.5,5,5);}
    if(melodic&&g.row>=25&&width>=700){const pitch=midi(n,lane.id);if(Number.isFinite(pitch)){p.font='9px Arial';p.fillText(['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'][pitch%12]+(Math.floor(pitch/12)-1),x+5,atY-4);}}
   });p.restore();
  });p.restore();return g;
 }
 const api={model,geometry,draw,left};root.PerformanceTimeline=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
