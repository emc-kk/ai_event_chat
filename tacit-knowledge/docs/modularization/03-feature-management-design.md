# Feature Management 設計

## feature_management パックの内部構造

```
packs/feature_management/
  package.yml
  app/
    public/                                    # 全パックから参照可能
      feature_manager.rb                       # 公開API（下記参照）
    models/feature_management/                 # プライベート
      feature.rb                               # featuresテーブル（ツリー構造）
      company_feature.rb                       # company_featuresテーブル（企業別ON/OFF）
    controllers/feature_management/
      features_controller.rb                   # 管理画面: ツリー管理
      company_features_controller.rb           # 管理画面: 企業別ON/OFF設定
    services/feature_management/
      cascader.rb                              # カスケード処理（依存BC自動ON/OFF）
      sync.rb                                  # コード定数 → DB差分同期（起動時実行）
    constants/feature_management/
      features.rb                              # フラグマスタデータ定義（定数）
  spec/
```

public/ に置くのは `FeatureManager` のみ。他パックはこれだけ参照する。models, controllers, services, constants はすべてプライベート。

## 公開API

```ruby
# 参照（各BCから利用）
FeatureManager.for(company)                    # 企業のフラグコンテキスト取得
FeatureManager.for(company).enabled?(:hearing) # 特定フラグのON/OFF判定

# 更新（管理画面から利用）
FeatureManager.enable!(company, :web_monitor)  # ON（依存先も自動ON: datasource等）
FeatureManager.disable!(company, :datasource)  # OFF（依存元も自動OFF: web_monitor等）

# 起動時同期（initializer等から実行）
FeatureManager.sync!                           # コード定数とDBの差分同期
```

## フラグマスタデータ定義（コード内定数）

```ruby
# constants/feature_management/features.rb
module FeatureManagement
  module Features
    TREE = {
      hearing: {
        type: :bc,
        children: {
          hearing_form: { type: :screen },
          hearing_result: { type: :screen },
          plan_generation_job: { type: :background }
        }
      },
      datasource: {
        type: :bc,
        children: { ... }
      },
      web_monitor: {
        type: :bc,
        depends_on: [:datasource],  # パック間依存
        children: { ... }
      }
    }.freeze
  end
end
```

アプリ起動時に`FeatureManager.sync!`がTREE定数とDBを比較し、差分があればDBに反映する。seed/migrationは不要。

## DB構造

```
features
├── id
├── name              "hearing", "hearing_form", "scraping_job"
├── feature_type      bc / screen / background
├── parent_id         自己参照FK（NULLならBCルート）
├── created_at
└── updated_at

company_features
├── id
├── company_id        FK → companies.id
├── feature_id        FK → features.id
├── enabled           boolean（デフォルト: false）
├── created_at
└── updated_at
└── UNIQUE INDEX (company_id, feature_id)
```

`features` テーブルは `parent_id` による自己参照でツリー構造を形成する。データの例:

```
hearing (parent_id: NULL, type: bc)
├── hearing_form (parent_id: hearing, type: screen)
├── hearing_result (parent_id: hearing, type: screen)
└── plan_generation_job (parent_id: hearing, type: background)

datasource (parent_id: NULL, type: bc)
├── datasource_list (parent_id: datasource, type: screen)
├── datasource_upload (parent_id: datasource, type: screen)
└── file_indexing_job (parent_id: datasource, type: background)

web_monitor (parent_id: NULL, type: bc)
├── web_monitor_list (parent_id: web_monitor, type: screen)
├── web_monitor_config (parent_id: web_monitor, type: screen)
└── scraping_job (parent_id: web_monitor, type: background)

flow_screening (parent_id: NULL, type: bc)
├── screening_dashboard (parent_id: flow_screening, type: screen)
└── screening_process (parent_id: flow_screening, type: screen)
```

## 参照パターン

```ruby
# ApplicationControllerで1回読み込み
class ApplicationController < ActionController::Base
  before_action :load_feature_flags

  def load_feature_flags
    @features = FeatureManager.for(current_company)
  end
end

# ビューで判定
<% if @features.enabled?(:web_monitor) %>
  <%= render 'web_monitor_widget' %>
<% end %>
```

---

## 粒度定義

企業別に切り替え可能な「機能」を3レベルで定義する。

| レベル | 切り替え単位 | 例 |
|--------|-------------|-----|
| BC | ドメイン全体のON/OFF | 「Web定点観測」全体を無効化 |
| 画面 | 個別画面の表示/非表示。サイドバー導線も連動 | 「定点観測一覧画面」を非表示 |
| バックグラウンド | バッチジョブやワーカーのON/OFF | スクレイピングジョブを停止 |

画面内コンポーネント単位の切り替えは、管理コストが高く現時点では対象外。サイドバーのメニュー項目表示/非表示は画面単位に含める。

## カスケードルール

- BCをOFF → 配下の画面・BGすべて強制OFF
- 画面をOFF → サイドバーのナビ項目も自動非表示
- BGは画面と独立してON/OFF可能

## 常時有効な領域（切り替え対象外）

| 領域 | 役割 |
|------|------|
| feature_management | フラグ管理そのもの。パックとして独立（ドメインロジックが複雑なため） |
| platform | 認証、ユーザー管理、設定画面等のアプリ基盤（app/配下） |
| サイドバー/ナビ | Platform（app/配下）の責務。FeatureManager.enabled?で表示制御 |

## FeatureManager の責務

| コンポーネント | 責務 |
|---------------|------|
| `FeatureManager`（public/） | 企業別ON/OFF判定、親子関係の再帰チェック（全パックから参照可能） |
| `features` テーブル | フラグのツリー構造の永続化 |
| `company_features` テーブル | 企業ごとのON/OFF状態の永続化 |

参照の方向は一方向のみ: 各パック → feature_management。イベント購読ではなく読み取り。feature_management側は各パックの存在を知らない。

---

## 決定事項

| 項目 | 決定内容 |
|------|---------|
| portalダッシュボード | 専用パック不要。サイドバーはPlatform（app/配下）の責務のまま、FeatureManagerを読み取るだけ |
| フラグマスタデータ管理 | コード内定数で定義し、アプリ起動時にDBと差分同期（seed/migration不要） |
| パック間依存の整合性 | カスケードで自動解決（datasource OFF → web_monitor自動OFF、web_monitor ON → datasource自動ON） |
| フラグ名typo防止 | コード内定数で定義するため同時に解決。未定義フラグ参照時は例外 |
| ツリー深さ | BC→画面/BGの2階層固定。バリデーションで強制 |
| 管理画面UI | 実装フェーズで決定 |

## 未決事項

なし（管理画面UIは実装時に決定）

## 関連ドキュメント

- [アーキテクチャ設計](./01-architecture-design.md)
- [オンプレミス設計](./05-on-premise-design.md)
