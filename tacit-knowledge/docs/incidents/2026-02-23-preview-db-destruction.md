# インシデントレポート: プレビュー環境による本番DB破壊 (2026-02-23)

## サマリ

| 項目 | 内容 |
|---|---|
| 発生日 | 2026-02-23 |
| 影響 | 本番環境の全ユーザーがログイン不可 |
| 根本原因 | プレビュー環境の `db:schema:load` が本番 `public` スキーマのテーブルを DROP |
| 復旧時間 | 約1時間（テーブル再作成 + データリカバリ） |
| データ消失 | 2/15〜2/20 の差分データ |
| 対応PR | #92（応急処置）、#93（根本対策） |

## タイムライン

| 時刻 (JST) | 内容 |
|---|---|
| 不明（2/20以前） | プレビュー環境デプロイにより `public` スキーマのテーブルが消失 |
| 2/23 10:18 | PR #83, #85 マージに伴う本番デプロイ。テーブル消失に気づかず起動成功 |
| 2/23 11:15頃 | ログイン試行で 500 エラー検知 |
| 2/23 11:30頃 | `PG::UndefinedTable: relation "users" does not exist` を確認 |
| 2/23 11:45頃 | `public` スキーマにテーブルが一切存在しないことを確認 |
| 2/23 12:00頃 | `schema_migrations` 削除 + 再デプロイでテーブル復元 |
| 2/23 12:10頃 | **サービス復旧完了** |
| 2/23 12:30頃 | 応急処置 PR #92 マージ |
| 2/23 13:00頃 | 2/15スナップショットから**データ復旧完了** |
| 2/23 15:00頃 | 根本対策 PR #93 マージ（スキーマ分離 → DB分離） |
| 2/23 19:57 | 全プレビュー環境（suntory, daiwa, ds-acl）のデプロイ成功を確認 |

## 原因分析

### 直接原因

プレビュー環境が本番と同じDBの `public` スキーマを破壊した。

```
search_path = "mock_xxx, public"

db:schema:load
  → CREATE TABLE ... FORCE: CASCADE
  → PostgreSQL が search_path に沿って public のテーブルを発見
  → DROP TABLE (public.users, public.topics, ...)
  → CREATE TABLE は mock_xxx にのみ作成
  → public スキーマのテーブルが全消失
```

### 発見が遅れた理由

1. **ヘルスチェック `/up` がDB非依存**: テーブル消失後もデプロイ「成功」と判定
2. **エラー握りつぶし**: `Admin.count` チェックで `2>/dev/null` によりDB異常が検知されなかった
3. **ログインするまでエラーが表面化しなかった**

### なぜスキーマ分離が危険だったか

同一データベース内でスキーマを分けるアプローチでは:
- `schema_search_path` に `public` が含まれると、既存テーブルへのDROPが発生しうる
- `db:schema:load` の `force: :cascade` は search_path 上のテーブルを無条件にDROP
- Rails の DB マイグレーション機構はスキーマ分離を想定していない

## 対応内容

### Phase 1: 応急処置（PR #92）

- `database.yml`: schema:load 時の search_path をプレビュースキーマのみに限定
- `docker-entrypoint`: `Admin.count` の `2>/dev/null` を除去し、異常時にコンテナ起動を失敗させる

### Phase 2: 根本対策（PR #93）— スキーマ分離 → DB分離

**方針変更**: 同一DB内のスキーマ分離を廃止し、プレビューごとに独立したデータベースを作成。

| 項目 | Before（スキーマ分離） | After（DB分離） |
|---|---|---|
| プレビューDB | `skillrelay_production` + `mock_xxx` スキーマ | `skillrelay_mock_xxx` データベース |
| search_path | `mock_xxx, public` | `public`（デフォルト） |
| 本番への影響 | `public` スキーマを破壊するリスクあり | **完全分離、影響なし** |
| 追加コスト | $0 | $0（同一RDSインスタンス） |

#### 変更ファイル（13ファイル）

| カテゴリ | ファイル | 変更内容 |
|---|---|---|
| CI/CD | `.github/workflows/preview-deploy.yml` | CREATE SCHEMA → CREATE DATABASE |
| CI/CD | `.github/workflows/preview-destroy.yml` | DROP SCHEMA → DROP DATABASE |
| IaC | `cloudformation/templates/11-preview.yml` | `PostgresSchema` → `PreviewDatabase` パラメータ |
| Core | `core/config/database.yml` | `schema_search_path` 条件分岐を削除 |
| Core | `core/bin/docker-entrypoint` | 40行 → 8行に簡素化 |
| Core | `core/db/fixtures/production/000.companies.rb` | `POSTGRES_SCHEMA` → `PREVIEW_ENV` |
| Core | `core/db/fixtures/production/001.admins.rb` | 同上 |
| Core | `core/db/fixtures/production/002.preview_users.rb` | 同上 |
| Worker | `worker/src/config.py` | `POSTGRES_SCHEMA` 削除 |
| Worker | `worker/src/utils/database.py` | `search_path` 設定削除 |
| AI Server | `ai-server/lib/config/index.ts` | `search_path` URL付与削除 |
| AI Server | `ai-server/lib/services/database-service.ts` | `SET search_path` 削除 |
| AI Server | `ai-server/lib/rag/vector-store.ts` | `SET search_path` 削除 |

### Phase 3: デプロイ安定化

brushup（→ suntory）環境のデプロイが繰り返し失敗した問題の調査と修正。

| 問題 | 原因 | 対策 |
|---|---|---|
| CFnスタックがROLLBACK_COMPLETEで更新不可 | 前回失敗のスタックが残留 | 自動クリーンアップステップ追加 |
| CFnスタック作成タイムアウト | `aws cloudformation deploy` のデフォルトタイムアウト不足 | `create-stack --timeout-in-minutes 20` に変更 |
| App Runnerサービス起動失敗 | **`CLOUDFRONT_PRIVATE_KEY` SSMシークレットの解決失敗** | 該当行を削除（daiwaに合わせる） |

**根本原因**: brushupブランチ独自に追加された `CLOUDFRONT_PRIVATE_KEY` の `RuntimeEnvironmentSecrets` がApp Runnerで解決できず、サービスが起動しなかった。daiwaにはこの設定がなく成功していた。

## データリカバリ

2/15時点のRDSスナップショットから復旧。

| テーブル | 件数 | 備考 |
|---|---|---|
| admins | 4 | |
| companies | 3 | |
| users | 8 | ポリモーフィック変換あり |
| topics | 33 | folder_id追加 |
| rooms | 101 | |
| requests | 66 | |
| messages | 351 | |
| その他 | 多数 | request_contents, transcriptions等 |

**データ消失期間**: 2/15〜2/20 の間に追加・更新されたデータは失われている可能性がある。

## 再発防止策

| 対策 | 状態 | 詳細 |
|---|---|---|
| DB分離方式への移行 | **完了** | PR #93 |
| `POSTGRES_SCHEMA` / `schema_search_path` の全廃 | **完了** | PR #93 |
| docker-entrypointのエラー検知強化 | **完了** | PR #92 |
| mainとmockブランチのインフラ差分ゼロ化 | **完了** | mainにCFn改善をコミット後merge |

## 今後の検討事項

- ヘルスチェックにDB接続確認を追加する
- 本番データのバックアップ・リストア手順を整備する
- RDSの自動スナップショット保持期間を確認・延長する
- プレビュー環境のCLOUDFRONT_PRIVATE_KEY対応（必要な場合はSSMパラメータとIAMロールの整備）
