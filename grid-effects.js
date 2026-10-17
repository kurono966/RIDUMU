/* Beneficial grid effects are independent of playback quantization and hazards. */
(function(root){
 const definitions=new Map([
  ['power',{role:'drums',label:'POWER',color:'#ffae75'}],
  ['shield',{role:'bass',label:'SHIELD',color:'#8edcdd'}],
  ['boost',{role:'lead',label:'BOOST',color:'#c5adff'}]
 ]);
 const extensionTypes=['poison','mute','delay','echo','break','heal','forceQuantize'];
 function register(type,definition){definitions.set(type,{...definition});}
 function slot(note,bpm){return Math.max(0,Math.min(31,Math.round((note.inputT??note.rawT??note.t)/(60/bpm/4))));}
 function create(round=1,enemyIndex=0){
  const shift=((round-1)*5+enemyIndex*3)%32;
  return ['power','shield','boost'].map((type,i)=>({type,slots:[2+i*3,13+i*3,24+i*2].map(q=>(q+shift)%32)}));
 }
 function inspect(notes,role,zones,bpm){
  const occupied=new Set(notes.map(n=>slot(n,bpm))),result={};
  for(const zone of zones){const d=definitions.get(zone.type);if(!d||d.role!==role)continue;
   result[zone.type]=(result[zone.type]??0)+zone.slots.filter(q=>occupied.has(q)).length;
  }return result;
 }
 const api={definitions,extensionTypes,register,slot,create,inspect};root.GridEffects=api;
 if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
