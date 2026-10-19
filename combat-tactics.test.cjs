const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('./rhythm'),C=require('./performance-combat'),D=require('./evaluation-debug'),S=require('./synth');
const notes=(slots,types='K',pitches)=>slots.map((q,i)=>({t:q*.125,rawT:q*.125,type:types[i%types.length]==='K'?'kick':'snare',duration:.25,...(pitches?{midi:pitches[i%pitches.length]}:{})}));
const fixtures={steady:notes([0,4,8,12,16,20,24,28]),heavy:notes([0,12,24]),snare:notes(Array.from({length:24},(_,i)=>i),'S'),late:notes([0,16,20,24,26,28,29,30,31]),varied:notes([0,3,6,10,14,16,19,22,27,30],'KSS')};
const analyzed=key=>R.analyze(fixtures[key],4,120);
const tactic=(key,id,bass)=>C.tactics(analyzed(key),bass,null,{id});

test('a simple stable beat wins some matchups while development wins others',()=>{
 const simple=analyzed('steady'),complex=analyzed('varied');
 assert.ok(R.resolve(simple,{kind:'stone'}).total>R.resolve(complex,{kind:'stone'}).total);
 assert.ok(R.resolve(complex,{kind:'machine'}).total>R.resolve(simple,{kind:'machine'}).total);
 const snapshot=JSON.stringify(simple);for(let i=0;i<10;i++)R.resolve(simple,{kind:'stone'});assert.equal(JSON.stringify(simple),snapshot,'repetition never mutates enemy resistance or the recorded phrase');
});

test('complete attacks do not let straight alternating spam beat every enemy',()=>{
 const bass=notes([0,8,16,28],'K',[36]),lead=notes([2,10,18,26],'KS',[60,63]);
 const drums={straight:notes(Array.from({length:32},(_,i)=>i),'KS'),steady:fixtures.steady,off:fixtures.varied,late:notes([16,20,24,26,28,29,30,31],'KS')};
 const rows={};
 for(const kind of ['stone','fly','machine','plant','ghost','crystal']){
  rows[kind]=Object.fromEntries(Object.entries(drums).map(([key,drum])=>[key,D.compare(new Map([['drums',drum],['bass',bass],['lead',lead]]),[],120,4,[],{kind}).normal.result.total]));
 }
 assert.ok(rows.stone.steady>rows.stone.straight);assert.ok(rows.machine.off>rows.machine.straight);assert.ok(rows.plant.late>rows.plant.straight);
 assert.ok(rows.fly.straight>rows.fly.off,'regular alternation retains its flying-enemy niche');
});

test('structure recognizes motif variation, dialogue, intentional rests and tension release without requiring density',()=>{
 const repeat=R.structure(notes([0,4,8,12,16,20,24,28],'KS'));
 const varied=R.structure(notes([0,4,8,12,16,20,24,27,30],'KS'));
 assert.equal(repeat.repetition,1);assert.equal(repeat.variation,0);assert.ok(varied.variation>.4);
 assert.ok(R.structure(notes([0,4,8,12,16,20,24,28],'KKKKSSSS')).dialogue>.9);
 assert.ok(R.structure(notes([0,6,8,10,12,14,16,18,19,20,22,23,28])).tensionRelease>.8);
 assert.ok(repeat.rest>.9);assert.equal(R.structure(notes([0])).rest,0);
 assert.ok(repeat.repetition>varied.repetition,'stable repetition keeps its distinct strength');
 assert.deepEqual(R.structure(fixtures.varied),R.structure(fixtures.varied.flatMap(n=>[n,n,n])));
 const raw=[.01,.04,.06,.51,.55,1.72,2.01,3.85].map(t=>({type:'kick',t,rawT:t,inputT:t,quantize:'just'}));
 assert.deepEqual(R.structure(require('./quantize').render(raw,120,4)),R.structure(raw),'playback merging cannot rewrite the performed structure');
});

test('nonweak earth acceleration can prevent healing while weak lightning cannot',()=>{
 assert.equal(analyzed('late').element,'earth');
 const enemy={kind:'ghost',hp:270,attack:100},hp=100,intent={id:'heal'};
 const steady=C.enemyAction(enemy,hp,intent,tactic('steady','heal'));
 const late=C.enemyAction(enemy,hp,intent,tactic('late','heal'));
 assert.equal(late.healed,0);assert.ok(steady.healed>0);
 assert.ok(R.resolve(analyzed('varied'),enemy).total>R.resolve(analyzed('late'),enemy).total,'healing prevention is distinct from immediate damage');
});

test('actions reward different performances and interfere with state rather than only damage',()=>{
 const enemy={guard:.3,hp:280,attack:100,attackCap:160};
 const broken=C.enemyAction(enemy,100,{id:'guard'},tactic('varied','guard'));
 const plain=C.enemyAction(enemy,100,{id:'guard'},tactic('steady','guard'));
 assert.ok(broken.guard<plain.guard);assert.ok(broken.guard<enemy.guard);
 assert.ok(C.enemyAction(enemy,100,{id:'buff'},tactic('varied','buff')).attack<C.enemyAction(enemy,100,{id:'buff'},tactic('steady','buff')).attack);
 assert.ok(tactic('steady','heavy').stagger>tactic('snare','heavy').stagger);
 assert.ok(tactic('snare','pierce').disrupt>tactic('steady','pierce').disrupt);
 const pierce={id:'pierce',pierce:.4},a=C.counterAttack(100,70,90,pierce,0,tactic('snare','pierce')),b=C.counterAttack(100,70,90,pierce,0,tactic('steady','pierce'));
 assert.ok(a.pierce<b.pierce);assert.ok(a.damage<b.damage);
 const heavy={id:'heavy',pierce:0};
 assert.ok(C.counterAttack(100,20,100,heavy,0,tactic('steady','heavy')).damage<C.counterAttack(100,20,100,heavy,0,tactic('snare','heavy')).damage);
});

test('Bass timing, held low notes and space defend without counting presses',()=>{
 const intent={id:'heavy'},early=notes([0,8,16],'K',[36]),timed=notes([0,8,28],'K',[36]);
 const a=C.bass(early,fixtures.heavy,120,4,[],intent),b=C.bass(timed,fixtures.heavy,120,4,[],intent);
 assert.ok(b.prepared>a.prepared);assert.equal(b.strikeBeat,8);
 assert.equal(C.bass(timed,[],120,4,[],{id:'guard'}).prepared,0,'no imaginary attack timing during a nonattacking intent');
 const held=C.bass([{...notes([24],'K',[36])[0],duration:1}],[],120,4,[],intent);
 assert.ok(held.prepared>0);assert.ok(held.sustain>0);
 assert.deepEqual(C.bass(timed.flatMap(n=>Array(200).fill(n)),fixtures.heavy,120,4,[],intent),b);
 assert.ok(tactic('steady','heavy',b).stagger>tactic('steady','heavy',a).stagger);
 const empty=C.bass([],[],120,4,[],intent);assert.equal(empty.shield,0);
});

test('Lead placements and two-note motions choose support without a free fixed bonus',()=>{
 const single=C.lead(notes([0],'K',[60]),120,4,[]);assert.equal(single.attack,0);assert.equal(single.weaken,0);assert.equal(single.expose,0);
 const strong=C.lead(notes([0,8,16,24],'KS',[60,63]),120,4,[]),off=C.lead(notes([2,10,18,26],'KS',[60,63]),120,4,[]);
 assert.ok(strong.attack>off.attack);assert.ok(off.expose>strong.expose);assert.ok(off.pierce>strong.pierce);
 const down=C.lead(notes([0,8,16,24],'KS',[63,60]),120,4,[]);assert.ok(down.pitch.effects.weaken>0);
});

test('all melodic modes support a complete deterministic battle and preserve timbre-independent tactics',()=>{
 for(const palette of [[60,63],[60,63,67,70],[60,62,63,65,67,68,70],[60,62,63,65,67,68,70,72,74]]){
  const parts=new Map([['drums',fixtures.varied],['bass',notes([0,8,16,28],'KS',palette.map(m=>m-24))],['lead',notes([2,10,18,26],'KS',palette)]]);
  const enemy={kind:'stone',guard:.3,intentId:'guard'},a=D.compare(parts,[],120,4,[],enemy).normal;
  assert.ok(a.result.total>0);assert.ok(a.shield>0);assert.ok(a.tactics.guardBreak>0);
  assert.deepEqual(a,D.compare(parts,[],120,4,[],enemy).normal);
  for(const wave of S.waves){const before=JSON.stringify(a.tactics);S.style({patch:S.patch({wave}),events:[]},parts.get('lead'),4);assert.equal(JSON.stringify(C.tactics(a.analysis,a.bass,a.lead,enemy)),before);}
 }
});

test('dense duplicate input never multiplies shields, support, damage or action suppression',()=>{
 const parts=new Map([['drums',fixtures.steady],['bass',notes([0,8,16,28],'KS',[36,43])],['lead',notes([2,10,18,26],'KS',[60,63])]]);
 const enemy={kind:'machine',intentId:'pierce'},a=D.compare(parts,[],120,4,[],enemy).normal;
 const spam=new Map([...parts].map(([voice,ns])=>[voice,voice==='drums'?ns:ns.flatMap(n=>Array(100).fill(n))]));
 const b=D.compare(spam,[],120,4,[],enemy).normal;
 assert.equal(b.shield,a.shield);assert.equal(b.result.total,a.result.total);assert.deepEqual(b.tactics,a.tactics);
 const extreme=Array.from({length:2000},(_,i)=>({t:i*.001,type:i%2?'kick':'snare',duration:99,midi:i%2?36:43}));
 const bass=C.bass(extreme,extreme,120,4,[],{id:'heavy'}),lead=C.lead(extreme,120,4,[]),attack=R.analyze(extreme);
 assert.ok(bass.shield<=72);assert.ok(lead.attack<=.1);assert.ok(R.resolve(attack,{kind:'machine'}).total<500);
 for(const value of Object.values(C.tactics(attack,bass,lead,{id:'buff'})))if(typeof value==='number')assert.ok(value>=0&&value<=1);
});
