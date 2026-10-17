/* Pure grid interventions. Resolvers return effects; the game applies them. */
(function(root){
const copy=value=>JSON.parse(JSON.stringify(value));
const types=Object.freeze(['poison','mute','delay','forceQuantize','echo','shieldBreak']);
function create(slots=32){
 let items=[],turn=1,serial=0;
 const resolvers=new Map();
 function register(type,resolver){if(typeof type!=='string'||typeof resolver!=='function')throw Error('Invalid grid hazard resolver');resolvers.set(type,resolver);}
 register('poison',({hazards})=>[{kind:'damage',type:'poison',amount:Math.max(...hazards.map(h=>h.power))}]);
 function add(spec){
  const cells=[...new Set(spec.slots??[])].filter(s=>Number.isInteger(s)&&s>=0&&s<slots);
  if(!cells.length||!Number.isInteger(spec.turns)||spec.turns<1||typeof spec.type!=='string'||(spec.power!==undefined&&!Number.isFinite(spec.power))||(spec.radiusSlots!==undefined&&!Number.isFinite(spec.radiusSlots)))throw Error('Invalid grid hazard');
  const from=spec.fromTurn??turn;
  if(!Number.isInteger(from)||from<turn)throw Error('Invalid hazard start turn');
  const params=spec.params??{};if(typeof params!=='object'||Array.isArray(params))throw Error('Invalid hazard parameters');
  const hazard={params:copy(params),id:'grid-'+(++serial),type:spec.type,slots:cells,fromTurn:from,expiresTurn:from+spec.turns,power:Math.max(0,Math.round(spec.power??3)),radiusSlots:Math.max(.5,Math.min(2,spec.radiusSlots??.75)),targets:[...(spec.targets??['kick','snare','hat'])],source:String(spec.source??'')};
  items.push(hazard);return hazard.id;
 }
 function active(atTurn=turn){return items.filter(h=>h.fromTurn<=atTurn&&atTurn<h.expiresTurn).map(h=>({...h,params:copy(h.params),slots:[...h.slots],targets:[...h.targets],remainingTurns:h.expiresTurn-atTurn}));}
 function advanceToTurn(next){if(!Number.isInteger(next)||next<turn)throw Error('Grid hazard turns must move forward');turn=next;items=items.filter(h=>h.expiresTurn>turn);}
 function onInput(input){
  const {rawT,bpm,type}=input;
  if(!Number.isFinite(rawT)||!Number.isFinite(bpm)||bpm<=0)return {slot:null,position:null,hits:[],effects:[]};
  const position=rawT/(60/bpm/4),slot=Math.round(position);
  const hits=active().filter(h=>h.targets.includes(type)&&h.slots.some(s=>Math.abs(position-s)<=h.radiusSlots+1e-9));
  const effects=[];
  for(const hazardType of new Set(hits.map(h=>h.type))){const resolver=resolvers.get(hazardType);if(resolver)effects.push(...resolver({hazards:hits.filter(h=>h.type===hazardType),rawT,bpm,position,slot,inputType:type,input:{...input}}));}
  return {slot,position,hits,effects};
 }
 function reset(){items=[];turn=1;}
 return {add,active,advanceToTurn,onInput,register,reset,get turn(){return turn;}};
}
const api={create,types};root.GridHazards=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
