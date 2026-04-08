# skillrelay_core パック

## 責務
全パック共通の基盤機能を提供。DomainEvent基底クラスとEventBus。

## 依存先
なし（最下層パック）

## 公開API（public/）
- SkillrelayCore::DomainEvent — イベント基底クラス（attribute定義）
- SkillrelayCore::EventBus — イベント発行・購読（同期: ActiveSupport::Notifications / 非同期: SQS）

## DBテーブル
なし
