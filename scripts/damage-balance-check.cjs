// Compare independently optimized elemental charts using the same candidate budget.
const fs=require('node:fs');
const D=require('../evaluation-debug.js');
const C=require('../performance-combat.js');
const enemies=[['stone',82,.2],['fly',150,0],['machine',120,.25],['plant',100,0],['ghost',72,0],['crystal',138,.3],['furnace',108,.15],['conductor',126,.18]];
const rows=[];
for(const intent of ['normal','guard','heavy','pierce','heal','buff'])for(const [kind,bpm,guard] of enemies){
 const enemy={kind,guard,...(intent==='normal'?{}:{intentId:intent})},charts={};
 for(const element of ['earth','wind','fire','lightning']){
  const chart=D.damageChart('max',bpm,480/bpm,[],enemy,{element});
  const fullEnemy={...enemy,hp:280,attack:100,attackCap:160};
  const evaluated=D.compare(chart.parts,chart.hats,bpm,480/bpm,[],fullEnemy).normal;
  const action={id:intent,pierce:intent==='pierce'?.4:0};
  const impact=['guard','heal','buff'].includes(intent)?C.enemyAction(fullEnemy,100,action,evaluated.tactics):C.counterAttack(100,evaluated.shield,100*(intent==='heavy'?1.2:intent==='pierce'?.86:1.06),action,C.reduction(evaluated.lead,evaluated.bass,evaluated.ensemble,evaluated.analysis).total,evaluated.tactics);
  charts[element]={total:chart.total,shield:evaluated.shield,interference:evaluated.tactics.value,impact,parts:Object.fromEntries(chart.parts)};
 }
 const damage=Object.fromEntries(Object.entries(charts).map(([element,chart])=>[element,chart.total]));
 rows.push({kind,bpm,guard,intent,damage,best:Object.keys(damage).reduce((a,b)=>damage[a]>=damage[b]?a:b),charts});
}
if(process.argv[2]){
 const compact=rows.map(row=>({...row,charts:Object.fromEntries(Object.entries(row.charts).map(([element,chart])=>[element,{...chart,parts:Object.fromEntries(Object.entries(chart.parts).map(([voice,notes])=>[voice,notes.map(n=>[Number((n.t/(60/row.bpm/4)).toFixed(3)),n.type,...(voice==='drums'?[]:[n.pitch,Number((n.duration/(60/row.bpm/4)).toFixed(3))])])]))}]))}));
 fs.writeFileSync(process.argv[2],JSON.stringify({scope:'Structured damage-optimal candidates; no synth/filter modifiers. Tactical probe uses enemy hp=280, current hp=100, attack=100; not a whole-run simulation. Notes: [sixteenth slot, type, pitch index, duration in sixteenths]',rows:compact})+'\n');
}
console.table(rows.map(({kind,intent,damage,best})=>({kind,intent,...damage,best})));
