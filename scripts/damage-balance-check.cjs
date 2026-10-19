// Compare independently optimized elemental charts using the same candidate budget.
const fs=require('node:fs');
const D=require('../evaluation-debug.js');
const enemies=[['stone',82,.2],['fly',150,0],['machine',120,.25],['plant',100,0],['ghost',72,0],['crystal',138,.3]];
const rows=[];
for(const intent of ['normal','guard','heavy','pierce','heal','buff'])for(const [kind,bpm,guard] of enemies){
 const enemy={kind,guard,...(intent==='normal'?{}:{intentId:intent})},charts={};
 for(const element of ['earth','wind','fire','lightning']){
  const chart=D.damageChart('max',bpm,480/bpm,[],enemy,{element});
  charts[element]={total:chart.total,parts:Object.fromEntries(chart.parts)};
 }
 const damage=Object.fromEntries(Object.entries(charts).map(([element,chart])=>[element,chart.total]));
 rows.push({kind,bpm,guard,intent,damage,best:Object.keys(damage).reduce((a,b)=>damage[a]>=damage[b]?a:b),charts});
}
if(process.argv[2]){
 const compact=rows.map(row=>({...row,charts:Object.fromEntries(Object.entries(row.charts).map(([element,chart])=>[element,{total:chart.total,parts:Object.fromEntries(Object.entries(chart.parts).map(([voice,notes])=>[voice,notes.map(n=>[Number((n.t/(60/row.bpm/4)).toFixed(3)),n.type,...(voice==='drums'?[]:[n.pitch,Number((n.duration/(60/row.bpm/4)).toFixed(3))])])]))}]))}));
 fs.writeFileSync(process.argv[2],JSON.stringify({scope:'Structured candidates; no synth/filter modifiers. Notes: [sixteenth slot, type, pitch index, duration in sixteenths]',rows:compact})+'\n');
}
console.table(rows.map(({kind,intent,damage,best})=>({kind,intent,...damage,best})));
