const $=id=>document.getElementById(id);
const enemies=[{name:'苔岩の番人',kind:'stone',hp:150,description:'地に根を張る、分厚い岩のからだ。',attack:12},{name:'宙を舞う翼獣',kind:'fly',hp:135,description:'風の流れに乗り、軽やかに身をかわす。',attack:14},{name:'忘却の自律機',kind:'machine',hp:175,description:'古びた装甲の奥で、回路が明滅する。',attack:16}];
const elements={earth:['土','重震','#d4f77d'],wind:['風','風裂','#9adfd5'],fire:['火','烈火','#ffa26d'],lightning:['雷','雷走','#c6b0ff']};
let state='ready',stage=0,hp=100,enemyHp=150,turn=1,notes=[],last=[],started=0,ctx,muted=false,replayTimers=[],replaying=false,run=0;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const beatSeconds=60/120;
let clockTimer=null;
let recordAudioAt=null;
// Accept the entire final count-in beat, including its rimshot.
const earlyInputGrace=beatSeconds;
function clickSound(type,when,accent=false){
 if(muted||!ctx)return;
 const gain=ctx.createGain(),filter=ctx.createBiquadFilter();
 const length=type==='rim'?.055:.045;
 gain.connect(ctx.destination);
 gain.gain.setValueAtTime(type==='rim'?(accent?.25:.18):.075,when);
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
async function countIn(){
 state='countin';recordAudioAt=null;notes=[];$('start').disabled=true;$('replay').disabled=true;
 $('start').textContent='カウントイン…';$('timer').textContent='4.00';
 $('hint').textContent='リムショット4拍を聴いて準備。次の1拍目から演奏。';
 $('status').textContent='COUNT IN / 1 · 2 · 3 · 4';
 const token=++run;
 await ctx.resume();if(token!==run)return;
 const origin=ctx.currentTime+.06,recordAt=origin+4*beatSeconds,endAt=recordAt+4;
 recordAudioAt=recordAt;
 started=performance.now()+(recordAt-ctx.currentTime)*1000;
 let beat=0;
 clearInterval(clockTimer);
 function tick(){
  if(token!==run){clearInterval(clockTimer);return;}
  const now=ctx.currentTime;
  // Schedule against the audio clock: timer jitter does not move the beat.
  while(beat<12&&origin+beat*beatSeconds<now+.1){
   const at=origin+beat*beatSeconds;
   if(at>=now)clickSound(beat<4?'rim':'hat',at,beat===0);
   beat++;
  }
  if(now<recordAt){
   const number=Math.min(4,Math.max(1,Math.floor((now-origin)/beatSeconds)+1));
   $('status').textContent=`COUNT IN / ${number} — 4`;
  }else if(state==='countin'){
   state='recording';$('start').textContent='演奏中…';
   $('status').textContent='RECORDING / 自由に刻もう';
   $('hint').textContent='ハイハットに乗って、自由に。音の隙間もリズム。';
   document.querySelector('.console').classList.add('recording');
  }
  if(now>=endAt){clearInterval(clockTimer);clockTimer=null;if(state==='recording')finish();}
 }
 clockTimer=setInterval(tick,20);tick();
}
function audio(){if(!ctx)ctx=new(window.AudioContext||window.webkitAudioContext)();if(ctx.state==='suspended')ctx.resume();}
function sound(type,when){if(muted||!ctx)return;const t=when??ctx.currentTime,g=ctx.createGain();g.connect(ctx.destination);g.gain.setValueAtTime(type==='kick'?.55:.23,t);g.gain.exponentialRampToValueAtTime(.001,t+.19);if(type==='kick'){const o=ctx.createOscillator();o.frequency.setValueAtTime(145,t);o.frequency.exponentialRampToValueAtTime(44,t+.15);o.connect(g);o.start(t);o.stop(t+.22);}else{const buffer=ctx.createBuffer(1,ctx.sampleRate*.2,ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter();filter.type='highpass';filter.frequency.value=1100;source.buffer=buffer;source.connect(filter);filter.connect(g);source.start(t);source.stop(t+.2);}}
function flash(type){$(type).classList.add('active');setTimeout(()=>$(type).classList.remove('active'),90);}
function stopReplay(){replayTimers.forEach(clearTimeout);replayTimers=[];replaying=false;$('replay').textContent='▶ リズムを再生';}
function input(type){
 audio();
 if(state==='ready'){sound(type);flash(type);return;}
 if((state!=='countin'&&state!=='recording')||recordAudioAt===null)return;
 // Input acceptance follows the audio clock, independently of the UI timer.
 const rawT=ctx.currentTime-recordAudioAt;
 if(rawT < -earlyInputGrace-1e-9 || rawT>=4)return;
 // Keep the original timing for playback; place anticipated downbeats at grid zero.
 notes.push({type,t:Math.max(0,rawT),rawT});sound(type);flash(type);
}
document.addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.altKey||e.metaKey)return;const type=e.code==='KeyA'?'kick':e.code==='KeyL'?'snare':null;if(type){e.preventDefault();input(type);}});
['kick','snare'].forEach(type=>$(type).addEventListener('pointerdown',e=>{e.preventDefault();input(type);}));
$('sound').onclick=()=>{muted=!muted;$('sound').textContent=muted?'音 OFF':'音 ON';$('sound').setAttribute('aria-pressed',String(!muted));};
function update(){const enemy=enemies[stage];$('enemyName').textContent=enemy.name;$('enemyDesc').textContent=enemy.description;$('enemyHp').textContent=`${enemyHp} / ${enemy.hp}`;$('enemyBar').style.width=`${enemyHp/enemy.hp*100}%`;$('playerHp').textContent=`${hp} / 100`;$('playerBar').style.width=`${hp}%`;$('turn').textContent=`TURN ${String(turn).padStart(2,'0')}`;$('stage').textContent=`ENCOUNTER 0${stage+1} / 03`;$('sector').textContent=stage+1;$('enemy').className=`creature ${enemy.kind}`;}
function ready(label='演奏開始 ↗'){state='ready';$('start').disabled=false;$('start').textContent=label;$('status').textContent='READY TO PLAY';$('hint').textContent='A / L またはパッドをタップ。次は、どんなリズムで？';}
$('start').onclick=()=>{audio();stopReplay();if(state==='over'){stage=0;hp=100;turn=1;enemyHp=enemies[0].hp;$('result').hidden=true;update();}else if(state==='cleared'){stage++;enemyHp=enemies[stage].hp;hp=Math.min(100,hp+28);turn=1;update();}else if(state!=='ready')return;countIn();};
function feedback(a){if(!a.count)return '静寂が広がった。次は、一音から。';const lines=[];if(a.charged>.6)lines.push('溜めを乗せた、重い一撃');else if(a.hits>=4)lines.push('細かな刻みが高速連撃に');else if(a.alternation>.7)lines.push('二つの音がつながる連環撃');else lines.push(a.weight>.6?'深く響く、重い一撃':'鋭く切り込む一撃');if(a.element==='fire')lines.push('後半に集まる熱が炎を生んだ');if(a.element==='lightning')lines.push('揺れる裏拍が雷を帯びた');if(a.regularity>.75&&a.repetition>.4)lines.push('安定した反復で命中精度上昇');return lines.slice(0,2).join('。')+'。';}
function sequence(a){$('sequence').replaceChildren();['kick','snare'].forEach(type=>{const row=document.createElement('div');row.className='seq-row';const label=document.createElement('label');label.textContent=type.toUpperCase();row.append(label);for(let i=0;i<a.slots;i++){const cell=document.createElement('span');cell.className='cell'+(i%4===0?' beat':'')+(a.grid.some(n=>n.type===type&&n.q===i)?' on':'');cell.title=`${(i*.125).toFixed(3)}秒`;row.append(cell);}$('sequence').append(row);});}
let attackPlayhead=null;
async function playbackAttack(result,color){
 const timeline=Rhythm.attackTimeline(last,result.damages);
 if(!timeline.events.length)return;
 await ctx.resume();
 $('status').textContent='RHYTHM ATTACK / 演奏を再生';
 $('hint').textContent='あなたのビートが、そのまま攻撃になる。';
 $('damage').textContent='0';
 const origin=ctx.currentTime+.06;
 let scheduled=0,shown=0,total=0,flashTimer;
 await new Promise(resolve=>{
  function tick(){
   const elapsed=ctx.currentTime-origin;
   attackPlayhead=Math.max(0,elapsed+timeline.offset);
   while(scheduled<timeline.events.length&&timeline.events[scheduled].at<=elapsed+.1){
    const event=timeline.events[scheduled++];
    sound(event.type,Math.max(ctx.currentTime,origin+event.at));
   }
   while(shown<timeline.events.length&&timeline.events[shown].at<=elapsed){
    const event=timeline.events[shown++];flash(event.type);
    const damage=event.damages.reduce((a,b)=>a+b,0);
    if(event.damages.length){
     total+=damage;enemyHp=Math.max(0,enemyHp-damage);
     $('damage').textContent=total;
     $('impact').style.color=color;$('impact').textContent=damage||'MISS';
     $('enemyHp').textContent=`${enemyHp} / ${enemies[stage].hp}`;
     $('enemyBar').style.width=`${enemyHp/enemies[stage].hp*100}%`;
    }
    clearTimeout(flashTimer);
    $('enemy').classList.remove('shake');void $('enemy').offsetWidth;
    if(damage)$('enemy').classList.add('shake');
    $('arena').classList.add('hit-field');
    flashTimer=setTimeout(()=>{$('enemy').classList.remove('shake');$('arena').classList.remove('hit-field');$('impact').textContent='';},150);
   }
   if(elapsed>=timeline.duration){
    clearInterval(timer);clearTimeout(flashTimer);attackPlayhead=null;
    $('enemy').classList.remove('shake');$('arena').classList.remove('hit-field');
    $('impact').textContent='';resolve();
   }
  }
  const timer=setInterval(tick,16);tick();
 });
}
async function finish(){state='attack';document.querySelector('.console').classList.remove('recording');$('timer').textContent='0.00';last=notes.map(n=>({...n}));const a=Rhythm.analyze(last),result=Rhythm.resolve(a,enemies[stage]);const [name,prefix,color]=elements[a.element];$('result').hidden=false;$('element').textContent=a.count?`${name} / ${a.hits>1?'連撃':'一撃'}`:'静寂';$('element').style.color=color;$('moveName').textContent=a.count?prefix+(a.alternation>.7?'連環撃':a.hits>=4?'連打':a.weight>.65?'重撃':'撃'):'無音の余韻';$('feedback').textContent=feedback(a);$('damage').textContent=result.total;$('hitInfo').textContent=`${result.damages.filter(x=>x>0).length} HIT / ${a.count?a.hits:0} STRIKE`;$('reaction').textContent=!a.count?'敵がこちらを見据えている。':result.affinity>1.2?'手応えあり。この敵によく響いている。':result.affinity<.95?'浅い手応え。からだに弾かれた。':'確かな手応え。';sequence(a);$('replay').disabled=true;$('status').textContent='ATTACK';
 await playbackAttack(result,color);$('replay').disabled=!a.count;
 await wait(250);$('impact').textContent='';if(enemyHp<=0){if(stage===2){state='over';$('status').textContent='ALL ENCOUNTERS CLEAR';$('hint').textContent='3つの敵を撃破。あなたのリズムが道を開いた。';$('start').textContent='もう一度遊ぶ ↗';}else{state='cleared';$('status').textContent='ENEMY DEFEATED';$('hint').textContent='撃破。次の敵へ進むとHPが28回復。';$('start').textContent='次の敵へ ↗';}$('start').disabled=false;return;}
 $('status').textContent='ENEMY COUNTER';await wait(450);let counter=enemies[stage].attack;let effect='';if(a.count&&a.element==='earth'){counter=Math.round(counter*(1-.35*a.effect));effect='岩の余韻が反撃を和らげた。';}if(a.count&&a.element==='wind'&&Math.random()<.2+.35*a.effect){counter=0;effect='風に乗って反撃をかわした。';}if(a.count&&a.element==='lightning'&&Math.random()<.15+.35*a.effect){counter=0;effect='帯電した敵の動きが止まった。';}if(a.count&&a.element==='fire'){const burn=Math.round(3+7*a.effect);enemyHp=Math.max(0,enemyHp-burn);$('reaction').textContent+=` 炎の余熱が${burn}ダメージ。`;}
 hp=Math.max(0,hp-counter);$('impact').style.color='#efa568';$('impact').textContent=counter?`−${counter}`:'DODGE';if(effect)$('reaction').textContent+=' '+effect;update();await wait(650);$('impact').textContent='';turn++;if(hp<=0){state='over';$('status').textContent='TRY ANOTHER RHYTHM';$('hint').textContent='力尽きた。リズムを変えて、もう一度。';$('start').disabled=false;$('start').textContent='再挑戦 ↗';}else if(enemyHp<=0){state=stage===2?'over':'cleared';$('status').textContent=stage===2?'ALL ENCOUNTERS CLEAR':'ENEMY DEFEATED';$('hint').textContent='炎の余熱で撃破。';$('start').disabled=false;$('start').textContent=stage===2?'もう一度遊ぶ ↗':'次の敵へ ↗';}else{update();ready();}}
$('replay').onclick=()=>{if(state==='countin'||state==='recording'||state==='attack'||!last.length)return;audio();if(replaying){stopReplay();return;}replaying=true;$('replay').textContent='■ 再生を停止';const offset=Math.min(0,...last.map(n=>n.rawT??n.t));last.forEach(n=>replayTimers.push(setTimeout(()=>{sound(n.type);flash(n.type);},((n.rawT??n.t)-offset)*1000)));replayTimers.push(setTimeout(stopReplay,(4-offset)*1000));};
const canvas=$('scope'),paint=canvas.getContext('2d');function draw(){const box=canvas.getBoundingClientRect(),ratio=window.devicePixelRatio||1;if(canvas.width!==Math.round(box.width*ratio)||canvas.height!==Math.round(box.height*ratio)){canvas.width=Math.round(box.width*ratio);canvas.height=Math.round(box.height*ratio);}paint.setTransform(ratio,0,0,ratio,0,0);const w=box.width,h=box.height;paint.clearRect(0,0,w,h);for(let i=0;i<=32;i++){const x=22+(w-24)*i/32;paint.strokeStyle=i%4===0?'#454e3a':'#2b3327';paint.beginPath();paint.moveTo(x,3);paint.lineTo(x,h-3);paint.stroke();}for(const n of notes){const x=22+(w-24)*n.t/4;paint.fillStyle=n.type==='kick'?'#d4f77d':'#efa568';paint.beginPath();paint.arc(x,n.type==='kick'?21:54,4,0,Math.PI*2);paint.fill();}if(state==='recording'||attackPlayhead!==null){const elapsed=attackPlayhead!==null?Math.min(4,attackPlayhead):Math.min(4,(performance.now()-started)/1000);$('timer').textContent=(4-elapsed).toFixed(2);paint.strokeStyle='#eff1e9';const x=22+(w-24)*elapsed/4;paint.beginPath();paint.moveTo(x,0);paint.lineTo(x,h);paint.stroke();}requestAnimationFrame(draw);}document.addEventListener('visibilitychange',()=>{if(document.hidden){stopReplay();if(state==='recording')$('hint').textContent='演奏時間はタブを離れても進みます。';}});update();draw();

