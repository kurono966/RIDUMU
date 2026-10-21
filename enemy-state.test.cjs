const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('./enemy-state'),C=require('./performance-combat'),Run=require('./roguelite');
const noCounter={guardBreak:0,buffSuppress:0,healBlock:0};

test('the current armor and the next defense are separate, using the real capped forecast',()=>{
 const enemy={guard:.2,attack:88,hp:260},intent={id:'guard',power:0,hint:'裏拍で崩す'},forecast=C.enemyAction(enemy,100,intent,noCounter),before=JSON.stringify(enemy);
 const model=S.model(enemy,{baseAttack:88,hp:100,intent,forecast});assert.equal(model.armor,20);assert.match(model.armorText,/20%軽減/);assert.match(model.next.value,/35%/);assert.equal(model.boost,0);assert.equal(JSON.stringify(enemy),before);
 const capped=S.model({...enemy,guard:.65},{intent,forecast:C.enemyAction({...enemy,guard:.65},100,intent,noCounter)});assert.match(capped.next.value,/65%/);
});

test('defense outcomes distinguish armor growth, suppression and break from shield hit points',()=>{
 const enemy={guard:.2,hp:260,attack:88},intent={id:'guard'},forecast=C.enemyAction(enemy,100,intent,noCounter);
 for(const [strength,headline,from,to] of [[0,'敵の装甲が強化','20%','35%'],[.5,'装甲強化を阻止','20%','20%'],[1,'装甲を崩した','20%','5%']]){
  const after=C.enemyAction(enemy,100,intent,{guardBreak:strength}),out=S.outcome({type:'guard',before:enemy,after,forecast});assert.equal(out.headline,headline);assert(out.detail.includes(from)&&out.detail.includes(to));
 }
});

test('elite base stats are not incorrectly described as a combat buff',()=>{
 const enemy=Run.encounter({kind:'stone',hp:260,attack:88},'elite');assert.equal(S.model(enemy).boost,0);
 const upgraded={...enemy,attack:enemy.attack+12};assert.equal(S.model(upgraded).boost,12);assert.match(S.model(upgraded).attackText,/＋12/);
});

test('healing and attack buffs report actual values and blocked amounts, including caps',()=>{
 const before={attack:100,hp:80,guard:.2},enemy={...before,hp:280,attackCap:160};
 const hpForecast=C.enemyAction(enemy,80,{id:'heal'},noCounter);
 assert.equal(S.outcome({type:'heal',before,after:{hp:80},forecast:hpForecast}).headline,'回復を阻止');
 const healed=S.outcome({type:'heal',before,after:{hp:100},forecast:hpForecast});assert.match(healed.detail,/80 → 100/);assert.match(healed.detail,/14阻止/);
 const forecast=C.enemyAction(enemy,80,{id:'buff'},noCounter),buff=S.outcome({type:'buff',before,after:{attack:105},forecast});assert.match(buff.detail,/100 → 105/);assert.match(buff.detail,/10抑制/);
 assert.equal(S.outcome({type:'buff',before:{attack:160},after:{attack:160},forecast:{attack:160}}).headline,'攻撃力は上限');
});

test('damage captions identify whose HP and shield changed without mutating action snapshots',()=>{
 const record={type:'pierce',received:{damage:12,absorbed:30,pierce:.4}},before=JSON.stringify(record),out=S.outcome(record);
 assert.equal(out.headline,'貫通攻撃を受けた');assert.match(out.detail,/あなたのHP −12/);assert.match(out.detail,/盾 −30/);assert.match(out.detail,/40%貫通/);assert.equal(JSON.stringify(record),before);
 assert.equal(S.outcome({type:'heavy',received:{damage:0,absorbed:42}}).headline,'敵の攻撃を防いだ');
});
