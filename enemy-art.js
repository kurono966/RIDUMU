/* Geometry, palette and articulation are data. SVG and state sampling are
   shared. No image, audio, random or combat dependencies. */
(function(root){
 'use strict';
 const NS='http://www.w3.org/2000/svg',path=(d,fill=0)=>({tag:'path',attrs:{d},fill});
 const part=(id,pivot,shapes,motion={})=>({id,pivot,shapes,...motion});
 const definitions={
  stone:{name:'苔岩の番人',concept:'苔を冠した、割れた門柱',palette:['#b2b9a8','#65776b','#bac984'],pulse:'keystone',idle:{y:.65,r:.12,period:7},strike:{x:-5,y:12,r:-2},parts:[
   part('pillar-left',[-46,64],[path('M-91-52-54-105 5-96-8-20-34 100-94 83Z'),path('M5-96 22-77 11 18-16 113-34 100-8-20Z',1),path('M-91-52-54-105 5-96 0-79-27-77-42-86-62-75-74-55Z',2)],{guard:{x:7,r:2},prepare:{y:-4,r:2},attack:{y:8,r:-3},hit:{x:-5,r:-2}}),
   part('pillar-right',[62,83],[path('M29-63 86-46 101 75 62 104 24 91 37 12Z'),path('M86-46 104-27 116 70 101 75Z',1)],{guard:{x:-8,r:-2},prepare:{y:-2},attack:{y:3,r:4},hit:{x:5,r:2}}),
   part('keystone',[6,0],[path('M-9-12 24-18 28 7-16 14Z',1)],{guard:{y:5},prepare:{y:-8},attack:{y:9},hit:{x:3,y:-6}})
  ]},
  fly:{name:'宙を舞う翼獣',concept:'余白を挟んで切り返す折り翼',palette:['#bdd7d1','#608a91','#d9bd83'],pulse:'keel',idle:{y:2.8,r:.6,period:6.8},strike:{x:-19,y:6,r:-9},parts:[
   part('wing-left',[-12,7],[path('M-12-4C-60-19-95-50-129-91-133-38-102 5-55 32L-18 25Z'),path('M-129-91C-111-43-66-13-12-4L-18 10C-69-7-100-24-129-91Z',1)],{idle:{r:1.4},guard:{r:26,x:7,y:10},prepare:{r:-11,y:-4},attack:{r:24,y:4},hit:{r:-10,x:-6,y:-3}}),
   part('wing-right',[16,4],[path('M17-11C62-29 97-69 126-113 137-49 108 7 58 30L18 19Z'),path('M126-113C109-58 70-19 17-11L18 3C80-13 114-48 126-113Z',1)],{idle:{r:-1.2},guard:{r:-28,x:-8,y:14},prepare:{r:12,y:-3},attack:{r:-27,y:5},hit:{r:12,x:6,y:-4}}),
   part('keel',[1,15],[path('M-8-34 18-22 15 35-7 101-16 44Z',1),path('M-8-34 4-20 1 40-7 101-16 44Z'),path('M-9-33 7-42 19-23 4-14Z',2)],{guard:{y:9},prepare:{y:-5},attack:{y:7,r:-5},hit:{y:6,r:3}})
  ]},
  machine:{name:'忘却の自律機',concept:'中心をずらした、角形の封印機',palette:['#bdc2ca','#657080','#dfb574'],pulse:'contact',idle:{y:0,r:0,period:8},strike:{x:-8,y:0,r:0},parts:[
   part('upper-frame',[0,0],[path('M-98-81H70L96-55V-13H57V-43H-56V35H-98Z'),path('M70-81 96-55H57L39-63H-78L-98-81Z',1)],{guard:{x:5,y:5},prepare:{x:-8,y:-5},attack:{x:10,y:6},hit:{x:-6,y:-4}}),
   part('lower-frame',[0,0],[path('M98 81H-70L-96 55V13H-57V43H56V-35H98Z'),path('M-70 81-96 55H-57L-39 63H78L98 81Z',1)],{guard:{x:-5,y:-5},prepare:{x:8,y:5},attack:{x:-10,y:-6},hit:{x:6,y:4}}),
   part('shuttle',[6,0],[path('M-28-24H19V22H-28Z',1),path('M-28-24-13-35H34L19-24Z'),path('M19-24 34-35V9L19 22Z',1)],{idle:{x:1.2},guard:{x:12},prepare:{x:-15},attack:{x:24},hit:{r:8,x:3}}),
   part('contact',[40,0],[path('M36-19H43V25H36Z',2)],{guard:{x:-5},prepare:{x:6},attack:{x:-13},hit:{y:5}})
  ]},
  plant:{name:'棘冠の喰らい花',concept:'喰うための空洞を囲む、厚い花弁',palette:['#c79aa6','#718573','#c8d49b'],pulse:'stem',idle:{y:.7,r:.7,period:7.3},strike:{x:-7,y:3,r:-4},parts:[
   part('stem',[-2,42],[path('M-8 3C-31 39-18 72-53 104-27 115 2 97 8 66 13 41 22 28 25 12L9 7C0 30-9 42-8 3Z',1)],{guard:{r:3},prepare:{r:5,x:2},attack:{r:-8,x:-3},hit:{r:3}}),
   part('petal-left',[-13,7],[path('M-9 5C-54-2-103-42-107-99-62-109-21-79-8-39L-19-18-40-33C-31-12-21-6-9 5Z'),path('M-107-99C-77-86-54-60-40-33L-19-18-8-39C-40-74-72-87-107-99Z',1),path('M-67-79-70-119-53-92ZM-43-55-38-85-27-64Z',2)],{idle:{r:-.5},guard:{r:13,x:3},prepare:{r:-12,x:-3},attack:{r:20,x:3},hit:{r:-8,x:-4}}),
   part('petal-right',[14,10],[path('M10 10C64-5 107-59 91-115 53-99 18-71 10-40L23-21 45-42C34-15 24 1 10 10Z'),path('M91-115C84-75 69-52 45-42L23-21 10-40C31-79 60-96 91-115Z',1),path('M51-83 69-126 67-92Z',2)],{idle:{r:.6},guard:{r:-13,x:-3},prepare:{r:10,x:3},attack:{r:-22,x:-3},hit:{r:9,x:4}})
  ]},
  ghost:{name:'薄明の残響',concept:'欠けた器のような、浮遊する曲面',palette:['#c6c2d6','#7c768e','#afd2c7'],pulse:'remainder',idle:{y:3.2,r:.65,period:8.4},strike:{x:-8,y:-2,r:6},parts:[
   part('vessel',[-22,-4],[path('M52-110C-33-135-106-65-93 23-87 74-49 107 0 113L20 75C-19 74-53 43-54 2-55-43-20-78 22-66Z'),path('M-93 23C-87 74-49 107 0 113L20 75C-24 85-65 51-70 16-80-34-50-75-16-94-71-75-99-29-93 23Z',1)],{guard:{r:-6,x:8},prepare:{r:-4,y:-4},attack:{r:8,x:2},hit:{x:-8,r:-4}}),
   part('fragment',[63,6],[path('M70-86C110-39 106 24 60 61L40 78 57 107C124 67 141-32 98-102Z',1),path('M70-86 98-102C117-71 125-47 124-18L106-6C109-39 91-63 70-86Z')],{idle:{y:1.3,r:-.7},guard:{x:-10,r:4},prepare:{x:6,y:3,r:5},attack:{x:-5,y:-7,r:-8},hit:{x:10,y:4,r:7}}),
   part('remainder',[2,115],[path('M-3 105 13 113 7 135-8 125Z',2)],{idle:{y:-1.6},guard:{y:-8},prepare:{y:4},attack:{y:-12,x:6},hit:{x:-4,y:6}})
  ]},
  crystal:{name:'晶殻の甲虫',concept:'細い継ぎ目で分かれた二枚の晶殻',palette:['#bbd2dd','#6e91a3','#cfbda0'],pulse:'seam',idle:{y:.45,r:.2,period:7.7},strike:{x:-9,y:4,r:-3},parts:[
   part('shell-left',[-6,14],[path('M-9-81-67-64-104-4-68 72-13 107-21 13Z'),path('M-67-64-104-4-68 72-56 5Z',1)],{guard:{x:5,r:2},prepare:{x:-8,r:-5},attack:{x:12,r:6},hit:{x:-7,r:-4}}),
   part('shell-right',[6,14],[path('M9-81 67-64 104-4 68 72 13 107 21 13Z'),path('M67-64 104-4 68 72 56 5Z',1)],{guard:{x:-5,r:-2},prepare:{x:8,r:5},attack:{x:-12,r:-6},hit:{x:7,r:4}}),
   part('horn',[0,-64],[path('M-9-68-29-126-9-109 0-84 9-109 29-126 9-68Z'),path('M-9-109 0-84 9-109 0-97Z',1)],{guard:{y:4},prepare:{y:-5,r:2},attack:{y:7,r:-4},hit:{r:4,y:-2}}),
   part('seam',[0,32],[path('M-3-13 3-13 5 70 0 88-5 70Z',2)],{guard:{sx:.55},prepare:{sy:.9},attack:{sy:1.08},hit:{y:5}})
  ]},
  furnace:{name:'炉心の舞踏獣',concept:'炉心を挟み、重心を移す坩堝',palette:['#c18e73','#895f53','#e5b67b'],pulse:'ember',idle:{y:.6,r:.55,period:6.4},strike:{x:-4,y:10,r:-7},parts:[
   part('crucible-left',[-47,77],[path('M-88-72-49-91-35-57C-66-32-65 24-37 48L-8 60V107L-50 100C-113 70-132-18-88-72Z'),path('M-88-72C-107-4-93 49-50 74L-8 88V107L-50 100C-113 70-132-18-88-72Z',1),path('M-51 93-8 102-13 118-76 120Z',1)],{idle:{r:.65},guard:{x:6,r:4},prepare:{y:-6,r:7},attack:{y:7,r:-8},hit:{x:-5,r:-3}}),
   part('crucible-right',[46,75],[path('M45-89 87-65C123-8 104 62 50 94L6 107V60L36 46C64 24 65-30 32-52Z',1),path('M45-89 61-81C91-35 92 25 50 57L6 80V60L36 46C64 24 65-30 32-52Z')],{idle:{r:-.55},guard:{x:-6,r:-4},prepare:{y:3,r:-5},attack:{y:-3,r:9},hit:{x:5,r:4}}),
   part('ember',[1,-4],[path('M-6-39C-27-12-25 15-1 31 23 16 26-10 9-39Z',2)],{idle:{y:.7},guard:{sy:.8},prepare:{y:-8,sy:.8},attack:{y:8,sy:1.15},hit:{x:3,y:-4}})
  ]},
  conductor:{name:'終奏の指揮者',concept:'顔のない幕状の彫刻と一本の指揮棒',palette:['#d4cbb9','#81758d','#c8ac78'],pulse:'baton',idle:{y:.6,r:.25,period:9},strike:{x:-3,y:1,r:-4},parts:[
   part('mantle-left',[-33,18],[path('M-41-97-9-78-27 46-11 104-79 89-57 18Z'),path('M-41-97-33-72-45 46-28 100-79 89-57 18Z',1)],{guard:{x:7,r:4},prepare:{r:3,y:-2},attack:{r:-7,y:3},hit:{x:-5,r:-3}}),
   part('mantle-right',[30,18],[path('M7-78 46-97 64 96 11 111 31 47Z'),path('M46-97 64 96 40 87 31 47 24-70Z',1)],{guard:{x:-7,r:-4},prepare:{r:-4,y:-2},attack:{r:7,y:3},hit:{x:5,r:4}}),
   part('suspended-crown',[0,-113],[path('M-61-113Q-3-146 62-113L54-104Q-2-126-54-102Z',2)],{idle:{y:.6},guard:{y:4},prepare:{y:-3},attack:{y:3,r:-3},hit:{r:4,y:-4}}),
   part('baton',[38,-17],[{tag:'path',attrs:{d:'M38-17 111-107','stroke-width':4,'stroke-linecap':'square'},fill:null,stroke:2},path('M33-19 38-25 44-18 38-11Z',2)],{idle:{r:.6},guard:{r:-17,x:-4},prepare:{r:20,y:-2},attack:{r:-41,x:-2,y:4},hit:{r:7}})
  ]}
 };
 definitions.pulse={name:'脈動の浮遊核',concept:'浮いた蛇腹の圧力室と菱形の振動核',palette:['#9bc8c1','#526d87','#e9bd79'],pulse:'diaphragm',idle:{y:1.8,r:.25,period:6},strike:{x:-10,y:3,r:-3},parts:[
  part('bellows-left',[-26,0],[path('M-28-82-64-68-98-34-79-17-106 8-78 30-91 55-55 83-25 70-42 37-29 8-43-23Z'),path('M-64-68-79-17-106 8-58 0-43-23Z',1),path('M-78 30-91 55-55 83-42 37Z',1)],{guard:{x:9},prepare:{x:-7},attack:{x:15,r:4},hit:{x:-8,r:-5}}),
  part('bellows-right',[26,0],[path('M28-82 64-68 98-34 79-17 106 8 78 30 91 55 55 83 25 70 42 37 29 8 43-23Z',1),path('M64-68 79-17 106 8 58 0 43-23Z'),path('M78 30 91 55 55 83 42 37Z')],{guard:{x:-9},prepare:{x:7},attack:{x:-15,r:-4},hit:{x:8,r:5}}),
  part('diaphragm',[0,0],[path('M0-59 27 0 0 64-27 0Z',2),path('M0-59 0 64-27 0Z',1)],{guard:{sy:.8},prepare:{sy:1.12},attack:{sy:.7,sx:1.15},hit:{y:7,r:8}})
 ]};
 const durations={hit:.28,weak:.38,dodge:.38,strike:.45,evaded:.38,stun:.75,burn:.65,guard:.38,poison:.5,heal:.7,buff:.6};
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),rounded=n=>Math.round(n*1000)/1000;
 function transform(pivot,move){const {x=0,y=0,r=0,sx=1,sy=1}=move,[cx,cy]=pivot;return `translate(${rounded(x)} ${rounded(y)}) translate(${cx} ${cy}) rotate(${rounded(r)}) scale(${rounded(sx)} ${rounded(sy)}) translate(${-cx} ${-cy})`;}
 function accumulate(out,pose={},weight=0){for(const key of ['x','y','r'])out[key]+=(pose[key]??0)*weight;for(const key of ['sx','sy'])out[key]+=((pose[key]??1)-1)*weight;}
 function sample(kind,options={}){
  const def=definitions[kind]??definitions.stone,time=Number.isFinite(options.time)?options.time:0,reduced=!!options.reduced;
  const age=Math.max(0,options.age??0),reaction=options.reaction??'',duration=durations[reaction]??1,p=clamp(age/duration),envelope=p<1?Math.sin(Math.PI*p):0;
  const wave=reduced?0:Math.sin(time*Math.PI*2/def.idle.period),beat=Number.isFinite(options.beat)?Math.exp(-(((options.beat%1)+1)%1)*10):0;
  const guard=clamp((options.guard??0)+(reaction==='guard'?envelope:0)),charge=clamp(options.charge??0),attack=!reduced&&reaction==='strike'?envelope:0;
  const impact=!reduced&&['hit','weak','burn','poison','stun'].includes(reaction)?envelope*(reaction==='weak'?1:.65):0;
  const rootPose={x:0,y:reduced?0:def.idle.y*wave,r:reduced?0:def.idle.r*wave,sx:1,sy:1};accumulate(rootPose,def.strike,attack);
  if(!reduced&&reaction==='heal')rootPose.y-=envelope*3;
  if(!reduced&&reaction==='buff'){rootPose.sy+=envelope*.025;rootPose.y-=envelope*2;}
  if(!reduced){rootPose.x+=impact*4*Math.cos(p*Math.PI*3);rootPose.y-=impact*2;if(reaction==='dodge'||reaction==='evaded'){rootPose.x+=envelope*(reaction==='dodge'?15:-12);rootPose.r+=envelope*4;}if(reaction==='stun')rootPose.r+=Math.sin(p*Math.PI*6)*1.2*envelope;}
  const parts=def.parts.map(piece=>{
   const move={x:0,y:0,r:0,sx:1,sy:1};accumulate(move,piece.idle,wave);accumulate(move,piece.guard,guard);accumulate(move,piece.prepare,charge);accumulate(move,piece.attack,attack);accumulate(move,piece.hit,impact);
   if(reduced){for(const key of ['x','y','r'])move[key]=(piece.guard?.[key]??0)*clamp(options.guard??0)+(piece.prepare?.[key]??0)*charge*.5;move.sx=1;move.sy=1;}
   // One small articulation follows musical beats; no bars, rings or trails.
   if(!reduced&&piece.id===def.pulse)move.y-=beat*1.25;
   return {id:piece.id,transform:transform(piece.pivot,move),opacity:reduced&&reaction==='weak'&&p<1 ? .82 : 1};
  });return {kind:definitions[kind]?kind:'stone',root:transform([0,0],rootPose),parts};
 }
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 function attributes(shape,palette){return {...shape.attrs,fill:shape.fill===null?'none':palette[shape.fill??0],...(shape.stroke!==undefined?{stroke:palette[shape.stroke]}:{})};}
 function toSVG(kind,options={}){
  const state=sample(kind,options),def=definitions[state.kind],attrs=values=>Object.entries(values).map(([k,v])=>`${k}="${escape(v)}"`).join(' ');
  return `<svg xmlns="${NS}" viewBox="-160 -160 320 320" role="img" aria-label="${escape(def.name)}"><title>${escape(def.name+' — '+def.concept)}</title><g data-sculpture="${state.kind}" transform="${state.root}">${def.parts.map((piece,i)=>`<g data-part="${piece.id}" transform="${state.parts[i].transform}" opacity="${state.parts[i].opacity}">${piece.shapes.map(shape=>`<${shape.tag} ${attrs(attributes(shape,def.palette))}/>`).join('')}</g>`).join('')}</g></svg>`;
 }
 const instances=new WeakMap();
 function mount(host,kind){
  const existing=instances.get(host);if(existing?.kind===kind)return existing;existing?.observer?.disconnect();
  const doc=host.ownerDocument,def=definitions[kind]??definitions.stone,svg=doc.createElementNS(NS,'svg');
  for(const [key,value] of Object.entries({viewBox:'-160 -160 320 320',role:'img','aria-label':def.name,focusable:'false'}))svg.setAttribute(key,value);
  const title=doc.createElementNS(NS,'title');title.textContent=def.name+' — '+def.concept;svg.append(title);
  const group=doc.createElementNS(NS,'g');group.setAttribute('data-sculpture',kind);svg.append(group);
  const pieces=def.parts.map(piece=>{const node=doc.createElementNS(NS,'g');node.setAttribute('data-part',piece.id);for(const shape of piece.shapes){const child=doc.createElementNS(NS,shape.tag);for(const [key,value] of Object.entries(attributes(shape,def.palette)))child.setAttribute(key,value);node.append(child);}group.append(node);return node;});
  host.replaceChildren(svg);host.dataset.design=kind;
  const instance={kind,svg,group,pieces,reaction:null,charge:0,guard:0,lastTime:null};
  const resize=()=>{const box=host.parentElement?.getBoundingClientRect();if(box){const size=Math.max(36,Math.min(310,box.width*.76,box.height*.9));host.style.setProperty('--sculpture-size',size+'px');}};
  if(root.ResizeObserver){instance.observer=new root.ResizeObserver(resize);instance.observer.observe(host.parentElement);}resize();instances.set(host,instance);return instance;
 }
 function react(host,type,time=(root.performance?.now()??0)/1000){const instance=instances.get(host);if(instance&&durations[type])instance.reaction={type,time};}
 function update(host,options={}){
  if(!host)return;const kind=definitions[options.kind]?options.kind:'stone',instance=mount(host,kind),time=options.time??0;
  const first=instance.lastTime===null,dt=first?0:clamp(time-instance.lastTime,0,.1);instance.lastTime=time;
  const armor=Number.isFinite(options.armor)?clamp(options.armor/.65)*.8:null;
  const ease=first||options.reduced?1:1-Math.exp(-dt*12),ended=['over','cleared'].includes(options.phase),guard=ended?0:armor??(options.intent==='guard'?.8:0),charge=options.charging?1:0;
  instance.guard+=(guard-instance.guard)*ease;instance.charge+=(charge-instance.charge)*ease;
  const reaction=instance.reaction,age=reaction?time-reaction.time:1,state=sample(kind,{...options,guard:instance.guard,charge:instance.charge,reaction:reaction?.type,age});
  if(reaction&&age>(durations[reaction.type]??1))instance.reaction=null;
  instance.group.setAttribute('transform',state.root);state.parts.forEach((piece,i)=>{instance.pieces[i].setAttribute('transform',piece.transform);instance.pieces[i].setAttribute('opacity',String(piece.opacity));});return state;
 }
 const api={definitions,durations,sample,toSVG,mount,react,update};root.EnemyArt=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
