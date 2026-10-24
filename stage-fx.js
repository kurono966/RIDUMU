/* Bounded presentation effects. No scoring, input or audio-clock mutations. */
(function(root){
 'use strict';
 const el=id=>document.getElementById(id),field=document.querySelector('#arena .battlefield'),enemy=el('enemy'),strip=document.querySelector('.player-strip');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),layer=document.createElement('div'),aura=document.createElement('div'),notice=document.createElement('span');
 layer.className='stage-fx-layer';layer.setAttribute('aria-hidden','true');aura.className='stage-intent-aura';aura.setAttribute('aria-hidden','true');notice.className='stage-notice';notice.setAttribute('role','status');field.append(aura,layer,notice);
 let freezeUntil=0,noticeTimer,phaseKey='',links=[];
 const enabled=()=>root.ExperienceUI?.enabled!==false;
 function pulse(node,name){node.classList.remove(name);void node.offsetWidth;node.classList.add(name);}
 function text(value){if(!enabled())return;notice.textContent=value;pulse(notice,'is-visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{notice.classList.remove('is-visible');notice.textContent='';},1200);}
 function burst(kind,color='#d4f77d',count=5){
  if(!enabled()||reduced.matches)return;
  for(let i=0;i<count;i++){
   while(layer.childElementCount>=24)layer.firstElementChild.remove();
   const n=document.createElement('i'),angle=(i/count)*Math.PI*2;
   n.className='stage-particle '+kind;n.style.setProperty('--fx-color',color);n.style.setProperty('--dx',Math.cos(angle)*(35+i%3*14)+'px');n.style.setProperty('--dy',Math.sin(angle)*(25+i%3*10)+'px');n.style.setProperty('--angle',i*57+'deg');layer.append(n);
   n.addEventListener('animationend',()=>n.remove(),{once:true});setTimeout(()=>n.remove(),900);
  }
 }
 function sound(kind,item){
  if(!enabled()||typeof ctx==='undefined'||muted)return;
  if(!ctx&&kind==='gear')audio();
  if(!ctx||!masterOutput)return;
  if(kind==='gear'){
   const voice=item?.audio?.target==='bass'?'bass':'lead',frequency=voice==='bass'?164.81:329.63;
   const patch=Synth.patch({wave:'sine',attack:.008,decay:.12,sustain:.18,release:.12,harmonic:.1},voice),snapshot={version:1,patch,events:[]};
   for(const [offset,ratio] of [[0,1],[.1,1.5]])Synth.engine(ctx,masterOutput).play(voice,frequency*ratio,ctx.currentTime+.01+offset,.32,.13,{snapshot,noteTime:0});
  }else{
   const g=ctx.createGain(),o=ctx.createOscillator(),at=ctx.currentTime+.005;o.type='sine';o.frequency.setValueAtTime(880,at);o.frequency.exponentialRampToValueAtTime(1320,at+.1);g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(.025,at+.008);g.gain.exponentialRampToValueAtTime(.0001,at+.18);o.connect(g);g.connect(masterOutput);o.start(at);o.stop(at+.2);o.onended=()=>{o.disconnect();g.disconnect();};
  }
 }
 function hit({type,weak=false,damage,color}){
  if(!enabled()||damage<=0)return;
  freezeUntil=performance.now()+(reduced.matches?0:weak?55:30);
  burst(weak?'weak':type==='kick'?'kick':'snare',color,weak?9:4);
  field.dataset.hitKind=weak?'weak':type==='kick'?'kick':'snare';pulse(field,'stage-hit');
 }
 function shield(amount){if(!enabled()||amount<=0)return;strip.style.setProperty('--shield-flare',Math.min(1,amount/30));pulse(strip,'stage-shield');text('防壁 ＋'+amount);}
 function guard(received){
  if(!enabled()||!received.incoming)return;
  if(!received.absorbed&&received.damage>0){text('HP −'+received.damage);return;}
  strip.dataset.guardResult=received.damage===0?'full':'partial';pulse(strip,'stage-block');
  text(received.damage===0?'完全防御 · '+received.absorbed+'吸収':'盾で '+received.absorbed+' 吸収 · HP −'+received.damage);
  if(received.damage===0)sound('block');
 }
 function phase(part){
  if(!enabled()||part===phaseKey)return;const previous=phaseKey;phaseKey=part;
  const messages={hat:'HI-HAT · 拍を刻む',drums:'DRUMS · ビートを作る',bass:'ビート完成 → BASSで防御準備',lead:'防御準備 → LEADで旋律を重ねる'};
  links=[];const label=el('nextPartLabel');label.dataset.fxPart=part;pulse(label,'stage-phase');
  if(previous)text(messages[part]);
 }
 function intent(id,charging=false){
  const value=enabled()?id:'';if(field.dataset.intent!==value)field.dataset.intent=value;field.classList.toggle('stage-telegraph',enabled()&&charging);
 }
 function resolveLink(event,parts,duration){
  if(!['lock','response'].includes(event.kind)||!event.cells?.length)return null;
  const step=duration/32,resolve=c=>{const ns=parts.get(c.voice)??[],n=ns.find(n=>Math.max(0,Math.min(31,Math.round((n.inputT??n.rawT??n.t)/step)))===c.q&&(!c.type||n.type===c.type));return n?{id:c.voice==='drums'?n.type:c.voice,time:n.t}:null;};
  const targetVoice=event.kind==='lock'?'bass':'lead',targets=event.cells.filter(c=>c.voice===targetVoice),target=targets.find(c=>c.q===event.q)??targets.reduce((a,b)=>Math.abs(b.q-event.q)<Math.abs(a.q-event.q)?b:a,targets[0]);
  if(!target)return null;
  const candidates=event.cells.filter(c=>c.voice==='drums'&&(event.kind==='lock'?c.type==='kick':c.q<=target.q));
  if(!candidates.length)return null;
  const source=candidates.reduce((a,b)=>Math.abs(b.q-target.q)<Math.abs(a.q-target.q)?b:a),from=resolve(source),to=resolve(target);
  return from&&to?{from,to,until:performance.now()+650,provisional:!!event.provisional}:null;
 }
 function link(event,parts,duration){if(!enabled()||reduced.matches)return;const value=resolveLink(event,parts,duration);if(value)links=[...links.slice(-3),value];}
 function drawLinks(p,w,h,duration,lanes){
  if(!enabled()||reduced.matches)return;const now=performance.now();links=links.filter(l=>l.until>now);const geometry=PerformanceTimeline.geometry(w,h,duration);
  p.save();for(const value of links){const from=lanes.findIndex(l=>l.id===value.from.id),to=lanes.findIndex(l=>l.id===value.to.id);if(from<0||to<0)continue;
   const y=(point,index)=>{const lane=lanes[index],note=lane.notes.find(n=>Math.abs(n.t-point.time)<1e-6);return note?PerformanceTimeline.noteY(lane,index,geometry,note,(n,voice)=>PitchCombat.midi(n,voice)):geometry.center(index);};
   const x1=geometry.x(value.from.time),x2=geometry.x(value.to.time),y1=y(value.from,from),y2=y(value.to,to),t=1-(value.until-now)/650;
   p.globalAlpha=Math.min(1,(1-t)*2)*(value.provisional?.55:.9);p.strokeStyle=value.provisional?'#8edcdd':'#e6f5ba';p.lineWidth=1.5;p.setLineDash(value.provisional?[3,3]:[]);p.beginPath();p.moveTo(x1,y1);p.bezierCurveTo(x1+12,y1,x2-12,y2,x2,y2);p.stroke();p.setLineDash([]);
   for(const [x,y] of [[x1,y1],[x2,y2]]){p.beginPath();p.arc(x,y,4+3*t,0,Math.PI*2);p.stroke();}
  }p.restore();
 }
 function defeat(kind){
  if(!enabled())return 0;enemy.dataset.exit=kind;pulse(enemy,'stage-defeated');burst('defeat',kind==='machine'?'#b7d7ef':'#d4f77d',14);text('ENEMY DEFEATED');return reduced.matches?0:460;
 }
 function gear(item,rank){
  if(!enabled())return;const rack=el('rogueRack');rack.dataset.fxGear=item.id;pulse(rack,'stage-gear');text(item.name+' · Lv.'+rank);sound('gear',item);
  document.querySelectorAll('.stage-gear-chip').forEach(n=>n.remove());
  if(!reduced.matches){const chip=document.createElement('span'),r=rack.getBoundingClientRect();chip.className='stage-gear-chip';chip.textContent='◈ '+item.name+' · Lv.'+rank;chip.style.left=(r.x+r.width/2)+'px';chip.style.top=(r.y+6)+'px';chip.setAttribute('aria-hidden','true');document.body.append(chip);chip.addEventListener('animationend',()=>chip.remove(),{once:true});setTimeout(()=>chip.remove(),900);}
 }
 function reset(){freezeUntil=0;links=[];phaseKey='';enemy.classList.remove('stage-defeated');field.classList.remove('stage-telegraph','stage-hit');strip.classList.remove('stage-block','stage-shield','stage-charging');el('nextPartLabel').classList.remove('stage-phase');el('rogueRack').classList.remove('stage-gear');document.querySelectorAll('.stage-gear-chip').forEach(n=>n.remove());layer.replaceChildren();notice.textContent='';notice.classList.remove('is-visible');clearTimeout(noticeTimer);}
 function prepare(amount){strip.classList.toggle('stage-charging',enabled()&&amount>0);if(amount>0)strip.style.setProperty('--guard-charge',Math.min(1,amount));}
 el('feedbackEffects').addEventListener('change',()=>{if(!enabled())reset();});
 root.StageFX={hit,shield,guard,phase,intent,link,resolveLink,drawLinks,defeat,gear,reset,prepare,isFrozen:()=>performance.now()<freezeUntil};
})(globalThis);
