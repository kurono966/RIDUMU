const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {patterns,drums,parts,packet}=require('./audit-balance.cjs');
const {create}=require('./audit-game.cjs'),R=require('../rhythm'),G=require('../groove'),S=require('../synth'),Review=require('../performance-review');
const root=path.resolve(__dirname,'..'),game=create(),roster=game.roster();
const timing=[],tone=[],matches=[];
async function main(){
 const single=JSON.parse(fs.readFileSync(path.join(root,(process.env.RIDUMU_AUDIT_DIR||'balance-after'),'single-turn.json'),'utf8'));
 for(const row of single.matrix){
  const index=roster.findIndex(e=>e.kind===row.enemy),enemy=roster[index],p=patterns.find(p=>p.id===row.pattern);
  game.reset(index,100,1,row.intent);const value=Review.evaluate(packet(enemy,game.state().intent,parts(p,enemy.bpm)));
  assert.equal(value.result.total,row.damage);assert.equal(value.shield,row.shield);assert.equal(value.received.damage,row.received);assert.equal(value.analysis.element,row.element);assert.deepEqual(value.analysis.tactics,row.tactics);
 }
 for(const bpm of [72,82,100,108,120,126,138,150,180])for(const id of ['alternate_1','dense_K','dense_S','swing_'+(1/6),'drunk_1','jitter_1','late_0','late_2'])for(const hatGrid of [2,1]){
  const p=patterns.find(p=>p.id===id),notes=drums(p,bpm),hats=Array.from({length:32/hatGrid},(_,i)=>({type:'hat',t:i*hatGrid*60/bpm/4}));
  const base=R.analyze(notes,480/bpm,bpm),groove=G.analyzeRelations(notes,hats,bpm,480/bpm),enriched=G.enrich(base,groove);
  timing.push({bpm,pattern:id,hatGrid,baseElement:base.element,element:enriched.element,quality:base.performanceQuality.multiplier,drunk:groove.drunk,laidBack:groove.laidBack,swing:groove.swing,tight:groove.tight,unstable:groove.unstable,instabilityFinite:Number.isFinite(enriched.instability)});
 }
 const profiles=[['default',{}],['crisp',{wave:'square',attack:.001,release:.02}],['smooth',{wave:'sine',attack:.3,release:1.5}],['bright',{wave:'sawtooth',cutoff:16000,attack:.01,release:.2}]];
 for(let index=0;index<roster.length;index++)for(const id of ['guard','heavy','pierce','heal','buff','special'])for(const name of ['kick_0','swing_'+(1/6),'complex_1','late_2']){
  game.reset(index,100,1,id);const intent=game.state().intent,enemy=roster[index],p=patterns.find(p=>p.id===name),pr=parts(p,enemy.bpm);
  for(const [profile,params] of profiles){
   const pk=packet(enemy,intent,pr),patches={bass:S.patch(params,'bass'),lead:S.patch(params,'lead')};
   for(const track of pk.tracks)if(track.voice!=='drums')track.synth.patch=patches[track.voice];
   const v=Review.evaluate(pk);tone.push({enemy:enemy.kind,intent:id,pattern:name,profile,damage:v.result.total,shield:v.shield,received:v.received.damage,tactics:v.analysis.tactics,element:v.analysis.element});
   if(name==='complex_1'&&id==='heavy'){
    game.reset(index,100,1,id);const actual=await game.cycle(pr,pk.hats,true,patches);
    assert.equal(actual.damage,v.result.total);assert.equal(actual.shieldAtAttack,v.shield);assert.equal(100-actual.after.hp,v.received.damage);matches.push({enemy:enemy.kind,profile,matched:true});
   }
  }
 }
 // An actually held two-note key cannot rearticulate itself without release.
 // Canonicalized duplicates are an exploit probe, not additional playable notes.
 fs.writeFileSync(path.join(root,(process.env.RIDUMU_AUDIT_DIR||'balance-after'),'probes.json'),JSON.stringify({timing,tone,matches,repeatedRows:single.matrix.length}));
 console.log(JSON.stringify({timing:timing.length,timbre:tone.length,actualEngineMatches:matches.length,repeatedRows:single.matrix.length}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
