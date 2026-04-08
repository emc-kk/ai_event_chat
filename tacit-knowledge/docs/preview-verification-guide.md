# プレビュー環境 検証手順書

## 現在のプレビュー環境一覧

| 環境 | ブランチ | Core URL | AI Server URL | PR |
|---|---|---|---|---|
| suntory | `mock/suntory` | `https://dbiigethey.ap-northeast-1.awsapprunner.com` | `https://m7nm5ctegr.ap-northeast-1.awsapprunner.com` | #95 |
| daiwa | `mock/daiwa` | `https://fmzjwi93bm.ap-northeast-1.awsapprunner.com` | `https://43smnuzndj.ap-northeast-1.awsapprunner.com` | #74 |
| ds-acl | `mock/ds-acl` | `https://znkxmvzcgn.ap-northeast-1.awsapprunner.com` | `https://utxmmajgjp.ap-northeast-1.awsapprunner.com` | #91 |

> **注意**: URLはCloudFormationスタック作成時にApp Runnerが自動生成します。環境をdestroyして再作成するとURLが変わります。各プレビュー環境は独立したSQSキュー、S3バケット、PostgreSQLデータベースを持ち、本番環境とリソースが完全に分離されています。
>
> デプロイ済みの全環境一覧は GitHub Actions の「List Preview Environments」ワークフローで確認できます。

## ログイン情報

### プレビュー専用アカウント

プレビュー環境では `PREVIEW_ENV=true` が設定されており、以下のseedアカウントが自動作成されます。

| 役割 | メールアドレス | パスワード |
|---|---|---|
| Privileged Admin | `admin@example.com` | `Password1!` |
| Company Admin（株式会社サンプル） | `admin1@example.com` | `Password1!` |
| Company Admin（テスト株式会社） | `admin2@example.com` | `Password1!` |
| User（株式会社サンプル、経理部editor） | `user1@example.com` | `Password1!` |
| User（テスト株式会社、権限なし） | `user4@example.com` | `Password1!` |

また、CloudFormationテンプレートで設定されるプレビュー管理者:

| 役割 | メールアドレス | パスワード |
|---|---|---|
| Preview Admin | `preview@skillrelay.ai` | `Preview@2026` |

## 検証手順

### 1. ヘルスチェック

各環境のヘルスエンドポイントにアクセスし、正常応答を確認する。

| エンドポイント | 期待される応答 |
|---|---|
| Core: `{URL}/up` | HTTP 200（空ボディ） |
| AI Server: `{URL}/api/health` | `{"status":"ok"}` |

```bash
# 例: suntory環境
curl -s -o /dev/null -w "%{http_code}" https://dbiigethey.ap-northeast-1.awsapprunner.com/up
curl -s https://m7nm5ctegr.ap-northeast-1.awsapprunner.com/api/health
```

### 2. ログイン検証

1. Core URLにブラウザでアクセス
2. `/users/sign_in` にリダイレクトされることを確認
3. 上記の認証情報でログイン
4. ダッシュボードが表示されることを確認

### 3. 基本機能検証

| 確認項目 | 手順 | 期待結果 |
|---|---|---|
| ログイン | メールアドレス/パスワードで認証 | ダッシュボード表示 |
| トピック一覧 | サイドメニューからトピック一覧を開く | トピックが表示される |
| ユーザー管理 | Admin権限でユーザー一覧を開く | ユーザーが表示される |
| AI Server連携 | AIチャット機能を使用 | 応答が返る |

### 4. 環境固有の検証

#### suntory（サントリーデモ）
- [ ] 5トピック（樽庫巡回、度数測定、税務署対応、未納税移出、蒸留判断）の表示
- [ ] 音声ヒアリングの動作
- [ ] Q&Aモード（テキスト/音声）の動作

#### daiwa（大和デモ）
- [ ] フィードデータv2統合の動作
- [ ] 72レコード・42観点のヒアリング

#### ds-acl（データソース管理+権限）
- [ ] データソース管理の動作
- [ ] Permission権限システムの動作

## トラブルシューティング

### ログイン時に500エラー

DB移行が完了していない可能性があります。App Runnerのログを確認してください。

```bash
# CloudFormation stackからサービスARNを取得
aws cloudformation describe-stacks \
  --stack-name skillrelay-mock-{slug} \
  --query "Stacks[0].Outputs"

# App Runnerのログを確認
aws logs tail /aws/apprunner/skillrelay-mock-{slug}-core/... --follow
```

### ヘルスチェックが失敗

- AI Serverが先に起動完了しているか確認（CoreはAI Serverに依存）
- CloudFormationスタックのイベントを確認

```bash
aws cloudformation describe-stack-events \
  --stack-name skillrelay-mock-{slug} \
  --query "StackEvents[?ResourceStatus=='CREATE_FAILED']"
```
