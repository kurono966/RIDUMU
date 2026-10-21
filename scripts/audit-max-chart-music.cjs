// Inspect actual planner output; musical observations are not a new combat score.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),D=require('../evaluation-debug.js'),G=require('../groove.js');
const roster=vm.runInNewContext(fs.readFileSync(path.join(root,'game.js'),'utf8').split('const enemies=')[1].split('\n];')[0]+'\n]');
const intents=['guard','heavy','heal','pierce','buff','special'],results=[];
const slot=(n,step)=>Math.round(n.t/step),near=(notes,q,step)=>notes.some(n=>Math.abs(n.t/step-q)<.5);
function grid(notes,step,type){return Array.from({length:32},(_,q)=>notes.some(n=>slot(n,step)===q&&(!type||n.type===type))?'●':'·').join('').match(/.{4}/g).map((s,i)=>s+(i===3?' |':'')).join(' ');}
for(const enemy of roster)for(const intentId of intents){
 const duration=480/enemy.bpm,step=60/enemy.bpm/4,e={...enemy,intentId},plan=D.damageChart('max',enemy.bpm,duration,[],e),drums=plan.parts.get('drums');
 const anchors=[0,16].map(q=>near(drums.filter(n=>n.type==='kick'),q,step));
 const patched=drums.map(n=>({...n}));for(const q of [0,16])if(!near(patched.filter(n=>n.type==='kick'),q,step))patched.push({type:'kick',t:q*step,rawT:q*step,inputT:q*step,quantize:'off'});
 patched.sort((a,b)=>a.t-b.t);const parts=new Map(plan.parts);parts.set('drums',patched);
 const counter=D.compare(parts,plan.hats,enemy.bpm,duration,[],e,'recorded',true).normal;
 results.push({enemy,intentId,plan,anchors,emptyFirstBar:!drums.some(n=>slot(n,step)<16),bassAnchors:[0,16].map(q=>near(plan.parts.get('bass'),q,step)),sameOnsets:plan.parts.get('bass').filter(n=>near(plan.parts.get('lead'),slot(n,step),step)).length,bassCount:plan.parts.get('bass').length,counter:counter.result.total,counterStyle:G.classify(counter.groove),counterEffective:!plan.preferredGrooves.length||plan.preferredGrooves.includes(G.classify(counter.groove))&&counter.groove[G.classify(counter.groove)]>=.55&&counter.groove.unstable<.35});
}
const missing=results.filter(r=>!r.anchors[0]),empty=results.filter(r=>r.emptyFirstBar),both=results.filter(r=>!r.anchors.some(Boolean));
const initial=roster.map(enemy=>results.find(r=>r.enemy.kind===enemy.kind&&r.intentId===(enemy.intentOrder?.[0]??'guard')));
const yn=b=>b?'あり':'なし';
const lines=[
'# 最大ダメージ譜面の音楽性監査',
'',
'対象：現在の `EvaluationDebug.damageChart`。標準8体 × 行動予告6種＝48譜面（通常は出ない敵と予告の組み合わせも含む）。標準BPM・装甲、危険マスなし、音色・音高設定は探索対象外。譜面と生成ロジックの分析であり、実音を聴いた評価ではない。',
'',
'## 結論',
'',
'曲頭の支え、反復と応答、旋律の着地を持つ候補から最大ダメージを選ぶよう調整。調整前の記録は MAX_CHART_MUSIC_AUDIT.md に保存。音楽的な条件を設けたため、以前よりダメージが下がる敵もある。',
'',
`48譜面中、曲頭のキックがないものは${missing.length}、両小節の頭にキックがないものは${both.length}、最初の1小節にドラムが一音もないものは${empty.length}。ここで「拍頭」は最寄りの16分枠で判定し、±半枠未満のマイクロタイミングは欠落と数えない。`,
'',
'## 初手の実譜面',
'',
'●＝発音、·＝休符。4文字が1拍、縦線で小節区切り。表示は最寄りの16分位置で、グルーヴの微細な時差は省略。Bass・Leadは発音位置のみ。',
'',
'| 敵 | 予告 | 探索ダメージ | 小節頭Kick（1／2小節） | 小節頭Bass（1／2小節） |',
'|---|---|---:|---|---|',
...initial.map(r=>`| ${r.enemy.name} | ${r.intentId} | ${r.plan.total} | ${r.anchors.map(yn).join('／')} | ${r.bassAnchors.map(yn).join('／')} |`),
'',
...initial.flatMap(r=>{const step=60/r.enemy.bpm/4;return [`### ${r.enemy.name}`,'','```text',...['kick','snare'].map(type=>type.padEnd(5)+' '+grid(r.plan.parts.get('drums'),step,type)),...['bass','lead'].map(voice=>voice.padEnd(5)+' '+grid(r.plan.parts.get(voice),step)),'```',''];}),
'## 実装した調整',
'',
'- 曲頭にKick、各小節の頭に低いBassを配置。2小節目でKickを休む応答形はBassが拍を支える。',
'- Kick／Snareは拍位置ごとに定義し、反復・応答・末尾フィルを区別。最初の1小節が無音の候補を撤去。',
'- Hatは曲頭から一定の8分。レイドバックはSnareを遅らせ、ドランクは小節をまたいで再現する時差で表現。',
'- Bassは低音・長音、Leadは異なる発音位置と休符で応答。両者とも主音に戻る。音価はフレーズごとに設計。',
'- 有効グルーヴ・弱点相性を保ち、音楽的な条件を満たす候補でダメージを比較。戦闘計算の係数は変更していない。',
'',
'## 検証範囲',
'',
'自動テストで48通りの曲頭Kick・小節ごとのBass・旋律の終止・休符・非重複音価を確認。弱点が有効なこと、有効グルーヴの成立、通常評価の再計算一致も検証する。和声やコード進行を理解する作曲機能は含まない。',
'',
'## 拍頭Kickを追加しただけの反実仮想',
'',
'現在の勝者のBass・Lead・Hatは固定し、欠けている0／16ステップにKickを追加した単純比較。再探索の結果でも改善案の完成形でもない。属性やグルーヴが変わる可能性があるため、この差分だけで採否は決められない。',
'',
'| 敵 | 予告 | 現在 | Kick追加後 | 差 | 有効グルーヴ条件を維持 |',
'|---|---|---:|---:|---:|---|',
...results.filter(r=>r.anchors.some(b=>!b)).map(r=>`| ${r.enemy.name} | ${r.intentId} | ${r.plan.total} | ${r.counter} | ${r.counter-r.plan.total} | ${r.counterEffective?'はい':'いいえ'} |`),
'',
'再実行：`node scripts/audit-max-chart-music.cjs`。生成物：`MAX_CHART_MUSIC_CURRENT.md`。'
];
fs.writeFileSync(path.join(root,'MAX_CHART_MUSIC_CURRENT.md'),lines.join('\n')+'\n');
console.log(JSON.stringify({charts:results.length,missingOpeningKick:missing.length,missingBothDownbeats:both.length,emptyFirstBar:empty.length,initial:initial.map(r=>({kind:r.enemy.kind,total:r.plan.total,anchors:r.anchors,counter:r.counter,counterEffective:r.counterEffective}))}));
