## デフォルトブランチ
- デフォルトブランチは `mock/main`（`main` ではない）
- PR作成時のベースブランチは `mock/main` を指定すること

## モジュール化実装ログ
- モジュール化の各Step実装後、docs/modularization/06-implementation-plan.md の「実装ログ」セクションに知見・ハマりポイント・次Stepへの申し送りを必ず記録すること

## Packwerk
- `packwerk-extensions` gemで `enforce_privacy: true` を各パックのpackage.ymlに設定済み
- パックのpackage.ymlでルートパッケージへの依存は `dependencies: ["."]` で宣言

## ブランチ保護ルール
- `main` および `mock/main` へのマージは**絶対に行わない**
- PRの作成は可能だが、マージは人間が行う
- `git push origin main` / `git push origin mock/main` は禁止

## リリース運用
現状以下になっているのでPR作成する際は注意
```
開発ブランチ → mock/main(STG, Default) → main(PROD)
```
