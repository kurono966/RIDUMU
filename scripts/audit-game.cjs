// Audit-only host for the real game functions. Stubs are presentation/audio only.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),load=name=>require(path.join(root,name));
function create(){
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',dataset:{},style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},replaceChildren(){},querySelector(){return {}},append(){}});return nodes.get(id);};
 const document={body:{dataset:{}},getElementById:node,querySelector:node,querySelectorAll:()=>[],addEventListener(){}};
 const context=vm.createContext({document,URLSearchParams,performance:{now:()=>0},setTimeout(fn){fn();return 1;},clearTimeout(){},setInterval:()=>1,clearInterval(){},console,
  Ensemble:load('ensemble.js'),GridHazards:load('grid-hazards.js'),GridEffects:load('grid-effects.js'),BassAudio:load('bass-audio.js'),PerformanceCombat:load('performance-combat.js'),PitchCombat:load('pitch-combat.js'),Rhythm:load('rhythm.js'),Quantize:load('quantize.js'),Groove:load('groove.js'),CombatFeedback:load('feedback.js'),
  renderEnsemble(){},renderDiscoveries(){},showHitFeedback(){},clearHitFeedback(){},activeReport:null});
 context.window=context;context.addEventListener=()=>{};
 for(const file of ['synth.js','synth-audio.js','performance-filter.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
 vm.runInContext(fs.readFileSync(path.join(root,'game.js'),'utf8').split("const canvas=$('scope')")[0],context,{filename:'game.js'});
 vm.runInContext(`
  ctx={currentTime:10,state:'running'};muted=true;
  sound=()=>{};clickSound=()=>{};flash=()=>{};renderReport=()=>{};sequence=()=>{};annotateSequence=()=>{};
  audio=()=>ctx;startTurn=()=>{prepareTracksForTurn();ready();};
  let auditCapture=null,auditPoison=0;
  const actualHazards=applyInputHazards;
  applyInputHazards=result=>{const before=hp;actualHazards(result);auditPoison+=before-hp;};
  // Playback applies the exact resolved hit amounts; scheduling and visuals are omitted.
  playbackAttack=async result=>{auditCapture={result:JSON.parse(JSON.stringify(result)),analysis:auditCapture?.analysis,shield,bass:cycleBass,lead:cycleLead,ensemble:cycleEnsemble};for(const damage of result.damages)enemyHp=Math.max(0,enemyHp-damage);};
  const actualExplain=CombatFeedback.explain;
  CombatFeedback={...CombatFeedback,explain:(a,...args)=>{auditCapture={analysis:JSON.parse(JSON.stringify(a))};return actualExplain(a,...args);}};
  globalThis.Audit={
   roster:()=>JSON.parse(JSON.stringify(standardEnemies)),
   reset(index,startHp=100,round=1,forced=null){
    enemies.splice(0,enemies.length,...standardEnemies.map(copyEnemy));stage=index;turn=(round-1)*3+1;hp=startHp;enemyHp=enemies[stage].hp;
    if(forced)enemies[stage].intentOrder=Array(6).fill(forced);
    state='ready';shield=0;cycleBass=null;cycleLead=null;cycleEnsemble=null;continuousRunning=false;continuousResume=false;debugDamagePlan=null;
    notes=[];last=[];hatNotes=[];hatReady=false;lastMix=null;tracks.clear();synthTracks.clear();filterTracks.clear();synthRecording=null;filterAutomation=[];
    gridHazards.reset();gridSkillWave=0;auditCapture=null;auditPoison=0;advanceGridHazards();
   },
   state(){return JSON.parse(JSON.stringify({hp,enemyHp,shield,round:battleRound(),turn,stage,state,enemy:enemies[stage],intent:enemyIntent(),poison:auditPoison,activeHazards:gridHazards.active()}));},
   next(){if(state!=='cleared')throw Error('Not cleared');$('start').onclick();return this.state();},
   async cycle(parts,hats,poison=true,patches=null){
    const before=this.state();auditCapture=null;
    prepareTracksForTurn();hatNotes=JSON.parse(JSON.stringify(hats));hatReady=true;
    for(const voice of ['drums','bass','lead']){
     if(hp<=0||enemyHp<=0)break;
     advanceGridHazards();state='recording';phase='parts';phaseQuantizeMode='off';recordAudioAt=10;ctx.currentTime=10;pendingTrackInput=null;
     notes=JSON.parse(JSON.stringify(parts[voice]??[]));filterAutomation=[];
     synthRecording=voice==='drums'?null:{version:1,patch:patches?.[voice]??Synth.patch({},voice),events:[]};
     if(poison){
      const inputs=[...(voice==='drums'?hatNotes:[]),...notes].sort((a,b)=>(a.rawT??a.t)-(b.rawT??b.t));
      for(const note of inputs){applyInputHazards(gridHazards.onInput({type:note.type,rawT:note.rawT??note.t,bpm:timing().bpm,voice:note.type==='hat'?'hat':voice,note}));if(hp<=0)break;}
     }
     if(hp<=0)break;
     ctx.currentTime=10+timing().duration;await finish();
    }
    const after=this.state();return JSON.parse(JSON.stringify({before,after,damage:auditCapture?.result?.total??0,analysis:auditCapture?.analysis??null,result:auditCapture?.result??null,shieldAtAttack:auditCapture?.shield??shield,poison:after.poison-before.poison,bass:auditCapture?.bass,lead:auditCapture?.lead,ensemble:auditCapture?.ensemble}));
   }
  };
 `,context);
 return context.Audit;
}
module.exports={create};
