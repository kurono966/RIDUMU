/* Enemy state presentation. Reads actual stats and resolved action snapshots;
   never updates combat values or predicts a successful player counter. */
(function(root){
 'use strict';
 const actions=new WeakMap(),percent=n=>Math.round((n??0)*100),number=n=>Math.round(n??0);
 const labels={guard:'装甲を強化',heal:'HPを回復',buff:'攻撃力を強化',heavy:'強打',pierce:'盾を貫通',special:'溜め攻撃'};
 function outcome(record){
  const {type,before={},after={},forecast={},received={}}=record;
  if(type==='guard'){
   const from=percent(before.guard),to=percent(after.guard),max=percent(forecast.guard);
   return {tone:to<from?'success':to>from?'guard':'success',headline:to<from?'装甲を崩した':to>from?'敵の装甲が強化':max>to?'装甲強化を阻止':'装甲は変化なし',detail:`軽減 ${from}% → ${to}%`+(max>to?` · 裏拍・変化で抑制（最大${max}%）`:''),short:`装甲 ${from}% → ${to}%`};
  }
  if(type==='buff'){
   const from=number(before.attack),to=number(after.attack),max=number(forecast.attack);
   return {tone:to>from?'buff':'success',headline:to>from?'敵の攻撃力が上昇':max>to?'攻撃強化を阻止':'攻撃力は上限',detail:`攻撃 ${from} → ${to}`+(max>to?` · 強化を${max-to}抑制`:''),short:`攻撃 ${from} → ${to}`};
  }
  if(type==='heal'){
   const healed=number(after.hp-before.hp),blocked=number((forecast.hp??after.hp)-after.hp);
   return {tone:healed?'heal':'success',headline:healed?'敵がHPを回復':blocked?'回復を阻止':'敵HPは満タン',detail:`HP ${number(before.hp)} → ${number(after.hp)}（＋${healed}）`+(blocked?` · 回復を${blocked}阻止`:''),short:healed?`敵HP ＋${healed}`:'敵の回復なし'};
  }
  const attackName=type==='pierce'?'貫通攻撃':labels[type]??'敵の攻撃';
  return {tone:received.damage>0?'attack':'success',headline:received.damage>0?`${attackName}を受けた`:'敵の攻撃を防いだ',detail:`あなたのHP −${number(received.damage)} · 盾 −${number(received.absorbed)}`+(received.pierce?` · 盾${percent(received.pierce)}%貫通`:''),short:`HP −${number(received.damage)} / 盾 −${number(received.absorbed)}`};
 }
 function model(enemy,{baseAttack=enemy.baseAttack??enemy.attack,hp=enemy.hp,intent={},damage=0,forecast={},ended=false,last=null}={}){
  const armor=percent(enemy.guard),attack=number(enemy.attack),base=number(baseAttack),boost=attack-base;
  let value=intent.power?`威力 ${damage}`:'';
  if(intent.id==='guard')value=`装甲 最大${percent(forecast.guard)}%へ`;
  if(intent.id==='heal')value=`最大＋${number(forecast.healed)} HP`;
  if(intent.id==='buff')value=`攻撃 最大${number(forecast.attack)}へ`;
  if(intent.pierce)value+=' · こちらの盾40%貫通';
  if(intent.poison)value+=' · 攻撃後に毒';
  return {armor,attack,boost,armorText:armor?`装甲 ${armor}%軽減`:'装甲なし',attackText:`攻撃 ${attack}`+(boost>0?`（＋${boost}）`:''),armorHelp:armor?`あなたの攻撃に対する基本の軽減率は${armor}%。Leadの貫通やガード崩しで軽減を下げられます。`:'現在、装甲によるダメージ軽減はありません。',next:{id:intent.id,label:labels[intent.id]??intent.name,value,help:intent.hint??'',ended},last:last?outcome(last):null};
 }
 function record(enemy,value){actions.set(enemy,value);return outcome(value);}
 function render(doc,enemy,options){
  const effects=doc.getElementById('enemyEffects'),intentNode=doc.getElementById('enemyIntent'),result=doc.getElementById('enemyActionResult');if(!effects||!intentNode||!result)return;
  const data=model(enemy,{...options,last:actions.get(enemy)}),node=(tag,text,className)=>{const n=doc.createElement(tag);n.textContent=text;if(className)n.className=className;return n;};
  // Skip unchanged content: timers and input refresh the battle plan often.
  const signature=JSON.stringify(data),panel=doc.getElementById('enemyState');if(panel?.dataset.snapshot===signature)return;if(panel)panel.dataset.snapshot=signature;
  const armor=node('span',data.armorText,'enemy-armor-badge');armor.dataset.active=String(data.armor>0);armor.title=data.armorHelp;
  const attack=node('span',data.attackText,'enemy-attack-badge');attack.dataset.boosted=String(data.boost>0);attack.title='現在の敵の基本攻撃力。次の行動の威力は下の予告を参照。';
  effects.replaceChildren(node('small','現在'),armor,attack);effects.setAttribute('aria-label',data.armorHelp+' '+data.attackText);
  intentNode.hidden=data.next.ended;intentNode.dataset.intent=data.next.id;
  const row=node('div','','enemy-next-row');row.append(node('small','次の行動'),node('strong',data.next.label),node('span',data.next.value));
  intentNode.replaceChildren(row,node('p','LEAD後に発動 · '+data.next.help,'enemy-next-help'));intentNode.title='次の行動：'+data.next.label+'。'+data.next.value+'。'+data.next.help;
  result.hidden=!data.last;if(data.last){result.dataset.tone=data.last.tone;result.title=data.last.headline+'：'+data.last.detail;result.replaceChildren(node('small','直前の結果'),node('strong',data.last.headline),node('span',data.last.detail));}
  return data;
 }
 const api={model,outcome,record,render};root.EnemyState=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
