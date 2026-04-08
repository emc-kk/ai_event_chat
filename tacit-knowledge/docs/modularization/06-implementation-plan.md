# モジュール化 実装計画

## 決定事項

| 項目 | 決定内容 |
|------|---------|
| モジュール化手法 | Packwerk + packs-rails |
| テーブル名プレフィックス | 付けない。所属はPackwerkのディレクトリ構造で管理 |
| 既存テーブルのリネーム | しない |
| 共通基盤 | skillrelay_core（EventBus）, feature_management（フラグ管理）, storage（ファイル管理） |
| ActiveStorage | 移行しない。デッドテーブルを削除し、自前のStorage APIを構築 |

## BC一覧

### 共通コンテキスト（常時有効・切り替え対象外）

| BC | テーブル | 責務 |
|----|---------|------|
| **Platform**（app/配下） | companies, admins, users, topics, topic_folders, topic_permissions, company_glossary_terms | 認証・企業・ユーザー・トピック管理 |
| **skillrelay_core** | なし | EventBus・DomainEvent基底クラス |
| **feature_management** | features, company_features | フラグ管理・企業別ON/OFF |
| **storage** | （テーブルなし。APIレイヤーのみ。各BCがファイルテーブルを所有） | ファイル管理API（S3キー管理・presigned URL生成） |
| **chat** | rooms, messages, message_files | チャット基盤（hearing/topic/validation共通） |

### ドメインコンテキスト（企業別にON/OFF切り替え可能）

| BC | テーブル | 責務 |
|----|---------|------|
| **Hearing** | requests, request_contents, hearing_extracts, hearing_step_states, hearing_suggestions, bias_flags, contradiction_flags | ヒアリングエージェント |
| **Manual** | manuals, chapters, transcriptions | 動画マニュアル生成 |
| **Datasource** | data_source_files | RAG・インデックス・検索 |
| **Web Monitor** | （現時点なし） | Web定点観測 |
| **Flow Screening** | （現時点なし） | 審査フロー |

---

## 実装順序

### Step 0: デグレ防止テスト作成

移行前に既存の動作を保証するテストを整備する。全パック化の安全ネット。

**参照ドキュメント:**
- [01-architecture-design.md](./01-architecture-design.md) — BC一覧・テーブル帰属（テスト対象の特定）
- [02-domain-event-design.md](./02-domain-event-design.md) — BC間callback連鎖（テストすべき連携ポイント）

| タスク | 内容 |
|--------|------|
| 既存テスト充足度確認 | 現在のテストカバレッジを確認し、不足箇所を洗い出す |
| モデルロードテスト | 全モデルクラスがロードできることを確認 |
| ルーティングテスト | 全エンドポイントのステータスコード確認 |
| アソシエーション・スコープテスト | DB関連が正常に動作することを確認 |
| BC間callback連鎖テスト | after_save等で他BCに影響する処理の動作確認 |

#### デグレの種類と防止テスト

| デグレの種類 | 原因 | テストで守る内容 |
|------------|------|----------------|
| autoload破壊 | ファイル移動でRailsのautoloadパスが変わる | 全モデルクラスがロードできることを確認 |
| ルーティング断絶 | コントローラーのnamespace変更 | 全エンドポイントのステータスコード確認 |
| DB関連破壊 | `self.table_name`設定漏れ、アソシエーション参照先の不在 | アソシエーション・スコープの動作確認 |
| パック境界の参照漏れ | privateになったモデルへの参照 | BC間のcallback連鎖の動作確認 |
| callback/concernの暗黙の依存 | `after_save`等が他BCのモデルを直接触っている | 状態遷移の前後で関連レコードの変化を確認 |

### Step 1: Packwerk導入

**参照ドキュメント:**
- [01-architecture-design.md](./01-architecture-design.md) — 「なぜ Packwerk + packs-rails か」セクション

| タスク | 内容 |
|--------|------|
| Packwerk導入 | gem追加、init、CI設定 |

### Step 2: 共通基盤パック構築

Packwerk導入後、共通パック2つを作成。この時点ではどのBCからも使われない状態でOK。

**参照ドキュメント:**
- [01-architecture-design.md](./01-architecture-design.md) — パック内部構造・package.ymlの例・CLAUDE.mdテンプレート
- [02-domain-event-design.md](./02-domain-event-design.md) — DomainEvent実装パターン（skillrelay_core）
- [03-feature-management-design.md](./03-feature-management-design.md) — featuresツリー構造・FeatureManager API・カスケードルール

| タスク | 内容 |
|--------|------|
| `skillrelay_core` パック | EventBus（ActiveSupport::Notifications + SQSラッパー）、DomainEvent基底クラス |
| `feature_management` パック | featuresツリー、company_features、FeatureManager API |

### Step 3: storage パック構築

既存のファイル管理サービスをStorageパックに集約し、統一APIを提供する。

**参照ドキュメント:**
- [04-storage-design.md](./04-storage-design.md) — 既存テーブル分析・Storage公開API・内部構造・S3キー命名規則

| タスク | 内容 |
|--------|------|
| パック作成 | `packs/storage/` + package.yml + CLAUDE.md |
| 既存サービス移動 | S3Service, CloudfrontService, DocumentsUploaderをStorage内部に移動 |
| public API定義 | Storage::Api（upload, presigned_url, delete, metadata） |
| ActiveStorageデッドテーブル削除 | active_storage_blobs, active_storage_attachments等をdrop |
| 既存コードの参照切り替え | S3Service直接呼び出しをStorage::Api経由に変更 |

### Step 4: hearing パック化

最初のBCパック化。テンプレートとなるパターンを確立する。

**参照ドキュメント:**
- [01-architecture-design.md](./01-architecture-design.md) — パック内ディレクトリ構造（hearingの例）・DB設計原則
- [02-domain-event-design.md](./02-domain-event-design.md) — Hearing関連のDomain Event一覧・Contracts設計・中間テーブルの所属
- [04-storage-design.md](./04-storage-design.md) — request_documentsの扱い・Storage API経由のファイル操作

| タスク | 内容 |
|--------|------|
| パック作成 | `packs/hearing/` + package.yml + CLAUDE.md |
| モデル移動 | requests, request_contents, hearing_extracts, hearing_step_states, hearing_suggestions, bias_flags, contradiction_flags |
| コントローラー移動 | hearing関連のcontroller |
| public API定義 | 他パックに公開するインターフェース |
| Domain Event定義 | HearingCompleted等 |
| Storage連携 | ファイル操作をStorage公開API経由に変更 |
| ai-server/worker対応 | packages/hearing/, handlers/hearing/ の整備 |
| **全テスト実行** | Step 0で作成したテストが全てgreenであることを確認 |

- 依存なしの独立BCなので最も移行しやすい
- ここで得た知見を後続のパック化に活かす

### Step 5: chat パック化

**参照ドキュメント:**
- [01-architecture-design.md](./01-architecture-design.md) — BC一覧（chat: rooms, messages, message_files）
- [02-domain-event-design.md](./02-domain-event-design.md) — Hearing ↔ Chat間のDomain Event

| タスク | 内容 |
|--------|------|
| パック作成 | `packs/chat/` + package.yml + CLAUDE.md |
| モデル移動 | rooms, messages, message_files |
| chat_typeによるルーティング | 各エージェント（hearing/topic/validation）への振り分けロジック |
| public API定義 | 各BCがチャットを利用するためのインターフェース |

### Step 6: manual パック化

**参照ドキュメント:**
- [02-domain-event-design.md](./02-domain-event-design.md) — Manual関連のDomain Event一覧
- [04-storage-design.md](./04-storage-design.md) — manualsの動画ファイル設計（未決事項）

| タスク | 内容 |
|--------|------|
| パック作成 | `packs/manual/` |
| モデル移動 | manuals, chapters, transcriptions |

### Step 7: datasource パック化

**参照ドキュメント:**
- [02-domain-event-design.md](./02-domain-event-design.md) — Datasource関連のDomain Event・Contracts設計（public APIの戻り値パターン）

| タスク | 内容 |
|--------|------|
| パック作成 | `packs/datasource/` |
| public API定義 | web_monitorから参照されるインターフェースを定義 |

- web_monitorが依存しているため、先にパック化が必要

### Step 8: web_monitor パック化

**参照ドキュメント:**
- [01-architecture-design.md](./01-architecture-design.md) — BC間依存マップ（web_monitor → datasource）・package.ymlの依存宣言例
- [02-domain-event-design.md](./02-domain-event-design.md) — Contracts設計（ACLの実装パターン）

| タスク | 内容 |
|--------|------|
| パック作成 | `packs/web_monitor/` |
| 依存宣言 | package.ymlでdatasourceへの依存を宣言 |
| contracts定義 | datasourceとのACL |

- パック間依存の実践パターンを確立するケース

### Step 9: flow_screening パック化

**参照ドキュメント:**
- [01-architecture-design.md](./01-architecture-design.md) — パック内ディレクトリ構造・CLAUDE.mdテンプレート

| タスク | 内容 |
|--------|------|
| パック作成 | `packs/flow_screening/` |

- 独立BCなのでStep 7と並行でも可
- 現時点でコードがほぼないなら、新規機能として最初からpack内で開発

---

## 未決事項

### アーキテクチャ

- [x] ~~Domain Event一覧~~ → architecture-design.mdに記載。Hearing/Manual/Datasource→Worker（SQS）、Hearing→Platform/Chat（同期）
- [x] ~~contracts設計~~ → public APIはActiveRecord直返し禁止。Data.define等の値オブジェクト（Result）を返す
- [x] ~~中間テーブルの所属~~ → 参照する側が所有（RequestDataSourceLink→Hearing、TopicDataSourceLink→Platform）

### Feature Management

- [x] ~~portalダッシュボード~~ → 専用パック不要。サイドバーからFeatureManager参照するだけ
- [x] ~~フラグマスタデータ管理~~ → コード内定数定義 + 起動時DB同期
- [x] ~~パック間依存の整合性~~ → カスケードで自動解決
- [x] ~~フラグ名typo防止~~ → コード内定数で同時解決
- [x] ~~ツリー深さ~~ → 2階層固定
- [ ] 管理画面のUI設計（実装フェーズで決定）

### Storage

- [x] ~~統一Storage APIの具体設計~~ → B案に決定（APIレイヤーだけ統一、テーブルは各BC所有）
- [x] ~~S3キーカラム命名~~ → `key` に統一
- [x] ~~処理ステータスの管理~~ → 各BCのテーブルに残す（Storageはファイル存在管理のみ）
- [x] ~~Storage公開APIの具体メソッド設計~~ → upload, presigned_url, delete, metadata の4メソッド。詳細は04-storage-design.md参照
- [x] ~~message_files~~ → テーブル廃止（レコード未使用）
- [x] ~~S3ライフサイクル管理~~ → 各BCがafter_destroyでStorage::Api.delete(key)を呼ぶ
- [ ] manualsの動画ファイル設計見直し（Manualパック化時に判断。詳細は04-storage-design.md）

### 移行

- [x] ~~既存テストの移行方針~~ → spec/もパック内に移動する（`packs/hearing/spec/` 等）
- [x] ~~flow_screening~~ → 対象外（現時点でコードなし。新規機能として最初からpack内で開発）

---

## 実装ログ

各Stepで得た知見・ハマりポイント・次Stepへの申し送りを記録する。

### Step 0: デグレ防止テスト作成

**完了** — `core/test/architecture/` に7テスト作成

| テストファイル | 守る対象 |
|--------------|---------|
| model_load_test.rb | 全モデルのautoloadロード確認 |
| service_load_test.rb | Job/Service/Mailerのautoloadロード確認 |
| routing_test.rb | 全ルートのコントローラー/アクション存在確認 |
| smoke_test.rb | 全GETエンドポイントが500を返さないことの確認 |
| association_test.rb | アソシエーション整合性・外部キー・テーブル存在・スコープ・Enum検証 |
| callback_chain_test.rb | BC間callback連鎖（Request→Topic, Room↔Request, Permission継承等 13テスト） |
| company_scope_test.rb | マルチテナント境界（company_idスコープの適用漏れ検出） |

**知見:**
- 全テスト共通でDir.globによる動的検出 + .eachで個別テスト生成するパターンを採用。新モデル追加時にテスト追記不要
- association_testのNON_SCOPE_METHODSやcompany_scope_testのALLOWLISTED_USAGES等、誤検知管理の許可リストが存在。パック化時にこれらの更新が必要になる可能性あり
- callback_chain_testのみfixtureを使用。他は全てDB不要のロードテスト

**次Stepへの申し送り:**
- パック化でファイルパスが変わるため、model_load_testとservice_load_testのDir.glob対象パスに `packs/*/app/` を追加する必要がある

### Step 1: Packwerk導入

**完了**

| 実施内容 | 詳細 |
|---------|------|
| gem追加 | `packs-rails` をGemfileに追加（packwerk 3.2.3が依存で入る） |
| init | `bundle exec packwerk init` → packwerk.yml + package.yml 生成 |
| packwerk.yml設定 | include/exclude/cache有効化 |
| binstub | `bin/packwerk` 生成 |
| CI設定 | `.github/workflows/ci.yml` に `packwerk` ジョブ追加（validate + check） |

**知見:**
- `packwerk init` は既存コードに一切触れず、設定ファイル2つを生成するのみ
- 初回 `packwerk check` で333ファイル検査、違反0件（パック未作成なので当然）
- validate/checkともにDB接続不要。CIではPostgres不要の軽量ジョブとして独立実行可能

**次Stepへの申し送り:**
- ルートpackage.ymlの `enforce_dependencies` は現状 `false`。Step 2以降でパック作成後、段階的に `true` に切り替える
- jbuilderのostruct警告が出るが動作に影響なし（Ruby 3.5で対応が必要）

### Step 2: 共通基盤パック構築
#### 2-1 feature_management

| 実施内容 | 詳細 |
|---------|------|
| パック作成 | `packs/feature_management/` + package.yml + CLAUDE.md |
| DB | features + company_features テーブル（ULID主キー） |
| モデル | Feature（ツリー構造・2階層バリデーション）、CompanyFeature |
| 定数 | Features::TREE（5BC + 子フラグ定義） |
| サービス | Sync（コード定数→DB同期）、Cascader（カスケードON/OFF） |
| 公開API | FeatureManager（for/enabled?/enable!/disable!/sync!） |
| Initializer | 起動時にFeatureManager.sync!実行 |
| テスト | 22テスト（モデル・サービス・公開API） |

**知見:**
- packwerk 3.2.3では `enforce_privacy` は未サポート。packs-railsのpublic/ディレクトリ規約で代替
- `enforce_dependencies: true` でパック間依存チェックが有効。ルートパッケージ(`.`)への依存を宣言する必要あり
- Sync処理は冪等。2回実行しても問題なし。余剰レコードは自動削除
- カスケードは `depends_on` 定義に基づいて双方向に動作（ON時は依存先も自動ON、OFF時は依存元も自動OFF）

**次Stepへの申し送り:**
- skillrelay_core（EventBus + DomainEvent基底）は別途実装が必要
- FeatureManagerの管理画面UIは未実装（実装フェーズで決定の方針）
- 各BCパック化時にFeatureManager.for(company).enabled?(:bc_name)で参照開始

#### 2-2 skillrelay_core

| パック | 内容 |
|-------|------|
| `skillrelay_core` | DomainEvent基底クラス（attribute定義・継承・to_h）、EventBus（同期: ActiveSupport::Notifications / 非同期: SQSラッパー）、13テスト |

**知見:**
- `Time.current` は `ActiveSupport::TimeWithZone` を返す（テストでは `assert_kind_of Time` を使う）
- EventBusの同期イベントはActiveSupport::Notificationsそのまま。SQS非同期は既存SqsMessageServiceと同じパターン
- SQS_DOCUMENT_PROCESSING_QUEUE_URL未設定時は非同期イベントをスキップ（開発環境対応）

**次Stepへの申し送り:**
- 各BCパック化時にEventBus.publish / publish_asyncに移行。既存のSqsMessageService直接呼び出しを段階的に置き換え

### Step 3: storage パック構築

**完了**

| 実施内容 | 詳細 |
|---------|------|
| パック作成 | `packs/storage/` + package.yml + CLAUDE.md |
| 内部サービス | Storage::S3Client, Storage::CloudfrontClient, Storage::Uploader（旧S3Service/CloudfrontService/DocumentsUploaderを移動・リネーム） |
| 公開API | Storage::Api（upload, presigned_url, delete, metadata, signed_video_url, download） |
| 参照切り替え | 7ファイル（6コントローラー+1ヘルパー）の直接参照をStorage::Api経由に変更 |
| デッドコード削除 | active_storage_*テーブル、message_filesテーブル・モデル、requests.chart_pathカラム、旧ラッパークラス |
| テスト | 21テスト全green（S3Client: 10, CloudfrontClient: 4, Api: 7） |

**知見:**
- `fixtures :all`がグローバル設定されているため、パック内テストはMinitest::Testを直接継承してfixture読み込みを回避
- Storage::Apiのクラスメソッド内でS3Clientをメモ化するとスレッドセーフ問題が起きるため、毎回newする
- CarrierWave（Storage::Uploader）はupload結果から`{ key:, url: }`を返すAPIラッパーに統一。呼び出し側のコード量が大幅に削減
- message_filesテーブルはレコード未使用だがコード参照（messages_controller, chat_files_controller）が残っていたため、テーブル削除と同時に到達不能コードも清掃

**インシデント: message_filesテーブル誤削除（2026-03-24〜26）**
1. Claudeがモデル参照のないmessage_filesを「デッドテーブル」と判断し、削除マイグレーションを生成
2. レビュアーがai-server側でmessage_filesにデータを書き込んでいることに気づかずapprove
3. mock/mainにテーブル削除がマージされる
4. 別エンジニアがClaude経由で誤ってmock/mainをmainにマージ
5. 結果、本番でmessage_filesテーブルが削除され、過去の添付ファイルメタデータが消失
6. PR #211で復活マイグレーションを作成したが、過去データは復元不可

**教訓:**
- Railsアプリ以外（ai-server等）から直接DBを参照しているテーブルは、Railsのモデル有無だけでは「デッド」と判断できない
- テーブル削除は全リポジトリ横断でGrepしてから判断すべき
- ai-serverがDB直接接続している箇所のAPI化が技術的負債として残っている

**次Stepへの申し送り:**
- 各BCパック化時にafter_destroyでStorage::Api.delete(key)を追加する（S3ライフサイクル管理）
- manualsの動画ファイル設計（input_video_key/hls_video_keyの二重参照）はManualパック化時に判断
- requests fixtureのFK違反（respondent_id）が全テストに影響。Step 0テストの実行には先にfixture修正が必要
- ai-serverのDB直接参照をAPI化する計画が必要（今回のインシデントの根本原因）

### Step 4: hearing パック化

_未着手_

### Step 5: chat パック化

_未着手_

### Step 6: manual パック化

_未着手_

### Step 7: datasource パック化

_未着手_

### Step 8: web_monitor パック化

_未着手_

### Step 9: flow_screening パック化

_未着手_

---

## 関連ドキュメント

- [アーキテクチャ設計](./01-architecture-design.md)
- [Domain Event・Contracts設計](./02-domain-event-design.md)
- [Feature Management設計](./03-feature-management-design.md)
- [Storage設計](./04-storage-design.md)
- [オンプレミス設計](./05-on-premise-design.md)
