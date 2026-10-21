const fs=require('node:fs'),path=require('node:path');
const {drums}=require('./audit-balance.cjs');
const root=path.resolve(__dirname,'..'),dir=path.join(root,(process.env.RIDUMU_AUDIT_DIR||'balance-after')),read=n=>JSON.parse(fs.readFileSync(path.join(dir,n+'.json'),'utf8'));
const meta=read('metadata'),single=read('single-turn'),battle=read('battles'),probe=read('probes');
const avg=(rows,key)=>rows.reduce((sum,row)=>sum+row[key],0)/rows.length;
const first=new Map(),canonical=new Map();
for(const p of meta.patterns){const key=JSON.stringify(meta.roster.map(e=>drums(p,e.bpm)));if(!first.has(key))first.set(key,p.id);canonical.set(p.id,first.get(key));}
const unique=row=>canonical.get(row.pattern)===row.pattern;
const aliases=[...canonical].filter(([a,b])=>a!==b);
const families=[...new Set(meta.patterns.filter(p=>!p.stress&&p.id!=='silence').map(p=>p.family))].map(family=>{
 const rows=battle.runs.filter(r=>r.family===family&&r.bundle==='balanced'&&unique(r));
 return {family,n:rows.length,wins:rows.filter(r=>r.won).length,capped:rows.filter(r=>r.capped).length,winRate:rows.filter(r=>r.won).length/rows.length,winningRounds:avg(rows.filter(r=>r.won),'rounds')};
});
const patternStats=meta.patterns.map(p=>{const rows=single.matrix.filter(r=>r.pattern===p.id),runs=battle.runs.filter(r=>r.pattern===p.id&&r.startHp===100&&r.bundle==='balanced'),campaign=battle.campaigns.find(r=>r.pattern===p.id&&r.startHp===100);return {pattern:p.id,family:p.family,count:p.slots.length,damage:avg(rows,'damage'),quality:avg(rows,'quality'),maxDamage:Math.max(...rows.map(r=>r.damage)),wins:runs.filter(r=>r.won).length,trials:runs.length,campaign:campaign?{won:campaign.won,cleared:campaign.cleared,rounds:campaign.totalRounds,hp:campaign.remainingHp,capped:campaign.encounters.at(-1).row.capped}:null};});
const enemies=meta.roster.map(enemy=>{
 const rows=battle.runs.filter(r=>r.enemy===enemy.kind&&r.startHp===100&&r.bundle==='balanced'&&unique(r)),fixed=rows.filter(r=>r.won).sort((a,b)=>a.rounds-b.rounds||b.remainingHp-a.remainingHp);
 const actionWinners=['guard','heavy','pierce','heal','buff','special'].map(intent=>{const m=single.matrix.filter(r=>r.enemy===enemy.kind&&r.intent===intent&&!r.stress&&unique(r)).sort((a,b)=>b.damage-a.damage||a.count-b.count||a.pattern.localeCompare(b.pattern));return {intent,pattern:m[0].pattern,damage:m[0].damage,element:m[0].element};});
 return {name:enemy.name,kind:enemy.kind,hp:enemy.hp,firstIntent:enemy.intentOrder?.[0]??'guard',fixedTrials:rows.length,fixedWins:fixed.length,fixedLosses:rows.filter(r=>!r.won&&!r.capped).length,fixedCapped:rows.filter(r=>r.capped).length,best:fixed[0],actionWinners};
});
const roles=[...new Set(single.partRows.map(r=>r.variant))].map(variant=>{const rows=single.partRows.filter(r=>r.variant===variant);return {variant,n:rows.length,damage:avg(rows,'damage'),shield:avg(rows,'shield'),received:avg(rows.filter(r=>['heavy','pierce','special'].includes(r.intent)),'received')};});
const modes=['two','four','seven','nine'].map(mode=>{const rows=single.modeRows.filter(r=>r.mode===mode);return {mode,damage:avg(rows,'damage'),shield:avg(rows,'shield'),received:avg(rows.filter(r=>['heavy','pierce','special'].includes(r.intent)),'received')};});
const topCases=[];for(const enemy of meta.roster)for(const intent of ['guard','heavy','pierce','heal','buff','special']){const rows=single.matrix.filter(r=>r.enemy===enemy.kind&&r.intent===intent&&!r.stress&&unique(r)),max=Math.max(...rows.map(r=>r.damage));topCases.push({enemy:enemy.kind,intent,winners:rows.filter(r=>r.damage===max).map(r=>r.pattern)});}
const swingTopCases=topCases.filter(c=>c.winners.some(id=>id.startsWith('swing_'))).length;
const synergy={n:single.synergyRows.length,damage:single.synergyRows.reduce((s,r)=>s+r.damage-r.without,0)/single.synergyRows.length,shield:single.synergyRows.reduce((s,r)=>s+r.shield-r.shieldWithout,0)/single.synergyRows.length,maxDamage:Math.max(...single.synergyRows.map(r=>r.damage-r.without)),kinds:Object.fromEntries([...new Set(single.synergyRows.flatMap(r=>r.selected.map(s=>s.id)))].map(id=>[id,single.synergyRows.filter(r=>r.selected.some(s=>s.id===id)).length]))};
const summary={aliases,uniqueTemplates:meta.patterns.length-aliases.length,uniquePlayableTemplates:meta.patterns.filter(p=>!p.stress&&p.id!=='silence'&&canonical.get(p.id)===p.id).length,families,patternStats,enemies,roles,modes,synergy,swingTopCases,campaigns:battle.campaigns.map(({encounters,...rest})=>rest),capped:battle.runs.filter(r=>r.capped).length,poisonCases:battle.runs.filter(r=>r.totalPoison>0).length};
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(summary,null,2));
const fmt=x=>typeof x==='number'?(Number.isInteger(x)?x:x.toFixed(1)):x;
const table=(headers,rows)=>[headers,headers.map(()=>':---'),...rows].map(r=>'| '+r.map(fmt).join(' | ')+' |').join('\n');
const text=[
 '# 検証表（機械生成）',
 'この表の全平均は各敵・各行動を等しい重みで集計。勝率は固定ケースの比率で、人間の確率的勝率ではない。',
 '## 譜面',table(['ID','分類','Drums数','平均D','再現性倍率','単体勝利 HP100','8連戦 HP100'],patternStats.map(r=>[r.pattern,r.family,r.count,r.damage,r.quality.toFixed(3),r.trials?r.wins+'/'+r.trials:'対象外',r.campaign?(r.campaign.won?'勝利':r.campaign.capped?'打切':'敗北')+' / '+r.campaign.cleared+'体 / '+r.campaign.rounds+'巡':'対象外'])),
 '## 敵・行動別の火力最大候補',table(['敵','防御','強打','貫通','回復','強化','溜め'],enemies.map(e=>[e.name,...e.actionWinners.map(r=>r.pattern+' / '+r.damage)])),
 '## パート',table(['変更','条件数','平均D','盾','被HPダメージ（攻撃3行動）'],roles.map(r=>[r.variant,r.n,r.damage,r.shield,r.received])),
 '## 音数モード（同じ9発のLead）',table(['モード','平均D','盾','被HPダメージ（攻撃3行動）'],modes.map(r=>[r.mode,r.damage,r.shield,r.received])),
 '## 系統別・固定譜面の12巡以内の成功率（同一入力の別名を除外）',table(['分類','勝利/ケース','%','12巡打切','勝利時の平均巡'],families.map(r=>[r.family,r.wins+'/'+r.n,100*r.winRate,r.capped,r.winningRounds])),
 '## テンポ／Hatの影響',table(['BPM','譜面','Hat間隔/16分','基本属性','最終属性','ドランク','レイドバック','スウィング'],probe.timing.filter(r=>['alternate_1','dense_K'].includes(r.pattern)).map(r=>[r.bpm,r.pattern,r.hatGrid,r.baseElement,r.element,r.drunk.toFixed(3),r.laidBack.toFixed(3),r.swing.toFixed(3)])),
 '## 重複テンプレート',JSON.stringify(aliases)
 ].join('\n\n')+'\n';
fs.writeFileSync(path.join(dir,'tables.md'),text);
console.log(JSON.stringify({aliases,uniqueTemplates:summary.uniqueTemplates,playable:summary.uniquePlayableTemplates,swingTopCases,synergy,capped:summary.capped,poisonCases:summary.poisonCases}));
