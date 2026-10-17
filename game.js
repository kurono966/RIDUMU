const $=id=>document.getElementById(id);
const enemies=[{name:'苔岩の番人',kind:'stone',bpm:82,hp:150,description:'地に根を張る、分厚い岩のからだ。',attack:12},{name:'宙を舞う翼獣',kind:'fly',bpm:150,hp:135,description:'風の流れに乗り、軽やかに身をかわす。',attack:14},{name:'忘却の自律機',kind:'machine',bpm:120,hp:175,description:'古びた装甲の奥で、回路が明滅する。',attack:16}];
const elements={earth:['土','重震','#d4f77d'],wind:['風','風裂','#9adfd5'],fire:['火','烈火','#ffa26d'],lightning:['雷','雷走','#c6b0ff']};
const instruments=[
 {id:'drums',name:'DRUMS',labels:['KICK','SNARE'],hints:['深く、響かせる。','鋭く、切り込む。'],lanes:['K','S']},
 {id:'bass',name:'BASS',labels:['BASS · C','BASS · G'],hints:['低音で、うねりを。','五度で、跳ねる。'],lanes:['C','G']},
 {id:'lead',name:'SYNTH LEAD',labels:['LEAD · C','LEAD · E♭'],hints:['主旋律を、刻む。','短三度で、彩る。'],lanes:['C','E♭']}
];
const instrumentForTurn=number=>instruments[(Math.max(1,number)-1)%instruments.length];
let lastInstrument='drums';
const tracks=new Map();
let lastMix=null;
let masterOutput=null;
let phase='parts',hatNotes=[],hatReady=false,lastHat=[],lastDuration=480/enemies[0].bpm,lastBpm=enemies[0].bpm,visualBeat=-1;
function timing(){const bpm=enemies[stage].bpm,beat=60/bpm;return {bpm,beat,duration:beat*8,step:beat/4,slots:32};}
function prepareTracksForTurn(){
 // A new drum turn starts a fresh three-part phrase.
 if(instrumentForTurn(turn).id==='drums'){tracks.clear();hatNotes=[];hatReady=false;}
}
function saveTrack(voice,played){
 if(played.length)tracks.set(voice,played.map(n=>({...n})));
 else tracks.delete(voice);
 lastMix=Array.from(tracks,([voice,notes])=>({voice,notes:notes.map(n=>({...n}))}));
 if(hatNotes.length)lastMix.push({voice:'hat',notes:hatNotes.map(n=>({...n}))});
}
function backingTimeline(){
 const backing=Array.from(tracks,([voice,notes])=>({voice,notes})).filter(track=>track.voice!==instrumentForTurn(turn).id);
 if(hatNotes.length)backing.push({voice:'hat',notes:hatNotes});
 return Rhythm.mixTimeline(backing,null,[],timing().duration);
}
function updateInstrument(){
 const instrument=instrumentForTurn(turn);
 $('instrument').textContent=instrument.name;
 ['kick','snare'].forEach((type,i)=>{
  $(type).querySelector('b').textContent=instrument.labels[i];
  $(type).querySelector('small').textContent=instrument.hints[i];
  $(type).setAttribute('aria-label',`${i?'L':'A'}：${instrument.labels[i]}`);
 });
 document.querySelector('.kick-label').textContent=instrument.lanes[0];
 document.querySelector('.snare-label').textContent=instrument.lanes[1];
}
let state='ready',stage=0,hp=100,enemyHp=150,turn=1,notes=[],last=[],started=0,ctx,muted=false,replayTimers=[],replaying=false,run=0;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const beatSeconds=()=>timing().beat;
let clockTimer=null;
let recordAudioAt=null;
// Accept the entire final count-in beat, including its rimshot.
const earlyInputGrace=()=>beatSeconds();
function clickSound(type,when,accent=false,volume=1){
 if(muted||!ctx)return;
 const gain=ctx.createGain(),filter=ctx.createBiquadFilter();
 const length=type==='rim'?.055:.045;
 gain.connect(masterOutput??ctx.destination);
 gain.gain.setValueAtTime((type==='rim'?(accent?.25:.18):.075)*volume,when);
 gain.gain.exponentialRampToValueAtTime(.001,when+length);
 if(type==='rim'){
  const oscillator=ctx.createOscillator();oscillator.type='triangle';
  oscillator.frequency.setValueAtTime(accent?1850:1550,when);
  filter.type='bandpass';filter.frequency.value=1800;filter.Q.value=2;
  oscillator.connect(filter);filter.connect(gain);oscillator.start(when);oscillator.stop(when+length);
 }else{
  const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*length),ctx.sampleRate);
  const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  const source=ctx.createBufferSource();source.buffer=buffer;
  filter.type='highpass';filter.frequency.value=7500;
  source.connect(filter);filter.connect(gain);source.start(when);source.stop(when+length);
 }
}
function updatePhaseUI(){
 const isHat=phase==='hat';document.querySelector('.console').classList.toggle('hat-phase',isHat);
 $('phaseLabel').textContent=isHat?'1 / 2 · HI-HAT':'2 / 2 · '+instrumentForTurn(turn).name;
 $('hat').disabled=!isHat;
}
async function countIn(nextPhase='hat'){
 phase=nextPhase;updatePhaseUI();
 state='countin';recordAudioAt=null;notes=[];
 $('start').disabled=true;$('replay').disabled=true;
 $('start').textContent='カウントイン…';$('timer').textContent=timing().duration.toFixed(2);
 $('hint').textContent=phase==='hat'?'最後のリムショットから、SPACE / HでHatを刻もう。':'自分のHatを聴いて、A / Lを重ねよう。';
 $('status').textContent='COUNT IN / 1 · 2 · 3 · 4';
 const token=++run;await ctx.resume();if(token!==run)return;
 const {beat,duration}=timing(),origin=ctx.currentTime+.06,recordAt=origin+4*beat,endAt=recordAt+duration;
 recordAudioAt=recordAt;started=performance.now()+(recordAt-ctx.currentTime)*1000;
 const backing=phase==='parts'?backingTimeline().events:[];
 let backingIndex=0,countBeat=0;
 clearInterval(clockTimer);
 function tick(){
  if(token!==run){clearInterval(timer);return;}
  const now=ctx.currentTime;
  while(backingIndex<backing.length&&recordAt+backing[backingIndex].time<now+.1){
   const event=backing[backingIndex++],at=recordAt+event.time;
   if(at>=now)sound(event.type,at,event.voice,event.voice==='hat'?.85:.6);
  }
  const countLength=phase==='hat'?12:4;
  while(countBeat<countLength&&origin+countBeat*beat<now+.1){
   const at=origin+countBeat*beat;
   if(at>=now)clickSound('rim',at,countBeat%4===0);
   countBeat++;
  }
  visualBeat=((Math.floor((now-origin)/beat)%4)+4)%4;
  if(now<recordAt){$('status').textContent=`COUNT IN / ${Math.min(4,Math.max(1,Math.floor((now-origin)/beat)+1))} — 4`;}
  else if(state==='countin'){
   state='recording';$('start').textContent=phase==='hat'?'Hatを録音中…':'重ねて録音中…';
   $('status').textContent=phase==='hat'?'HI-HAT / 自分の基準を刻む':'KICK / SNARE · Hatに重ねる';
   $('hint').textContent=phase==='hat'?'SPACE / H またはHatパッド。少しずらしても、繰り返せばあなたのノリ。':'A / L またはパッド。Hatの前・同時・後ろ、自由に重ねよう。';
   document.querySelector('.console').classList.add('recording');
  }
  if(now>=endAt){
   clearInterval(timer);clockTimer=null;visualBeat=-1;
   if(state==='recording'){
    if(phase==='hat'){hatReady=true;document.querySelector('.console').classList.remove('recording');countIn('parts');}
    else finish();
   }
  }
 }
 const timer=setInterval(tick,20);clockTimer=timer;tick();
}
function audio(){if(!ctx){ctx=new(window.AudioContext||window.webkitAudioContext)();masterOutput=ctx.createDynamicsCompressor();masterOutput.threshold.value=-12;masterOutput.ratio.value=6;masterOutput.connect(ctx.destination);}if(ctx.state==='suspended')ctx.resume();}
function pitchedSound(type,t,voice,volume=1){
 const bass=voice==='bass',frequency=bass?(type==='kick'?65.406:97.999):(type==='kick'?261.626:311.127);
 const length=bass?.32:.29,gain=ctx.createGain(),filter=ctx.createBiquadFilter();
 gain.gain.setValueAtTime(.001,t);gain.gain.exponentialRampToValueAtTime((bass?.25:.12)*volume,t+.008);gain.gain.exponentialRampToValueAtTime(.001,t+length);
 filter.type='lowpass';filter.Q.value=bass?1.5:.8;
 filter.frequency.setValueAtTime(bass?1100:3600,t);filter.frequency.exponentialRampToValueAtTime(bass?160:850,t+length);
 filter.connect(gain);gain.connect(masterOutput??ctx.destination);
 const oscillator=ctx.createOscillator();oscillator.type=bass?'sawtooth':'triangle';oscillator.frequency.setValueAtTime(frequency,t);
 oscillator.connect(filter);oscillator.start(t);oscillator.stop(t+length+.02);
 const harmony=ctx.createOscillator(),blend=ctx.createGain();
 harmony.type='sine';harmony.frequency.setValueAtTime(bass?frequency/2:frequency*2,t);blend.gain.value=bass?.45:.18;
 harmony.connect(blend);blend.connect(filter);harmony.start(t);harmony.stop(t+length+.02);
}
function sound(type,when,voice=instrumentForTurn(turn).id,volume=1){if(muted||!ctx)return;const t=when??ctx.currentTime;if(voice==='hat'){clickSound('hat',t,false,volume);return;}if(voice!=='drums'){pitchedSound(type,t,voice,volume);return;}const g=ctx.createGain();g.connect(masterOutput??ctx.destination);g.gain.setValueAtTime((type==='kick'?.55:.23)*volume,t);g.gain.exponentialRampToValueAtTime(.001,t+.19);if(type==='kick'){const o=ctx.createOscillator();o.frequency.setValueAtTime(145,t);o.frequency.exponentialRampToValueAtTime(44,t+.15);o.connect(g);o.start(t);o.stop(t+.22);}else{const buffer=ctx.createBuffer(1,ctx.sampleRate*.2,ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter();filter.type='highpass';filter.frequency.value=1100;source.buffer=buffer;source.connect(filter);filter.connect(g);source.start(t);source.stop(t+.2);}}
function flash(type){$(type).classList.add('active');setTimeout(()=>$(type).classList.remove('active'),90);}
function stopReplay(){replayTimers.forEach(clearTimeout);replayTimers=[];replaying=false;$('replay').textContent='▶ リズムを再生';}
function input(type){
 audio();
 if(state==='ready'){if(type==='hat'){sound('hat',undefined,'hat');flash('hat');}else{sound(type);flash(type);}return;}
 if((state!=='countin'&&state!=='recording')||recordAudioAt===null)return;
 if((phase==='hat')!==(type==='hat'))return;
 const rawT=ctx.currentTime-recordAudioAt;
 if(rawT < -earlyInputGrace()-1e-9 || rawT>=timing().duration)return;
 const event={type,t:Math.max(0,rawT),rawT};
 if(type==='hat'){hatNotes.push(event);sound('hat',undefined,'hat');}
 else{notes.push(event);sound(type);}
 flash(type);
}
function handleKeyDown(e){
 if(e.repeat||e.ctrlKey||e.altKey||e.metaKey||e.target?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName))return;
 if($('codexDialog').open)return;
 if(e.code==='Space'&&e.target?.tagName==='BUTTON'&&e.target.id!=='start'&&!(e.target.id==='hat'&&phase==='hat'))return;
 if(e.code==='KeyH'||(e.code==='Space'&&phase==='hat'&&['countin','recording'].includes(state))){e.preventDefault();input('hat');return;}
 if(e.code==='Space'){
  e.preventDefault();
  if(['ready','cleared','over'].includes(state)&&!$('start').disabled)$('start').click();
  return;
 }
 const type=e.code==='KeyA'?'kick':e.code==='KeyL'?'snare':null;
 if(type){e.preventDefault();input(type);}
}
document.addEventListener('keydown',handleKeyDown);
['hat','kick','snare'].forEach(type=>$(type).addEventListener('pointerdown',e=>{e.preventDefault();input(type);}));
$('sound').onclick=()=>{muted=!muted;$('sound').textContent=muted?'音 OFF':'音 ON';$('sound').setAttribute('aria-pressed',String(!muted));};
function update(){updateInstrument();renderDiscoveries();$('enemyBpm').textContent='BPM '+timing().bpm;$('bpmValue').textContent=timing().bpm;$('timer').textContent=timing().duration.toFixed(2);const enemy=enemies[stage];$('enemyName').textContent=enemy.name;$('enemyDesc').textContent=enemy.description;$('enemyHp').textContent=`${enemyHp} / ${enemy.hp}`;$('enemyBar').style.width=`${enemyHp/enemy.hp*100}%`;$('playerHp').textContent=`${hp} / 100`;$('playerBar').style.width=`${hp}%`;$('turn').textContent=`TURN ${String(turn).padStart(2,'0')}`;$('stage').textContent=`ENCOUNTER 0${stage+1} / 03`;$('sector').textContent=stage+1;$('enemy').className=`creature ${enemy.kind}`;}
function needsHat(){return !hatReady||instrumentForTurn(turn).id==='drums';}
function ready(label='演奏開始 ↗'){
 state='ready';$('start').disabled=false;$('start').textContent=label;$('status').textContent='READY TO PLAY';
 const createHat=needsHat();
 $('phaseLabel').textContent=(createHat?'HAT → ':'録ったHAT → ')+instrumentForTurn(turn).name;
 $('hint').textContent=createHat?'SPACEで開始 → Hatを刻む → A / Lを重ねる。':'SPACEで開始 · 録ったHatにA / Lを重ねる。';
}
function startTurn(){prepareTracksForTurn();return countIn(hatReady?'parts':'hat');}
$('start').onclick=()=>{
 audio();stopReplay();
 if(state==='over'){tracks.clear();lastMix=null;hatNotes=[];hatReady=false;lastHat=[];stage=0;hp=100;turn=1;enemyHp=enemies[0].hp;$('result').hidden=true;update();}
 else if(state==='cleared'){stage++;enemyHp=enemies[stage].hp;hp=Math.min(100,hp+28);turn=1;update();}
 else if(state!=='ready')return;
 startTurn();
};
function sequence(a){$('sequence').replaceChildren();
 const hatRow=document.createElement('div');hatRow.className='seq-row hat-sequence';const hatLabel=document.createElement('label');hatLabel.textContent='H';hatRow.append(hatLabel);
 for(let i=0;i<a.slots;i++){const cell=document.createElement('span');cell.className='cell'+(i%4===0?' beat':'')+(lastHat.some(n=>Math.min(a.slots-1,Math.max(0,Math.round(n.t/a.step)))===i)?' on':'');cell.title=(i*a.step).toFixed(3)+'秒 / Hat';cell.dataset.type='hat';cell.dataset.q=i;hatRow.append(cell);}$('sequence').append(hatRow);
 ['kick','snare'].forEach(type=>{const row=document.createElement('div');row.className='seq-row';const label=document.createElement('label');label.textContent=instruments.find(i=>i.id===lastInstrument).lanes[type==='kick'?0:1];row.append(label);for(let i=0;i<a.slots;i++){const cell=document.createElement('span');cell.className='cell'+(i%4===0?' beat':'')+(a.grid.some(n=>n.type===type&&n.q===i)?' on':'');cell.dataset.type=type;cell.dataset.q=i;cell.title=`${(i*a.step).toFixed(3)}秒`;row.append(cell);}$('sequence').append(row);});}
let attackPlayhead=null;
async function playbackAttack(result,color){
 const timeline=Rhythm.mixTimeline(lastMix??[{voice:lastInstrument,notes:last}],lastInstrument,result.damages,lastDuration);
 if(!timeline.events.length)return;
 await ctx.resume();
 $('status').textContent='RHYTHM ATTACK / 演奏を再生';
 $('hint').textContent='重ねたリズムを再生。今回のパートが攻撃になる。';
 $('damage').textContent='0';
 const origin=ctx.currentTime+.06;
 let scheduled=0,shown=0,total=0,flashTimer;
 await new Promise(resolve=>{
  function tick(){
   const elapsed=ctx.currentTime-origin;
   attackPlayhead=Math.max(0,elapsed+timeline.offset);visualBeat=Math.floor(attackPlayhead/(60/lastBpm))%4;
   while(scheduled<timeline.events.length&&timeline.events[scheduled].at<=elapsed+.1){
    const event=timeline.events[scheduled++];
    sound(event.type,Math.max(ctx.currentTime,origin+event.at),event.voice,event.voice===lastInstrument?1:.65);
   }
   while(shown<timeline.events.length&&timeline.events[shown].at<=elapsed){
    const event=timeline.events[shown++];
    if(event.voice!==lastInstrument)continue;
    flash(event.type);
    const damage=event.damages.reduce((a,b)=>a+b,0);
    if(event.damages.length){
     total+=damage;enemyHp=Math.max(0,enemyHp-damage);showHitFeedback(damage);
     $('damage').textContent=total;
     $('impact').style.color=color;$('impact').textContent=damage||'MISS';
     $('enemyHp').textContent=`${enemyHp} / ${enemies[stage].hp}`;
     $('enemyBar').style.width=`${enemyHp/enemies[stage].hp*100}%`;
    }
    clearTimeout(flashTimer);
    $('enemy').classList.remove('shake');void $('enemy').offsetWidth;
    if(damage)$('enemy').classList.add('shake');
    $('arena').classList.add('hit-field');
    flashTimer=setTimeout(()=>{$('enemy').classList.remove('shake');$('arena').classList.remove('hit-field');$('impact').textContent='';clearHitFeedback();},240);
   }
   if(elapsed>=timeline.duration){
    clearInterval(timer);clearTimeout(flashTimer);attackPlayhead=null;visualBeat=-1;
    $('enemy').classList.remove('shake');$('arena').classList.remove('hit-field');
    $('impact').textContent='';clearHitFeedback();resolve();
   }
  }
  const timer=setInterval(tick,16);tick();
 });
}
async function finish(){
 state='attack';document.querySelector('.console').classList.remove('recording');
 $('timer').textContent='0.00';last=notes.map(n=>({...n}));lastHat=hatNotes.map(n=>({...n}));lastDuration=timing().duration;lastBpm=timing().bpm;
 lastInstrument=instrumentForTurn(turn).id;saveTrack(lastInstrument,last);
 $('lastInstrument').textContent=lastMix.map(track=>track.voice==='hat'?'HAT':instruments.find(i=>i.id===track.voice).name.replace('SYNTH ','')).join(' + ')||'SILENCE';
 const groove=Groove.analyzeRelations(last,lastHat,lastBpm,lastDuration);
 const a=Groove.enrich(Rhythm.analyze(last,lastDuration,lastBpm),groove),result=Rhythm.resolve(a,enemies[stage]);
 const report=CombatFeedback.explain(a,result,enemies[stage],lastInstrument);activeReport=report;
 const [name,prefix,color]=elements[a.element];
 $('result').hidden=false;$('element').textContent=a.count?`${name} / ${a.hits>1?'連撃':'一撃'}`:'静寂';$('element').style.color=color;
 $('moveName').textContent=a.count?prefix+(a.alternation>.7?'連環撃':a.hits>=4?'連打':a.weight>.65?'重撃':'撃'):'無音の余韻';
 $('damage').textContent='0';$('hitInfo').textContent=`${report.hitCount} HIT / ${a.count?a.hits:0} STRIKE`;
 renderReport(report);sequence(a);annotateSequence(a,report);
 $('replay').disabled=true;$('status').textContent='ATTACK';
 await playbackAttack(result,color);$('replay').disabled=!lastMix.length;
 await wait(250);$('impact').textContent='';if(enemyHp<=0){if(stage===2){state='over';$('status').textContent='ALL ENCOUNTERS CLEAR';$('hint').textContent='3つの敵を撃破。あなたのリズムが道を開いた。';$('start').textContent='もう一度遊ぶ ↗';}else{state='cleared';$('status').textContent='ENEMY DEFEATED';$('hint').textContent='撃破。次の敵へ進むとHPが28回復。';$('start').textContent='次の敵へ ↗';}$('start').disabled=false;return;}
 $('status').textContent='ENEMY COUNTER';await wait(450);let counter=enemies[stage].attack;let effect='';if(a.count&&a.element==='earth'){counter=Math.round(counter*(1-.35*a.effect));effect='岩の余韻が反撃を和らげた。';}if(a.count&&a.element==='wind'&&Math.random()<.2+.35*a.effect){counter=0;effect='風に乗って反撃をかわした。';}if(a.count&&a.element==='lightning'&&Math.random()<.15+.35*a.effect){counter=0;effect='帯電した敵の動きが止まった。';}if(a.count&&a.element==='fire'){const burn=Math.round(3+7*a.effect);enemyHp=Math.max(0,enemyHp-burn);$('damage').textContent=result.total+burn;renderBreakdown(report,burn);$('reaction').textContent=report.hint;}
 hp=Math.max(0,hp-counter);$('impact').style.color='#efa568';$('impact').textContent=counter?`−${counter}`:'DODGE';if(effect)$('hint').textContent=effect;update();await wait(650);$('impact').textContent='';turn++;if(hp<=0){state='over';$('status').textContent='TRY ANOTHER RHYTHM';$('hint').textContent='力尽きた。リズムを変えて、もう一度。';$('start').disabled=false;$('start').textContent='再挑戦 ↗';}else if(enemyHp<=0){state=stage===2?'over':'cleared';$('status').textContent=stage===2?'ALL ENCOUNTERS CLEAR':'ENEMY DEFEATED';$('hint').textContent='炎の余熱で撃破。';$('start').disabled=false;$('start').textContent=stage===2?'もう一度遊ぶ ↗':'次の敵へ ↗';}else{update();ready();}}
$('replay').onclick=()=>{
 if(state==='countin'||state==='recording'||state==='attack'||!lastMix?.length)return;
 audio();if(replaying){stopReplay();return;}
 replaying=true;$('replay').textContent='■ 再生を停止';
 const timeline=Rhythm.mixTimeline(lastMix,null,[],lastDuration);
 timeline.events.forEach(event=>replayTimers.push(setTimeout(()=>{
  sound(event.type,undefined,event.voice,.8);
  if(event.voice===lastInstrument)flash(event.type);
 },event.at*1000)));
 replayTimers.push(setTimeout(stopReplay,timeline.duration*1000));
};
const canvas=$('scope'),paint=canvas.getContext('2d');
function draw(){
 const box=canvas.getBoundingClientRect(),ratio=window.devicePixelRatio||1;
 if(canvas.width!==Math.round(box.width*ratio)||canvas.height!==Math.round(box.height*ratio)){canvas.width=Math.round(box.width*ratio);canvas.height=Math.round(box.height*ratio);}
 paint.setTransform(ratio,0,0,ratio,0,0);const w=box.width,h=box.height;
 const duration=attackPlayhead!==null?lastDuration:timing().duration;
 paint.clearRect(0,0,w,h);
 for(let i=0;i<=32;i++){const x=22+(w-24)*i/32;paint.strokeStyle=i%4===0?'#454e3a':'#2b3327';paint.beginPath();paint.moveTo(x,2);paint.lineTo(x,h-2);paint.stroke();}
 const displayNotes=attackPlayhead!==null?[...lastHat,...last]:[...hatNotes,...notes];
 for(const n of displayNotes){const x=22+(w-24)*n.t/duration;paint.fillStyle=n.type==='hat'?'#e5cb82':n.type==='kick'?'#d4f77d':'#efa568';paint.beginPath();paint.arc(x,h*(n.type==='hat'?.15:n.type==='kick'?.48:.8),3,0,Math.PI*2);paint.fill();}
 if(state==='recording'||attackPlayhead!==null){
  const elapsed=attackPlayhead!==null?Math.min(duration,attackPlayhead):Math.max(0,Math.min(duration,ctx.currentTime-recordAudioAt));
  $('timer').textContent=Math.max(0,duration-elapsed).toFixed(2);paint.strokeStyle='#eff1e9';const x=22+(w-24)*elapsed/duration;paint.beginPath();paint.moveTo(x,0);paint.lineTo(x,h);paint.stroke();
 }
 document.querySelectorAll('#beatLights i').forEach((light,i)=>light.classList.toggle('on',i===visualBeat));
 requestAnimationFrame(draw);
}
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stopReplay();if(state==='recording')$('hint').textContent='演奏時間はタブを離れても進みます。';}});update();draw();
