# SkillRelay ドキュメント

## 概要

SkillRelayは、AIを活用したナレッジ収集・検証システムです。ユーザーへのヒアリングを通じて専門知識を収集し、その内容をAIが検証・整理します。

## ドキュメント一覧

### アーキテクチャ

| ドキュメント | 内容 | 対象者 |
|------------|------|--------|
| [アーキテクチャ概要](./architecture-overview.md) | サービス構成・通信・インフラ・設定値 | 全開発者 |
| [データフロー](./data-flow.md) | チャット・RAG処理の流れ | 全開発者 |
| [データソース管理 + 権限システム仕様](./ds-acl-spec.md) | DS管理・ACL・DS↔トピック連携 | バックエンド / フロントエンド開発者 |
| [社内辞書仕様](./glossary-spec.md) | 社内辞書CRUD・権限・AI注入設計 | バックエンド / フロントエンド開発者 |
| [ソクラテス式ヒアリング設計](./architecture/socratic-hearing-architecture.md) | ヒアリングエージェントの設計思想 | AI機能担当者 |
| [5軸アライメント変更履歴](./architecture/5axis-alignment-changelog.md) | 評価軸の変更経緯 | AI機能担当者 |

### デモ

| ドキュメント | 内容 | 対象者 |
|------------|------|--------|
| [富士電機 エネルギー調達ダッシュボード](./fuji-electric-demo.md) | データソース・ダッシュボード・デプロイ手順 | 全開発者 |

### 運用・デプロイ

| ドキュメント | 内容 | 対象者 |
|------------|------|--------|
| [プレビュー環境 運用ガイド](./preview-operations-guide.md) | mock ブランチ運用・Self-hosted Runner・CloudFormation 操作 | 全開発者 |
| [プレビュー環境 検証手順書](./preview-verification-guide.md) | プレビューデプロイ後の検証チェックリスト | 全開発者 |

### テスト・品質

| ドキュメント | 内容 | 対象者 |
|------------|------|--------|
| [テストカバレッジ](./ds-acl-test-coverage.md) | テスト実施状況・今後の予定 | QA / 全開発者 |

### インシデント

| ドキュメント | 内容 | 対象者 |
|------------|------|--------|
| [2026-02-23 プレビューDB破壊](./incidents/2026-02-23-preview-db-destruction.md) | DB分離方式変更の経緯と教訓 | 全開発者 |
| [2026-03-04 トピックチャットDS参照不可](./incidents/2026-03-04-topic-chat-datasource-failure.md) | DS連携の5つの問題と修正 | 全開発者 |

### サービス別 README

| ドキュメント | 内容 |
|------------|------|
| [Core README](../core/README.md) | Rails + React メインアプリ |
| [AI Server README](../ai-server/README.md) | Next.js + Mastra AI サーバー |
| [Worker README](../worker/README.md) | Python SQS ワーカー |
| [CloudFormation README](../cloudformation/README.md) | AWS インフラ定義 |

## 推奨する読み順

1. **[アーキテクチャ概要](./architecture-overview.md)** - サービス構成・通信・インフラの全体像を把握
2. **[データフロー](./data-flow.md)** - チャット・RAG・ドキュメント処理の流れを理解
3. **[データソース管理 + 権限システム仕様](./ds-acl-spec.md)** - DS管理・権限・DS↔トピック連携の詳細
4. **[社内辞書仕様](./glossary-spec.md)** - 社内辞書のCRUD・権限・AI注入の設計を理解
5. **[ソクラテス式ヒアリング設計](./architecture/socratic-hearing-architecture.md)** - ヒアリングAIの設計思想を理解
6. **[プレビュー環境 運用ガイド](./preview-operations-guide.md)** - mock ブランチでのプレビューデプロイ方法を把握
7. **[2026-02-23 プレビューDB破壊](./incidents/2026-02-23-preview-db-destruction.md)** - 過去の障害と教訓を学ぶ

## プロジェクト構成

```
skillrelay/
├── core/           # Rails 8 + React (メインアプリ)
├── ai-server/      # Next.js + Mastra (AIサーバー + デモダッシュボード)
├── worker/         # Python SQS Worker (ドキュメント処理・Plan/QA/Manual生成)
├── data_acquisition/  # Data Acquisition スクレイピング基盤 (Scheduler + Worker + Scraper)
├── cloudformation/ # AWSインフラ定義 (13テンプレート)
└── docs/           # このドキュメント
```
