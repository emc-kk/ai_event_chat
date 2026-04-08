# モジュール化 アーキテクチャ設計

## 全体像

```
core/
  app/                              # platform: 認証、Company、User等（常時有効）
  packs/
    skillrelay_core/               # 共通基盤: EventBus, DomainEvent基底クラス（常時有効）
    feature_management/             # 機能フラグ管理（常時有効）
    storage/                        # ファイル管理API（常時有効）
    chat/                           # チャット基盤（常時有効）
    hearing/                        # BC: ヒアリング
    manual/                         # BC: 動画マニュアル
    datasource/                     # BC: データソース
    web_monitor/                    # BC: Web定点観測（依存: datasource）
    flow_screening/                 # BC: 審査フロー

ai-server/
  packages/
    core/                           # 共通ツールインターフェース
    hearing/                        # ヒアリングエージェント
    datasource/                     # データソースRAGツール
    web-monitor/                    # Webスクレイピングツール

worker/
  src/handlers/
    hearing/
    manual/
    datasource/
    web_monitor/
```

## BC間依存マップ

```
【共通コンテキスト】全パックから参照される（常時有効・切り替え対象外）
  platform              認証、Company、User等（app/配下）
  skillrelay_core      EventBus、DomainEvent基底クラス
  feature_management    ON/OFF判定（読み取りのみ）
  storage               ファイル管理API（S3操作の統一窓口）
  chat                  チャット基盤（rooms, messages）

【ドメインコンテキスト】企業別にON/OFF切り替え可能
  hearing ──→ (依存なし)
  manual ──→ (依存なし)
  datasource ──→ (依存なし)
  web_monitor ──→ datasource
  flow_screening ──→ (依存なし)
```

---

## なぜ Packwerk + packs-rails か

Packwerk（Shopify製）+ packs-rails（Gusto製）をベースに、DDDから実利のある要素だけ取り入れるハイブリッド。

**Packwerkを選んだ理由**

- 3コマンドで導入完了（`bundle add packs-rails` → `bundle binstub packwerk` → `bin/packwerk init`）
- 既存コードを一切触らずに始められる。新パックに新機能を書くだけ
- 境界を段階的に厳しくできる（`enforce_dependencies: false` → `true`）
- 既存の違反は `package_todo.yml` に記録。新しい違反だけCIで弾く
- `public/` ディレクトリで公開/非公開が物理的に分かれる → AIがコンテキストを機械的に判断できる
- Shopify（280万行）、Pennylane（120人エンジニア）、Doximity等で実績あり

**Rails Enginesを選ばなかった理由**

- gemspec作成、Gemfileへの登録、Engine class定義等のオーバーヘッド
- 公開/非公開の区別がコード上にない（規約に頼る）
- 現在のBC数（4-5個）、テーブル数（40-50個）の規模にはオーバー

**取り入れるDDD要素**

- Bounded Contextの明示的定義 → `package.yml` + `public/` ディレクトリ
- Domain Event → `ActiveSupport::Notifications`（同期）/ SQS（非同期）
- Anti-Corruption Layer → 各パックの `contracts/` ディレクトリ

**捨てるDDD要素**

- Event Sourcing（コード量3-5倍に見合わない）
- CQRS（読み書き分離ニーズがない）
- Aggregate Root（ActiveRecordとの相性が悪い）

---

## パック内部構造

### package.yml の例

```yaml
# packs/web_monitor/package.yml
enforce_dependencies: true
enforce_privacy: true
dependencies:
  - packs/skillrelay_core
  - packs/feature_management
  - packs/datasource
```

### パック内ディレクトリ構造（例: hearing）

```
packs/hearing/
  package.yml                       # 依存宣言 + privacy設定
  app/
    public/                         # 他パックに公開するAPI（これ以外はプライベート）
      hearing.rb
      hearing/
        result.rb
    models/hearing/                 # プライベート
    controllers/hearing/
    events/hearing/
      hearing_completed.rb
      plan_generated.rb
    contracts/hearing/              # ACL: 他パックへの公開インターフェース
  spec/
```

`public/` の外 = プライベート。他パックから参照すると `packwerk check` でCIが落ちる。

### DB設計原則

| ルール | 内容 |
|--------|------|
| Core Schema固定 | users, companies, rooms, messages等は変更しない |
| プレフィックスなし | テーブル名にBC固有プレフィックスは付けない。所属はPackwerkのディレクトリ構造で管理する |
| 既存テーブルはリネームしない | `hearing_extracts`等の既存テーブル名はそのまま維持 |
| 依存方向は一方向のみ | 機能テーブル → 共通テーブルへのFKはOK。逆は禁止 |
| Feature削除の安全性 | 機能固有テーブルを全削除してもCoreに影響しない |

→ Domain Event一覧・Contracts設計・中間テーブルの所属は [02-domain-event-design.md](./02-domain-event-design.md) を参照

---

## CLAUDE.md コンテキスト設計

Packwerkのパック構造を活かし、Claude Codeが作業時に読むコンテキストを最小限に抑える。

### CLAUDE.md 階層

```
core/
  CLAUDE.md                         # ルート: 全体構造、パック一覧、作業ルール
  packs/
    skillrelay_core/CLAUDE.md
    feature_management/CLAUDE.md
    hearing/CLAUDE.md
    datasource/CLAUDE.md
    web_monitor/CLAUDE.md
    flow_screening/CLAUDE.md

ai-server/
  CLAUDE.md
  packages/hearing/CLAUDE.md

worker/
  CLAUDE.md
```

### コンテキストルール

- 特定パックの作業時: そのパックのCLAUDE.md + 依存パックのpublic/のみ参照
- パック横断の作業時: ルートCLAUDE.md + 関連パックのCLAUDE.mdを参照
- 共通機能（app/配下）の作業時: ルートCLAUDE.md + app/の構造を参照

### パック単位CLAUDE.md テンプレート

```markdown
# {パック名} パック

## 責務
{1-2行の説明}

## 依存先（package.yml参照）
- skillrelay_core: {利用目的}
- feature_management: FeatureManager.enabled?(:{flag_name})

## 公開API（public/）
- {パック名}::Api.{method}({args})

## Domain Events
- {パック名}::Events::{EventName}（属性: ...）

## DBテーブル
- {table}: {説明}

## AI Server対応
- ai-server/packages/{パック名}/ にツール定義あり

## Worker対応
- worker/src/handlers/{パック名}/ にハンドラあり
- action_type: {routing_key}
```

### コンテキスト絞り込みの仕組み

`package.yml` の dependencies が「どのパックのpublic/を読むか」を機械的に決定する。
Packwerkの境界 = Claude Codeのコンテキスト境界。

### 運用ルール

| タイミング | やること |
|-----------|---------|
| 新パック作成時 | package.ymlとCLAUDE.mdを同時に作成 |
| 公開API変更時 | CLAUDE.mdの公開APIセクションも同時更新 |
| テーブル追加時 | CLAUDE.mdのDBテーブルセクションに追記 |
| イベント追加時 | 発行側・購読側両方のCLAUDE.mdに追記 |
| 依存追加時 | package.ymlとCLAUDE.mdの依存先セクションを同時更新 |

CLAUDE.mdはコードと同じくレビュー対象。実装との乖離を防ぐ。

---

## 実装工数

### Phase 1: 要件定義・設計

| フェーズ | 工数 | 内容 |
|---------|------|------|
| 依存分析 | 0.5日 | Packwerk導入 + 既存コードの依存可視化 |
| BC境界決定 | 1-2日 | イベントストーミング、パック分割の叩き台作成 |
| 公開API・イベント設計 | 1-2日 | public/の設計、ドメインイベント洗い出し |
| テーブル帰属決定 | 0.5-1日 | テーブル→パックのマッピング |
| 移行計画策定 | 0.5日 | 優先度順の移行ロードマップ |

### Phase 2: 基盤構築

| フェーズ | 工数 | 内容 |
|---------|------|------|
| Packwerk導入 | 0.5日 | gem追加、init、CI設定 |
| EventBus基盤 | 1-2日 | ActiveSupport::Notifications + SQSラッパー |
| FeatureManager基盤 | 1-2日 | フラグツリー、企業別ON/OFF |

### Phase 3: パック化

| フェーズ | 工数 | 内容 |
|---------|------|------|
| 最初のパック作成 | 1-2日 | 新機能 or 独立性の高い既存機能から着手 |
| 既存機能のパック化 | 各1-3日 | 優先度順に段階的に移行 |

---

## 関連ドキュメント

- [Domain Event・Contracts設計](./02-domain-event-design.md)
- [Feature Management設計](./03-feature-management-design.md)
- [Storage設計](./04-storage-design.md)
- [オンプレミス設計](./05-on-premise-design.md)
- [実装計画](./06-implementation-plan.md)
- [アーキテクチャ概要](../architecture-overview.md)
