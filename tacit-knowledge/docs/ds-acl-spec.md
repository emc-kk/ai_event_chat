# データソース管理 + 権限システム 実装仕様書

## アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────────┐
│  フロントエンド (React 18 + TypeScript)                          │
│  /data_sources → DataSourcesPage                                 │
│  API呼び出し: /api/data_source_folders, /api/data_source_files   │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTP JSON API
┌─────────────────────▼───────────────────────────────────────────┐
│  コントローラー層                                                 │
│  ┌─────────────────────────┐  ┌──────────────────────────────┐  │
│  │ DataSourcesController   │  │ PermissionsController        │  │
│  │ (HTML、サイドバー表示)    │  │ (権限CRUD、HTML)             │  │
│  └─────────────────────────┘  └──────────────────────────────┘  │
│  ┌─────────────────────────┐  ┌──────────────────────────────┐  │
│  │ Api::DSFoldersController│  │ Api::DSFilesController       │  │
│  │ (フォルダAPI、JSON)      │  │ (ファイルAPI、JSON)           │  │
│  └─────────────────────────┘  └──────────────────────────────┘  │
│                                                                   │
│  Concerns: DataSourceAccessControl, RequireCompanyContext,        │
│            FolderOperations                                       │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│  モデル層                                                         │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────────┐     │
│  │DataSourceFolder│  │DataSourceFile │  │ Permission       │     │
│  │+ Permissible   │  │+ Permissible  │  │ (polymorphic)    │     │
│  └───────┬───────┘  └───────┬───────┘  └──────────────────┘     │
│          │                   │                                     │
│  ┌───────▼───────────────────▼──────────────────────────┐        │
│  │ Permissible concern (権限チェックロジック)              │        │
│  │ check_permission → 4経路 + admin fallback             │        │
│  └──────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│  外部サービス層                                                   │
│  S3Service (ファイルアップロード/ダウンロード)                      │
│  SqsMessageService (AI処理キュー)                                 │
│  CloudfrontService (動画配信)                                     │
│  AiServerClient (QAデータ取得)                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## データベーススキーマ

### data_source_folders テーブル

| カラム | 型 | 制約 | 説明 |
|-------|---|-----|------|
| id | string(26) | PK, ULID | フォルダID |
| company_id | string(26) | NOT NULL, FK→companies (CASCADE) | 所属会社 |
| parent_id | string(26) | FK→data_source_folders (CASCADE) | 親フォルダ（null=ルート） |
| name | string | NOT NULL | フォルダ名 |
| created_by_id | string(26) | NOT NULL | 作成者ID |
| created_by_type | string | NOT NULL | 作成者タイプ（Admin/User） |
| deleted_at | datetime | | ソフトデリート |
| created_at | datetime | NOT NULL | |
| updated_at | datetime | NOT NULL | |

**インデックス:**
- `idx_ds_folders_company_parent` (company_id, parent_id)
- `idx_ds_folders_created_by` (created_by_type, created_by_id)
- `index_data_source_folders_on_deleted_at`
- `index_data_source_folders_on_parent_id`

### data_source_files テーブル

| カラム | 型 | 制約 | 説明 |
|-------|---|-----|------|
| id | string(26) | PK, ULID | ファイルID |
| company_id | string(26) | NOT NULL, FK→companies (CASCADE) | 所属会社 |
| folder_id | string(26) | FK→data_source_folders (NULLIFY) | 所属フォルダ |
| name | string | NOT NULL | ファイル名 |
| key | text | NOT NULL | S3キー |
| file_type | string | | ファイル拡張子 |
| file_size | bigint | | ファイルサイズ（バイト） |
| ai_status | integer | NOT NULL, default: 0 | AI処理状態（0:pending, 1:processing, 2:completed, 3:failed） |
| token_count | integer | | AIトークン数 |
| parsed_doc_key | text | | パース済みドキュメントのS3キー |
| created_by_id | string(26) | NOT NULL | 作成者ID |
| created_by_type | string | NOT NULL | 作成者タイプ |
| updated_by_id | string(26) | | 更新者ID |
| updated_by_type | string | | 更新者タイプ |
| deleted_at | datetime | | ソフトデリート |

**インデックス:**
- `idx_ds_files_company_folder` (company_id, folder_id)
- `index_data_source_files_on_ai_status`
- `index_data_source_files_on_folder_id`
- `index_data_source_files_on_deleted_at`

### permissions テーブル（topic_permissionsからリネーム）

| カラム | 型 | 制約 | 説明 |
|-------|---|-----|------|
| id | string(26) | PK, ULID | 権限ID |
| company_id | string(26) | NOT NULL, FK→companies (CASCADE) | 所属会社 |
| permissible_type | string | NOT NULL | 対象タイプ（TopicFolder/Topic/DataSourceFolder/DataSourceFile） |
| permissible_id | string(26) | NOT NULL | 対象ID |
| grantee_type | string | NOT NULL | 付与先タイプ（Admin/User/UserGroup） |
| grantee_id | string(26) | NOT NULL | 付与先ID |
| role | integer | NOT NULL, default: 0 | ロール（0:viewer, 1:editor, 2:owner） |
| granted_by_id | string(26) | FK→admins | 付与した管理者 |
| deleted_at | datetime | | ソフトデリート |

**インデックス:**
- `idx_perm_unique_grant` (permissible_type, permissible_id, grantee_type, grantee_id) UNIQUE WHERE deleted_at IS NULL
- `idx_perm_grantee` (grantee_type, grantee_id)
- `idx_perm_permissible` (permissible_type, permissible_id)

---

## APIエンドポイント一覧

| メソッド | パス | 説明 | 権限 |
|---------|------|------|------|
| GET | /data_sources | DS管理画面（HTML） | 管理者 or DS権限あり |
| GET | /api/data_source_folders?parent_id=xxx | フォルダ・ファイル一覧 | viewer以上 |
| POST | /api/data_source_folders | フォルダ作成 | editor以上 |
| PATCH | /api/data_source_folders/:id | フォルダ名変更 | editor以上 |
| PATCH | /api/data_source_folders/:id/move | フォルダ移動 | editor以上 |
| DELETE | /api/data_source_folders/:id | フォルダ削除（ソフト） | editor以上 |
| POST | /api/data_source_files | ファイルアップロード | editor以上 |
| PATCH | /api/data_source_files/:id | ファイル名変更 | editor以上 |
| PATCH | /api/data_source_files/:id/move | ファイル移動 | editor以上 |
| GET | /api/data_source_files/:id/download | ファイルダウンロード | viewer以上 |
| DELETE | /api/data_source_files/:id | ファイル削除（ソフト） | editor以上 |
| GET | /api/data_source_files/search?q=xxx | ファイル検索（名前+内容） | viewer以上 |
| POST | /api/data_source_files/:id/retry_ai | AI再学習（個別） | editor以上 |
| POST | /api/data_source_files/retry_ai_all | AI再学習（一括） | editor以上 |
| POST | /api/data_source_files/bulk_create_topic | トピック一括作成 | editor以上 |
| GET | /api/data_source_files/:id/linked_topics | リンク済みトピック一覧 | viewer以上 |
| GET | /api/topics/:topic_id/data_source_links | リンクDS一覧 | topic viewer |
| POST | /api/topics/:topic_id/data_source_links | DSリンク追加 | topic editor + DS file editor |
| DELETE | /api/topics/:topic_id/data_source_links | DSリンク解除 | topic editor |

---

## 権限チェックフロー

```
ユーザーのDS操作リクエスト
  │
  ├─ 特権管理者（Admin, company_id=nil）?
  │   → 常に許可（全社のデータアクセス可）
  │
  ├─ 企業管理者（User, role=company_admin）?
  │   → 自社データに対して常に許可
  │
  └─ 一般ユーザー?
      │
      └─ Permissible.check_permission(user, "user", minimum_role)
          │
          ├─ ① 直接個人権限（self → permissions WHERE grantee=User AND grantee_id=user.id）
          │   → role_sufficient? → 許可/次へ
          │
          ├─ ② 直接グループ権限（self → permissions WHERE grantee=UserGroup AND grantee_id IN user.user_group_ids）
          │   → 最高roleを使用 → role_sufficient? → 許可/次へ
          │
          ├─ ③ 継承個人権限（parent_chain → 各階層で①をチェック）
          │   → role_sufficient? → 許可/次へ
          │
          ├─ ④ 継承グループ権限（parent_chain → 各階層で②をチェック）
          │   → role_sufficient? → 許可/次へ
          │
          ├─ ⑤ チェーン内に権限なし（no_permissions_in_chain?）
          │   → 同一会社のAdminのみアクセス許可（フォールバック）
          │
          └─ ⑥ 上記全て該当なし → 拒否
```

---

## モデル詳細

### DataSourceFolder
- **バリデーション**: name必須（最大255文字）、同一階層内名前ユニーク、循環参照防止
- **ソフトデリート**: `acts_as_paranoid`
- **Permissible**: include。`permission_parent` → 親フォルダ
- **スコープ**: `for_company(id)`, `roots`（parent_id=nil）
- **メソッド**: `breadcrumb`（祖先フォルダ配列）、`files_count`（直接のファイル数）
- **循環参照防止**: `prevent_circular_reference` — parent_id変更時にSet-basedで祖先チェーン走査、自己参照・子孫への移動を拒否

### DataSourceFile
- **バリデーション**: name必須（最大255文字）、key必須
- **AI処理状態**: `ai_status` enum（pending→processing→completed/failed）
- **ソフトデリート**: `acts_as_paranoid`
- **Permissible**: include。`permission_parent` → 所属フォルダ
- **スコープ**: `for_company(id)`, `in_folder(id)`
- **メソッド**: `file_extension` — `File.extname(name).delete(".").downcase`

### Permission
- **ロール**: viewer(0) < editor(1) < owner(2)
- **付与先タイプ**: Admin, User, UserGroup
- **対象タイプ**: TopicFolder, Topic, DataSourceFolder, DataSourceFile
- **バリデーション**: role必須、grantee_type制限(3種)、grantee_id必須、同一会社チェック(cross-company拒否、privileged admin例外)、ユニーク制約(soft delete考慮)
- **スコープ**: `for_company`, `for_permissible`, `for_grantee`, `viewers_and_above`, `editors_and_above`, `owners_only`

---

## コントローラー詳細

### Api::DataSourceFoldersController
- **Concerns**: RequireCompanyContext, FolderOperations, DataSourceAccessControl
- **アクション**: index, create, update, move, destroy
- **N+1最適化**: `user_ds_permissions` — 1クエリで全DS権限取得、`viewable_folder_ids` — 権限フォルダ+祖先+子孫をSet化
- **フォルダ可視性ロジック**:
  1. 直接権限のあるフォルダID取得
  2. 各権限フォルダの全祖先IDを追加（パンくず表示のため）
  3. 各権限フォルダの全子孫IDを追加（中身参照のため）
  4. 結果のSetに含まれるフォルダのみ表示
- **JSON形式**: `{ id, name, parent_id, files_count, type: "folder", created_at, updated_at }`

### Api::DataSourceFilesController
- **定数**: `ALLOWED_FILE_TYPES = %w[pdf xlsx xls docx doc pptx ppt csv txt]`, `SEARCH_LIMIT = 50`
- **アクション**: create, update, move, download, destroy, search, retry_ai, retry_ai_all, bulk_create_topic, linked_topics
- **ファイルアップロードフロー**: バリデーション→S3アップロード→DBレコード作成→SQS AI処理キュー送信
- **検索**: ファイル名 ILIKE + ファイル内容（`data_knowledge_documents.text` ILIKE）の2段階検索。`sanitize_sql_like`でSQLインジェクション防止、50件上限。内容検索はスニペット（前後50文字）を付与
- **AI再学習**: `retry_ai`（個別）/ `retry_ai_all`（pending/failed一括）— ai_statusをpendingに戻しSQS再キュー
- **トピック一括作成**: Topicレコード作成 → completedファイルのみ `TopicDataSourceLink` でリンク。`DISABLE_LEGACY_TOPIC_METADATA` 未設定時は旧metadata更新も併用
- **リンクトピック一覧**: `linked_topics` — ファイルに紐付くトピック一覧を返す（link_id, linked_at, linked_by情報含む）

### Api::TopicDataSourceLinksController
- **Concerns**: RequireCompanyContext, TopicAccessControl
- **アクション**: index, create, destroy（collection route）
- **権限**: index → topic viewer、create/destroy → topic editor。create時はファイルごとにDS editor権限もチェック（Admin/企業管理者はバイパス）
- **バルク操作**: create/destroyは `data_source_file_ids` 配列を受け取り、トランザクション内で一括処理
- **レスポンス**: create → `{ linked, skipped_ids, total_linked }`、destroy → `{ deleted_count }`
- **index レスポンス**: 各リンクにファイル名・タイプ・サイズ・AI状態を含む

### DataSourcesController
- **認可フロー**: privileged_admin → company_admin → `user_has_any_ds_permission?`
- **`user_has_any_ds_permission?`**: 個人権限→UserGroup権限の2段階チェック

---

## Concern詳細

### Permissible (app/models/concerns/permissible.rb)
- **公開メソッド**: `viewable_by?`, `editable_by?`, `owned_by?`, `effective_permissions`, `has_direct_permissions?`, `inherited_permissions`
- **コアロジック**: `check_permission(user, user_type, minimum_role)` — 6段階チェック（上記フロー図参照）
- **ロール比較**: `role_sufficient?(actual_role, minimum_role)` — 数値比較（viewer=0, editor=1, owner=2）
- **継承**: `find_inherited_permission_for` — parent chain走査、個人→グループの順でチェック
- **`permission_parent`**: private、各モデルでオーバーライド必須。`respond_to?(:permission_parent, true)` でチェック

### DataSourceAccessControl (app/controllers/concerns/data_source_access_control.rb)
- **before_action**: `require_ds_viewer`, `require_ds_editor`, `require_ds_owner`
- **リソース解決**: `resolve_ds_resource` — @file → @folder → params[:folder_id]/params[:parent_id]
- **アクセス拒否**: API→JSON 403、HTML→リダイレクト+alert

### FolderOperations (app/controllers/concerns/folder_operations.rb)
- **`descendant_ids(folder)`**: BFS全子孫ID取得
- **`validate_folder_move(folder, new_parent_id, folder_scope)`**: 循環参照・存在チェック

---

## ロール別アクセス権限マトリクス

| 操作 | 特権管理者 | 企業管理者 | viewer | editor | owner | 権限なし |
|------|-----------|-----------|--------|--------|-------|---------|
| フォルダ一覧表示 | ✅ 全社 | ✅ 自社全て | ✅ | ✅ | ✅ | ❌ |
| ファイル一覧表示 | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| フォルダ作成 | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| ファイルアップロード | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| フォルダ/ファイル名変更 | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| フォルダ/ファイル移動 | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| フォルダ/ファイル削除 | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| ファイルダウンロード | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| ファイル検索 | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 権限管理 | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| トピック一括作成 | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| ナレッジ一覧（リンクDS表示） | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| ナレッジ追加（DSリンク） | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| ナレッジ解除（DSリンク解除） | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| リンクトピック確認 | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## 外部サービス連携

### S3Service
- **定数**: `PRESIGNED_URL_EXPIRATION = 3600`（1時間）
- **メソッド**: `presigned_url(key)`, `download_file(key)`, `get_content_type(key)`, `get_original_filename(key)`
- **nil key**: 例外をrescueしてnilを返す

### SqsMessageService
- **キュー**: `SQS_DOCUMENT_PROCESSING_QUEUE_URL`環境変数
- **メッセージ**: `{ action_type, company_id, file_ids, folder_id, timestamp }`
- **送信条件**: RequestDocument.status_pendingのドキュメント存在時

### DocumentsUploader (CarrierWave)
- **許可拡張子**: pdf, xlsx, xls, docx, doc, pptx, ppt, csv, txt
- **ストレージ**: S3（本番）/ ローカル（開発）

---

## DS-トピック連携

### 連携フロー

```
[1] ファイルアップロード (POST /api/data_source_files)
    → S3にアップロード（キー: datasource/{company_id}/{timestamp}/{filename}）
    → DataSourceFile作成 (ai_status: pending)
    ↓
[2] SQSキューにメッセージ送信
    { action_type: "data_acquisition_upload", company_id, data_source_file_ids, folder_id, timestamp }
    ↓
[3] Worker処理 (Python: worker/src/workflows/steps/data_acquisition_index.py)
    → S3からファイル取得（CarrierWaveサニタイズ不一致時は自動フォールバック）
    → LlamaIndex SimpleDirectoryReader でテキスト抽出
      対応形式: pdf(PyMuPDF), docx(docx2txt), pptx(python-pptx), xlsx(openpyxl), txt, csv等
      PDF空テキスト時はVision API(gpt-4.1)でOCRフォールバック
    → SentenceSplitter でチャンク分割 (1024トークン, 200オーバーラップ)
    → OpenAI Embedding生成 (text-embedding-3-small, 1536次元)
    → data_knowledge_documents に挿入（metadata_.document_id = file_id）
    → DataSourceFile.ai_status を completed に更新
    → レガシー互換: topic_data_source_links 経由で metadata_.topic_id も更新
    ↓
[4-A] DS画面からトピック作成（A方向: DS → トピック）
    POST /api/data_source_files/bulk_create_topic { file_ids, topic_name? }
    → Topic レコード作成 (status: completed)
    → topic_data_source_links に completed ファイルのリンクINSERT
    → レスポンス: { topic_id, topic_name, linked_files }
    ↓
[4-B] トピックからナレッジ追加（B方向: トピック → DS）
    POST /api/topics/:topic_id/data_source_links { data_source_file_ids }
    → completed ファイルのみ topic_data_source_links にINSERT
    → ファイルごとにDS権限チェック（Admin/企業管理者はバイパス）
    → レスポンス: { linked, skipped_ids, total_linked }
    ↓
[5] ナレッジタブでDSファイル一覧表示 → チェックボックスで選択
    → 「ナレッジ検索」or「マニュアル作成」を実行
    → 選択ファイルのみを対象にRAG検索（topic_data_source_links JOIN）
```

### data_knowledge_documents テーブル（ベクトルDB、Worker管理）

| カラム | 型 | 説明 |
|--------|-----|------|
| embedding | vector(1536) | OpenAI埋め込みベクトル |
| metadata_ | json | メタデータ（document_id, file_name, file_path, source） |

**注意**: Rails ORMでは直接操作せず、Worker側のINSERTのみ。`metadata_`はjson型（jsonbではない）。RAGクエリでのトピックフィルタリングは `topic_data_source_links` 中間テーブル経由で行う（チャンク内の `metadata_.topic_id` は使用しない）。

---

## フロントエンド構成

### Reactコンポーネントツリー

```
DataSourceApp (datasource-app.tsx) — DS管理メインコンテナ (state管理、APIコール)
├── Breadcrumb (breadcrumb.tsx) — パンくずナビゲーション
├── FileTable (file-table.tsx) — ファイル/フォルダ一覧テーブル
│     └── FileRow (file-row.tsx)
│           ├── FileIcon (file-icon.tsx) — ファイルタイプ別アイコン
│           ├── AiStatusBadge (ai-status-badge.tsx) — AI学習状態バッジ
│           └── ContextMenu (context-menu.tsx) — canEdit時のみ表示
├── SelectionBar (selection-bar.tsx) — 複数選択時のフッターバー
├── NewFolderModal (new-folder-modal.tsx) — canEdit時のみ
├── FileUploadModal (file-upload-modal.tsx) — canEdit時のみ、D&D対応
├── RenameModal (rename-modal.tsx)
└── DeleteConfirmModal (delete-confirm-modal.tsx)

KnowledgeApp (knowledge-app.tsx) — ナレッジタブ（トピック内）
├── リンク済みDSファイル一覧テーブル（チェックボックス付き）
│     ├── FileIcon — ファイルタイプ別アイコン
│     └── AiStatusBadge — AI処理状態バッジ（完了/処理中/待機中/失敗）
├── DsBrowserModal — ナレッジ追加モーダル（DSフォルダブラウズ、completedファイル選択）
├── 「ナレッジ検索」ボタン — 選択ファイルを対象にRAG検索（チャットタブに遷移）
└── 「解除」ボタン — 個別/一括リンク解除

TopicTabsController (topic_tabs_controller.js) — チャット/ナレッジタブ切替
├── チャットタブ — 既存のトピックチャット
└── ナレッジタブ — KnowledgeApp マウント/アンマウント
```

### ERB→React データ属性

| 属性 | 型 | 説明 |
|------|-----|------|
| data-company-id | string | 現在の企業ID |
| data-privileged-admin | "true"/"false" | 特権管理者か |
| data-can-edit | "true"/"false" | 編集権限（`privileged_admin? \|\| admin_or_company_admin?`） |
| data-companies | JSON | 特権管理者用の企業一覧 |

### APIクライアント (datasource-api-client.ts)

| メソッド | 説明 |
|---------|------|
| getFolderContents(parentId?) | フォルダ内容取得 |
| createFolder(parentId, name) | フォルダ作成 |
| renameFolder(id, name) | フォルダ名変更 |
| moveFolder(id, newParentId) | フォルダ移動 |
| deleteFolder(id) | フォルダ削除 |
| uploadFiles(folderId, files) | ファイルアップロード |
| renameFile(id, name) | ファイル名変更 |
| moveFile(id, newFolderId) | ファイル移動 |
| downloadFile(id) | ファイルダウンロード |
| deleteFile(id) | ファイル削除 |
| searchFiles(query) | 検索 |
| bulkCreateTopic(fileIds, topicName?) | 選択ファイルからトピック作成（トピック名任意指定） |
| getLinkedDataSources(topicId) | トピックにリンク済みのDS一覧取得 |
| linkDataSourcesToTopic(topicId, fileIds) | DSファイルをトピックにリンク |
| unlinkDataSourcesFromTopic(topicId, fileIds) | DSファイルのリンク解除 |
| getLinkedTopics(fileId) | ファイルにリンク済みのトピック一覧取得 |

---

## ソフトデリートのカスケード動作

| 操作 | 対象 | カスケード |
|------|------|-----------|
| フォルダ削除 | DataSourceFolder | 子フォルダもカスケード削除（DB FK ON DELETE CASCADE）、配下ファイルの folder_id = null（ON DELETE SET NULL） |
| ファイル削除 | DataSourceFile | deleted_at 設定、topic_data_source_links は dependent: :destroy で自動削除 |
| 権限削除 | Permission | 対象リソース（permissible）削除時に dependent: :destroy |
| トピック削除 | Topic | topic_data_source_links は dependent: :destroy で自動削除。チャンクは残る |
| ナレッジ解除 | TopicDataSourceLink | リンクのみハードデリート。チャンクは残る（他トピックで使用中の可能性） |

**注意**: ベクトルチャンク（`data_knowledge_documents`）はソフトデリートの対象外。DSファイル削除後もチャンクは残存する（既知課題#1）。

---

## Worker バグ修正履歴

| # | 問題 | 修正 |
|---|------|------|
| W1 | `worker.py` が `body['request_id']` で KeyError（`data_acquisition_upload`にはrequest_idなし） | `data_acquisition_upload` を `request_id` 参照前に早期リターンで処理 |
| W2 | `data_acquisition_index.py` が `db.fetch_all()` / `db.execute()` を呼び出すが `DatabaseConnection` に存在しない | `db.execute_query(query, params, fetch=True)` に統一 |
| W3 | `metadata_` カラムがjson型だが `jsonb_set()` はjsonb型にしか使えずPG::UndefinedFunction | `(metadata_::jsonb \|\| jsonb_build_object(...))::json` パターンに変更 |
| W4 | CarrierWaveがファイル名をサニタイズ（例: `②`→`_`）するため、DBの`key`とS3の実際のキーが不一致になりダウンロード失敗 | `download_file_from_s3_with_fallback` でサニタイズ後のキーで自動リトライ＋DBキー修正 |
| W5 | インデキシング時にLlamaIndexが読む実ファイル名（サニタイズ済）とDB上のファイル名が不一致で`document_id`マッピング失敗→内容検索に出ない | `os.path.basename(local_path)` を主マッピングキーにし、元ファイル名もフォールバックで登録 |
| W6 | docx/pptx/xlsxのテキスト抽出に必要なPythonパッケージが未インストール | `python-pptx`（pptx用）、`openpyxl`（xlsx用）を`pyproject.toml`に追加 |

---

## DS↔トピック 多対多リンク（topic_data_source_links）

### 概要

旧方式では `data_knowledge_documents.metadata_.topic_id` に暗黙的にリンクしていたが、1ファイル→1トピックしか紐付けできない制約があった。新方式では明示的な中間テーブル `topic_data_source_links` を導入し、多対多の双方向リンクを実現。

### topic_data_source_links テーブル

| カラム | 型 | 制約 | 説明 |
|-------|---|-----|------|
| id | string(26) | PK, ULID | リンクID |
| topic_id | string(26) | NOT NULL, FK→topics (CASCADE) | トピックID |
| data_source_file_id | string(26) | NOT NULL, FK→data_source_files (CASCADE) | ファイルID |
| linked_by_id | string(26) | NOT NULL | リンク作成者ID |
| linked_by_type | string | NOT NULL | リンク作成者タイプ（Admin/User） |
| created_at | datetime | NOT NULL | |

**インデックス:**
- `idx_tdsl_topic_file_unique` (topic_id, data_source_file_id) UNIQUE
- `idx_tdsl_file` (data_source_file_id)
- `idx_tdsl_linked_by` (linked_by_type, linked_by_id)

**特徴:**
- `acts_as_paranoid` なし（ハードデリート）
- `updated_at` なし（リンクは不変。作成 or 削除のみ）
- AI処理完了（completed）ファイルのみリンク可能

### 追加APIエンドポイント

| メソッド | パス | 説明 | 権限 |
|---------|------|------|------|
| GET | /api/topics/:topic_id/data_source_links | リンクDS一覧 | topic viewer |
| POST | /api/topics/:topic_id/data_source_links | DSリンク追加 | topic editor + DS file editor |
| DELETE | /api/topics/:topic_id/data_source_links | DSリンク解除 | topic editor |
| GET | /api/data_source_files/:id/linked_topics | リンクトピック一覧 | DS file viewer |

### RAGクエリ変更

環境変数 `USE_NEW_TOPIC_LINKS=true` で新方式に切替。新方式では中間テーブル経由でフィルタ:

```sql
-- トピック全体を対象とする場合
AND (metadata_::jsonb->'_node_content')::jsonb->'metadata'->>'document_id' IN (
  SELECT data_source_file_id FROM topic_data_source_links WHERE topic_id = $N
)

-- fileIds指定時は、選択ファイルのみ対象
AND (metadata_::jsonb->'_node_content')::jsonb->'metadata'->>'document_id' = ANY($N::text[])
```

3つの検索モードすべてに適用:
- **searchByVector**: ベクトル類似度検索
- **searchByText**: 全文テキスト検索（PostgreSQL tsvector）
- **searchHybrid**: ベクトル(0.7) + テキスト(0.3)のハイブリッド検索（デフォルト）

### ナレッジタブUI

トピックチャット画面に「チャット / ナレッジ」タブを追加:
- **ナレッジタブ**: リンク済みDSファイル一覧（チェックボックス付き）、追加/解除ボタン
- **ナレッジ追加モーダル**: DSフォルダをブラウズし、completedファイルを選択してリンク
- **ナレッジ検索**: チェックしたファイルだけを対象にRAG検索（チャットタブに遷移）
- 選択なしの場合はリンク済み全ファイルを対象に検索

### 環境変数

| 環境変数 | 用途 | デフォルト |
|---------|------|----------|
| `USE_NEW_TOPIC_LINKS` | RAGクエリを新方式（中間テーブル）に切替 | 未設定（旧方式） |
| `DISABLE_LEGACY_TOPIC_METADATA` | bulk_create_topicでの旧metadata更新を停止 | 未設定（両方書く） |

### 削除ライフサイクル

| イベント | 処理 |
|---------|------|
| DSファイル削除 | `dependent: :destroy` でリンク自動削除 |
| ナレッジ解除 | リンクのみハードデリート。チャンクは残る |
| トピック削除 | `dependent: :destroy` でリンク自動削除 |

---

## 社内辞書との関係

社内辞書（`company_glossary_terms`）は権限システムを共有するが、DSやトピックのようなリソースベースの権限（Permissible concern）ではなく、会社スコープの独立機能として実装されている。

- **権限判定:** `user_can_edit_glossary?`（`sessions_helper.rb`）— PermissionテーブルでPoll的にeditor以上の権限を検索
- **Permissible concern は使わない:** 辞書にはフォルダ階層・継承チェーンが不要なため
- **Permission テーブルを参照:** 同じpermissionsテーブルを使って「この会社でeditor以上の権限を持つか」を判定

詳細は [社内辞書仕様](./glossary-spec.md) を参照。

---

## 社内辞書バグ修正履歴

| # | 問題 | 修正 | PR/コミット |
|---|------|------|------------|
| G1 | `match_terms` で `Encoding::CompatibilityError`（BINARY vs UTF-8） | `force_encoding("UTF-8")` 適用 | PR #106 (main→ds-acl merge) |
| G2 | 特権管理者で社内辞書がエラー | `require_company_context` + サイドバー条件修正 | PR #105 (main→ds-acl merge) |
| G3 | `schema.rb` に辞書テーブル定義欠落 | schema.rb 再生成 | PR #104 (main→ds-acl merge) |
| G4 | ds-acl の `schema.rb` で外部キー制約重複 | merge時の重複行を削除 | `a0d9874` (ds-acl直接) |

### 社内辞書の検証状況

- **ローカル検証**: CRUD全操作 + match API（マッチあり/なし/空テキスト/別会社）OK
- **本番検証（skillrelay.ai）**: CRUD全操作 + match API OK、エンコーディングエラーなし
- **権限検証**: 特権管理者はサイドバー非表示（正常）、企業管理者はCRUD可能

---

## 未着手の実装タスク

| # | 内容 | 備考 |
|---|------|------|
| 1 | AIナレッジ・アシスタント（全データソース横断チャット） | `ai-server/app/api/knowledge/route.ts` 新規作成、companyIdフィルタ追加 |
| 2 | マニュアル作成（DSファイルを選択してマニュアル作成） | ナレッジタブで選択したDSファイルからマニュアルを自動生成する機能。UI・バックエンド共に未実装 |
| 3 | 社内辞書AI注入 | `match` APIで用語マッチ → システムプロンプトに注入。ai-server側の実装が必要 |

---

## DS-トピック連携の既知課題

| # | 課題 | 説明 | 状態 |
|---|------|------|------|
| 1 | 孤児チャンク | DSファイルをソフト削除しても、`data_knowledge_documents` のベクトルチャンクは残存 | 未解決 |
| 2 | 更新非反映 | DSファイルを差し替えても、古いベクトルチャンクが紐付いたまま | 未解決 |
| 3 | 逆引き不可 | トピックがどのファイルから作られたか確認できない | **解決済み**（topic_data_source_links + linked_topics API） |
| 4 | 重複リンク | 同じファイルで複数回トピック作成すると、チャンクのtopic_idが上書きされる | **解決済み**（中間テーブルで多対多管理、USE_NEW_TOPIC_LINKS有効時） |
| 5 | S3キー不一致 | CarrierWaveサニタイズ（②→_）でDBのkeyとS3キーが不一致→ダウンロード失敗 | **解決済み**（W4: サニタイズフォールバック + DBキー修正） |
| 6 | 内容検索漏れ | docx等のファイル内容が検索にヒットしない（document_idマッピング失敗） | **解決済み**（W5: 実ファイル名ベースのマッピング + W6: python-pptx/openpyxl追加） |
