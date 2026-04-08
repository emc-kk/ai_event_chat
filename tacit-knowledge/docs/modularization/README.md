# モジュール化設計

Skillrelayのモジュール化（Packwerk + packs-rails）に関する設計ドキュメント。

| # | ドキュメント | 内容 |
|---|-------------|------|
| 01 | [アーキテクチャ設計](./01-architecture-design.md) | BC構造、依存マップ、DB設計原則、CLAUDE.mdコンテキスト設計 |
| 02 | [Domain Event・Contracts設計](./02-domain-event-design.md) | Domain Event一覧、Contracts（ACL）設計、中間テーブルの所属 |
| 03 | [Feature Management設計](./03-feature-management-design.md) | 機能フラグのツリー構造、企業別ON/OFF、カスケードルール |
| 04 | [Storage設計](./04-storage-design.md) | ファイル管理テーブル分析、Storage公開API、S3キー命名規則 |
| 05 | [オンプレミス設計](./05-on-premise-design.md) | SaaS/オンプレの提供形態と運用方針 |
| 06 | [実装計画](./06-implementation-plan.md) | 実装順序、デグレ防止テスト方針、決定事項、未決事項、実装ログ |
