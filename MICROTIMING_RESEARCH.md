# レイドバックの調査とゲームへの反映（2026-10-22）

## 調査で確認できたこと

- Sioros・Câmara・Danielsenの実験は、キック・スネア・ハイハット間と拍基準の時間差を分析し、同じレイドバック指示でも複数の奏法があると報告している。スネアがHatより遅れる型も、複数の楽器が拍より後ろに置かれる型も含まれる。分析では1拍目と3拍目のKickも区別しており、楽器全体の平均だけでは関係を失う。[Mapping Timing Strategies in Drum Performance, ISMIR 2019](https://archives.ismir.net/ismir2019/paper/000095.pdf)
- Questloveは『Voodoo』制作時、D’Angeloにビートを後ろへ引くことを求められ、さらにD’Angeloがその後ろに演奏したと本人の講演で説明している。[Questlove, Red Bull Music Academy 2013](https://www.redbullmusicacademy.com/lectures/questlove-new-york-2013/)
- Garrett Tylerの奏法解説は、Kick・Hatの独立した置き方とスネアの配置を扱う。曲ごとの関係を作る奏法であり、「スネアを一律に遅らせれば完成」という説明には収まらない。[DRUM! 2018, How To Add A ‘Questlove’ Feel](https://drummagazine.com/drum-lesson-how-to-add-a-questlove-feel-with-the-drag-beats-precise-sloppiness/)

これらは「必ず2拍目のKickを遅らせるほど美しい」「同じ遅延量が全曲で最適」という実証ではない。2拍目にKickを置くパターンも、2つ目のKickが3拍目などに来るパターンもあるため、ゲームでは特定の拍を必須にしない。

## ゲームとしての解釈・実装

- Snareだけ後ろ、KickとSnareの両方が後ろ、頭のKickを残して後続Kickだけ後ろ、のいずれも認識する。
- 入力補正前の時刻をHatと比較し、楽器別・小節内の位置別に遅延と再現性を調べる。同じ位置が別小節でも観測できた場合に、選択的なKick遅延と楽器間の連動を評価する。
- 精度表示も小節内の位置別に比較し、頭と後続Kickの意図的な違いを不正確さと混同しない。
- 安定して遅らせたKickとSnareが両方ある場合は、レイドバックの威力計算内に小さな連動効果を追加する。既存のSnare単独の効果と敵相性も保持する。遅らせる量の大きさだけで最大精度になる仕組みではない。
- 再生補正に「レイドバック（Kickも後ろ）」を追加。Hatと各小節頭のKickはグリッドを基準とし、Snareを最大35ms、後続Kickをその75%だけ遅らせる。テンポに応じた上限も適用。これは試聴用のゲーム内プリセットであり、研究から得た美的な正解値ではない。補正再生で演奏評価は上がらない。
- 最大ダメージの自動入力候補にも、Snare単独型に加えて後続Kickを遅らせる型を含める。

45msの強度基準、18msのばらつき尺度、最大1.5の追加威力などはゲーム調整値であり、知覚実験の閾値や普遍的な美しさの尺度ではない。
