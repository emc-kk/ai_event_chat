# DS-ACL 手動検証ガイド

> 人間がブラウザで手動検証するためのガイドです。
> ログイン情報、画面URL、各機能の操作手順、期待される挙動をまとめています。

---

## 1. 環境情報

| 項目 | 値 |
|------|-----|
| ローカルURL | http://localhost:3000 |
| ブランチ | `mock/ds-acl` |
| 起動方法 | `docker compose up` （ルートディレクトリで実行） |

---

## 2. テストアカウント一覧

| # | メールアドレス | パスワード | モデル | ロール | 所属会社 | DS権限 |
|---|--------------|-----------|-------|--------|---------|--------|
| 1 | admin@example.com | Password1! | Admin | 特権管理者 | なし（全社アクセス） | 全フォルダ・ファイルにフルアクセス |
| 2 | admin1@example.com | Password1! | User | 企業管理者 (role=9) | 株式会社サンプル (A) | 自社の全フォルダにフルアクセス |
| 3 | admin2@example.com | Password1! | User | 企業管理者 (role=9) | テスト株式会社 (B) | 自社の全フォルダにフルアクセス |
| 4 | user1@example.com | Password1! | User | veteran (role=1) | 株式会社サンプル (A) | E2E-R23テストフォルダA に **viewer** 権限 |
| 5 | user2@example.com | Password1! | User | veteran (role=1) | 株式会社サンプル (A) | E2E-R23テストフォルダA に **editor** 権限 |
| 6 | user3@example.com | Password1! | User | general (role=0) | 株式会社サンプル (A) | グループ経由のみ（個別DS権限なし） |
| 7 | test_r9_noperm@example.com | Password1! | User | veteran (role=1) | 株式会社サンプル (A) | **権限なし**（DS一切見えない） |
| 8 | user4@example.com | Password1! | User | veteran (role=1) | テスト株式会社 (B) | **権限なし**（DS一切見えない） |

---

## 3. 権限モデルの仕組み

### 3-1. ユーザー種別の階層

```
特権管理者 (Admin, company_id = NULL)
  → 全社・全リソースにフルアクセス。会社管理・管理者管理メニューも表示。

会社管理者 (Admin with company_id / User with role=9)
  → 自社リソースにフルアクセス。会社管理・管理者管理メニューは非表示。

一般ユーザー (User, role=0 or 1)
  → Permission テーブルで個別 or グループ経由で付与された権限のみ。
```

### 3-2. DS権限ロール

| role値 | 名前 | できること |
|--------|------|----------|
| 0 | viewer | フォルダ・ファイルの **閲覧のみ**。作成/編集/削除は不可（API 403） |
| 1 | editor | 閲覧 + フォルダ/ファイルの **作成・名前変更・削除** |
| 2 | owner | editor + **権限設定**（他ユーザーへの権限付与） |

### 3-3. 権限の継承

権限はフォルダの親子関係で **上位から下位へ継承** されます。

```
ルートフォルダ（権限設定あり）
  └── サブフォルダ（権限設定なし → 親の権限を継承）
       └── ファイル（権限設定なし → 親フォルダの権限を継承）
```

- 子フォルダに直接権限を設定した場合は、その権限が優先
- ユーザーグループに付与された権限も有効（グループ内で最も高いロールが適用）

### 3-4. クロスカンパニー分離

- 全てのリソースは `company_id` でスコープされる
- Company A のユーザーは Company B のフォルダ/ファイルに一切アクセスできない
- APIレスポンスにも含まれない（サーバーサイドでフィルタリング）

---

## 4. 画面URL一覧

### 4-1. 共通画面

| URL | 画面名 | 説明 |
|-----|--------|------|
| http://localhost:3000/login | ログイン | メールアドレス + パスワードで認証 |
| http://localhost:3000/ | トピック一覧 | ログイン後のデフォルト画面 |
| http://localhost:3000/data_sources | データソース管理 | フォルダ/ファイルの管理画面 |

### 4-2. 管理者のみ表示される画面

| URL | 画面名 | 表示条件 |
|-----|--------|---------|
| http://localhost:3000/companies | 会社管理 | 特権管理者のみ |
| http://localhost:3000/admins | 管理者管理 | 特権管理者のみ |
| http://localhost:3000/users | ユーザー管理 | Admin / 企業管理者 |
| http://localhost:3000/user_groups | グループ管理 | Admin / 企業管理者 |

### 4-3. サイドバーメニューの表示パターン

| メニュー | 特権管理者 | 企業管理者 | 一般ユーザー |
|---------|-----------|-----------|------------|
| トピック管理 | o | o | o |
| 会社管理 | o | x | x |
| 管理者管理 | o | x | x |
| ユーザー管理 | o | o | x |
| グループ管理 | o | o | x |
| データソース管理 | o | o | o (権限ありの場合のみ) |

---

## 5. API一覧（データソース関連）

### 5-1. フォルダ操作

| メソッド | エンドポイント | 説明 | 必要権限 |
|---------|--------------|------|---------|
| GET | /api/data_source_folders?parent_id={id} | フォルダ一覧取得（parent_id省略でルート） | viewer以上 |
| POST | /api/data_source_folders | フォルダ作成 `{ name, parent_id }` | editor以上 |
| PATCH | /api/data_source_folders/{id} | フォルダ名変更 `{ name }` | editor以上 |
| PATCH | /api/data_source_folders/{id}/move | フォルダ移動 `{ parent_id }` | editor以上 |
| DELETE | /api/data_source_folders/{id} | フォルダ削除 | editor以上 |

### 5-2. ファイル操作

| メソッド | エンドポイント | 説明 | 必要権限 |
|---------|--------------|------|---------|
| POST | /api/data_source_files | ファイルアップロード (multipart) | editor以上 |
| PATCH | /api/data_source_files/{id} | ファイル名変更 | editor以上 |
| PATCH | /api/data_source_files/{id}/move | ファイル移動 | editor以上 |
| DELETE | /api/data_source_files/{id} | ファイル削除 | editor以上 |
| GET | /api/data_source_files/{id}/download | ファイルダウンロード | viewer以上 |
| GET | /api/data_source_files/search?q={query} | ファイル検索（ILIKE部分一致、上限50件） | viewer以上 |

### 5-3. DS⇄トピック連携

| メソッド | エンドポイント | 説明 | 必要権限 |
|---------|--------------|------|---------|
| POST | /api/data_source_files/bulk_create_topic | 選択ファイルからトピック一括作成 `{ file_ids[] }` | DS editor以上 |
| GET | /api/data_source_files/{id}/linked_topics | ファイルに紐付くトピック一覧 | DS viewer以上 |
| GET | /api/topics/{topic_id}/data_source_links | トピックに紐付くDSファイル一覧 | topic viewer以上 |
| POST | /api/topics/{topic_id}/data_source_links | DSファイルをトピックにリンク `{ data_source_file_ids[] }` | topic editor + DS editor |
| DELETE | /api/topics/{topic_id}/data_source_links | DSリンク解除 `{ data_source_file_ids[] }` | topic editor |

> **制約**: `ai_status=completed`（AI学習完了）のファイルのみリンク可能。未完了ファイルを指定するとバリデーションエラー。

### 5-4. ヒアリング・リクエスト

| メソッド | エンドポイント | 説明 | 必要権限 |
|---------|--------------|------|---------|
| GET | /requests | ヒアリング依頼一覧 | Admin: 全件 / User: 自分がrespondentのもの |
| POST | /requests | ヒアリング依頼作成 | Admin / 企業管理者 |
| GET | /requests/{id}/hearing | ヒアリングチャットへ遷移 | respondent本人 or Admin |
| GET | /requests/{id}/validation | 検証チャットへ遷移 | Admin / 企業管理者 |
| POST | /api/requests/{id}/finish_hearing | ヒアリング完了 | respondent本人 |
| GET | /api/requests/{id}/qa_data | Q&Aデータ取得（JSON） | topic viewer以上 |
| GET | /api/requests/{id}/qa_csv | Q&Aデータ出力（CSV） | topic viewer以上 |

### 5-5. チャットルーム・メッセージ

| メソッド | エンドポイント | 説明 | 必要権限 |
|---------|--------------|------|---------|
| GET | /rooms/{id} | チャットルーム表示 | ルームへのアクセス権 |
| GET | /api/messages?room_id={id} | メッセージ一覧取得 | ルームへのアクセス権 |
| POST | /api/messages | メッセージ送信 | ルームへのアクセス権 |

### 5-6. API権限エラーレスポンス

| ステータス | レスポンス | 発生条件 |
|-----------|----------|---------|
| 403 | `{"error":"権限がありません"}` | 操作に必要な権限がない |
| 422 | `{"error":"同じフォルダ内に同名のフォルダが存在します"}` | 同一階層に同名フォルダ作成 |
| 422 | `{"error":"AI処理が完了したファイルのみリンク可能です"}` | ai_status!=completedのファイルをリンク |

---

## 6. 機能の全体像と処理フロー

### 6-1. アプリの主要機能マップ

```
┌─────────────────────────────────────────────────────────────────────┐
│  SkillRelay 機能全体像                                                │
│                                                                      │
│  ┌──────────────┐     リンク      ┌──────────────┐                  │
│  │ データソース管理 │ ──────────── │  トピック管理   │                  │
│  │  (DS)         │    多対多      │              │                  │
│  │ ・フォルダCRUD │              │ ・トピック一覧  │                  │
│  │ ・ファイル管理  │              │ ・ナレッジタブ  │                  │
│  │ ・AI学習      │              │ ・トピックチャット│                 │
│  │ ・検索        │              │              │                  │
│  └──────┬───────┘              └───────┬──────┘                  │
│         │                              │                            │
│         │ ファイルアップロード            │ ヒアリング依頼                │
│         ▼                              ▼                            │
│  ┌──────────────┐              ┌──────────────┐                  │
│  │ AI処理(Worker)│              │ ヒアリング     │                  │
│  │ ・テキスト抽出 │              │ ・ヒアリングChat│                  │
│  │ ・ベクトル化   │              │ ・検証Chat     │                  │
│  │ ・インデックス │              │ ・Q&A生成      │                  │
│  └──────────────┘              └──────────────┘                  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 権限制御 (Permission)                                         │   │
│  │ ・DS権限 (viewer/editor/owner) ・トピック権限                   │   │
│  │ ・クロスカンパニー分離        ・グループ経由権限                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 6-2. DSファイルアップロード → AI学習フロー

```
[ブラウザ] DS管理画面 →「ファイルを追加」ボタン
    ↓
[POST /api/data_source_files] multipart/form-data
    ↓
[DataSourceFilesController#create]
  ├─ ファイルを S3 にアップロード (datasource/{company_id}/{timestamp}/{filename})
  ├─ DataSourceFile レコード作成 (ai_status: 0 = pending)
  └─ SQS メッセージ送信 (action_type: "data_acquisition_upload")
    ↓
[Worker (Python: worker.py)] SQS ポーリング
    ↓
[data_acquisition_index_step]
  ├─ ai_status → 1 (processing) に更新
  ├─ S3 からファイルダウンロード
  ├─ テキスト抽出 (PDF/Word/Excel/CSV/TXT)
  ├─ チャンク分割
  ├─ OpenAI Embedding 生成 (1536次元ベクトル)
  ├─ data_knowledge_documents テーブルに保存 (pgvector)
  └─ ai_status → 2 (completed) に更新  ※失敗時は 3 (failed)
    ↓
[ブラウザ] DS管理画面でファイルの「AI学習状態」が更新される
  ・pending → 未学習
  ・processing → 学習中
  ・completed → 学習完了 ✅ (トピックにリンク可能に)
  ・failed → 学習失敗 ❌
```

**対応ファイル形式**: pdf / xlsx / xls / docx / doc / pptx / ppt / csv / txt（9種類）

### 6-3. DS⇄トピック連携フロー

#### パターン1: DSファイルからトピックを新規作成

```
[DS管理画面] AI学習完了(completed)のファイルを選択
    ↓
[POST /api/data_source_files/bulk_create_topic]
  { file_ids: ["file_id_1", "file_id_2"] }
    ↓
[DataSourceFilesController#bulk_create_topic]
  ├─ バリデーション: 全ファイルが ai_status=completed か確認
  ├─ Topic.create! (status: completed)
  ├─ TopicDataSourceLink.create! (topic_id, data_source_file_id) × ファイル数
  └─ (レガシー互換) data_knowledge_documents.metadata_ に topic_id を追記
    ↓
[結果] トピック一覧に新トピック表示。ナレッジタブにDSファイルがリンク済み。
```

#### パターン2: 既存トピックにDSファイルをリンク

```
[トピック詳細画面] ナレッジタブ →「ナレッジ追加」ボタン
    ↓
[ナレッジ追加モーダル] DSフォルダをブラウズ → completedファイルを選択
    ↓
[POST /api/topics/{topic_id}/data_source_links]
  { data_source_file_ids: ["file_id_1", "file_id_2"] }
    ↓
[TopicDataSourceLinksController#create]
  ├─ 権限チェック: topic editor + DS file editor
  ├─ バリデーション: ai_status=completed のみ
  ├─ TopicDataSourceLink.create! (重複チェック: ユニーク制約)
  └─ (レガシー互換) metadata_ 更新
    ↓
[結果] ナレッジタブにリンク追加。トピックチャットでRAG検索対象に含まれる。
```

#### パターン3: DSリンク解除

```
[トピック詳細画面] ナレッジタブ → ファイル横の解除ボタン
    ↓
[DELETE /api/topics/{topic_id}/data_source_links]
  { data_source_file_ids: ["file_id_1"] }
    ↓
[TopicDataSourceLinksController#destroy]
  ├─ 権限チェック: topic editor
  └─ TopicDataSourceLink をハードデリート（物理削除）
    ↓
[結果] ナレッジタブからファイル消去。チャットのRAG検索対象から除外。
```

### 6-4. ヒアリングの全ライフサイクル

```
[管理者] トピック一覧 →「ヒアリング依頼」ボタン
    ↓
[POST /requests] リクエスト作成
  ├─ topic_id, respondent_id（回答者）, request_type: hearing
  ├─ Request.create! (status: updating)
  ├─ RequestContent.create! (初期コンテンツ)
  └─ SQS送信 (action_type: "hearing_create")
    ↓
[Worker] PlanGenerationWorkflow
  ├─ document_parse_step: 添付ドキュメントをテキスト抽出
  ├─ document_index_step: LlamaIndexでベクトル化
  └─ generate_plan_step: AIがヒアリング計画（質問リスト）を生成
    → RequestContent.context に計画を保存
    → Request.status → not_started
    ↓
[回答者] トピック一覧 → ヒアリング →「ヒアリング開始」
    ↓
[GET /requests/{id}/hearing]
  ├─ Request.status → inhearing
  └─ Room.create! (chat_type: "hearing")
    ↓
[ヒアリングチャット] ソクラテス式ヒアリング
  ├─ PBMステートマシン（3段階）
  │   Step 0: Hard NG排除 — 致命的問題の有無確認
  │   Step 1: 前提確認    — 判断の前提条件を検証
  │   Step 2: 定量/定性評価 — データに基づく深掘り
  ├─ バイアス検出（2段階）
  │   Stage 1: パターンマッチ（「大丈夫」「いつも」「絶対」等を検出）
  │   Stage 2: LLMコンテキスト注入（AIが補正質問を生成）
  └─ AI⇄回答者のメッセージ交換
    ↓
[回答者]「ヒアリング完了」ボタン
    ↓
[POST /api/requests/{id}/finish_hearing]
  ├─ Request.status → awaiting_verification
  └─ SQS送信 (action_type: "hearing_finish")
    ↓
[Worker] QaGenerationWorkflow
  ├─ ヒアリング中のメッセージを収集
  ├─ AIがQ&Aセットを抽出
  │   (質問/カテゴリ/意図/関連状況/回答 の構造化データ)
  └─ data_knowledge_hearing_qa に保存
    ↓
[管理者] 検証チャット開始
    ↓
[GET /requests/{id}/validation]
  ├─ Request.status → in_verification
  └─ Room.create! (chat_type: "validation")
    ↓
[検証チャット] AIがヒアリング結果を検証
  ├─ ヒアリング内容に矛盾・不足がないかチェック
  ├─ 必要に応じて再ヒアリング要求
  │   → Request.status → rehearing → inhearing に戻る
  └─ 検証完了
    → Request.status → completed
    → Topic.update_status() 自動実行
    → 全Requestが completed → Topic.status = completed
```

### 6-5. トピックチャット（ナレッジチャット）のRAG検索フロー

```
[ユーザー] トピック詳細 →「チャット」タブ → 質問を入力
    ↓
[POST /api/messages] { room_id, content: "質問テキスト" }
    ↓
[hearing-agent / topic-agent 実行]
    ↓
[RAG検索]
  ├─ ユーザーの質問をEmbedding化 (OpenAI)
  ├─ pgvector で類似ベクトル検索
  │   └─ topic_data_source_links JOIN で対象ファイルをフィルタ
  ├─ Cohere ReRank API で上位5件にリランク
  └─ 検索結果をコンテキストとしてLLMに渡す
    ↓
[LLM] コンテキスト + 質問 → 回答生成（ストリーミング）
    ↓
[ブラウザ] リアルタイムで回答が表示される
```

### 6-6. 3種類のチャットエージェント

| エージェント | chat_type | 用途 | 使用ツール |
|------------|-----------|------|----------|
| hearing-agent | hearing | ヒアリング対話。PBMステートマシンに従い深掘り質問 | send_suggestions |
| validation-agent | validation | ヒアリング結果の検証・確認 | rag_retriever, qa_query, web_search |
| topic-agent | topic | ナレッジベースへの質問応答 | rag_retriever, qa_query, web_search |

---

## 7. 検証シナリオ

### シナリオ A: 特権管理者 (admin@)

**ログイン**: http://localhost:3000/login → admin@example.com / Password1!

| # | 操作 | 期待される結果 |
|---|------|--------------|
| A-1 | ログイン後、サイドバーを確認 | 全6メニュー表示（トピック/会社/管理者/ユーザー/グループ/DS管理） |
| A-2 | 「データソース管理」をクリック | DS管理画面。全社のルートフォルダが表示される |
| A-3 | 任意のフォルダをクリック | フォルダ内に入る。パンくずリスト（🏠 / フォルダ名）が表示 |
| A-4 | 「新規フォルダ」ボタン → フォルダ名入力 → 「作成する」 | フォルダが作成され、一覧に表示される |
| A-5 | 作成したフォルダの ⋮ メニュー → 「名前の変更」 | ダイアログが開く。新しい名前を入力して保存 → 名前が変わる |
| A-6 | 作成したフォルダの ⋮ メニュー → 「削除」 | 確認ダイアログ表示。「削除する」→ フォルダが消える |
| A-7 | 検索バーに「e2e-r23」と入力 | 検索結果に e2e-r23-test.txt が表示される（AI学習状態: 学習完了） |
| A-8 | 既存フォルダと同名のフォルダを作成 | エラー表示「同じフォルダ内に同名のフォルダが存在します」 |
| A-9 | 「ファイルを追加」ボタンでファイルをアップロード | ファイルが一覧に表示。AI学習状態が「未学習」→「学習中」→「学習完了」に遷移 |
| A-10 | AI学習完了ファイルを選択 → トピック一括作成 | トピック一覧に新トピックが表示される |

---

### シナリオ B: 企業管理者A (admin1@)

**ログイン**: admin1@example.com / Password1!

| # | 操作 | 期待される結果 |
|---|------|--------------|
| B-1 | ログイン後の画面ヘッダー確認 | 「株式会社サンプル 管理者」と表示 |
| B-2 | サイドバー確認 | トピック/ユーザー/グループ/DS管理のみ。会社管理・管理者管理は非表示 |
| B-3 | DS管理画面を開く | 自社（株式会社サンプル）のフォルダのみ表示。E2E-R23テストフォルダA等が見える |
| B-4 | E2E-R23テストフォルダA内でフォルダ作成 | 作成成功。一覧に表示される |
| B-5 | 作成したフォルダの名前を変更 | 変更成功 |
| B-6 | フォルダを削除 | 削除成功 |
| B-7 | **重要**: Company B のフォルダが表示されないことを確認 | CompanyBフォルダ、R14-CRAC5-B、R14-CRAC6-B は表示されない |

---

### シナリオ C: 企業管理者B (admin2@)

**ログイン**: admin2@example.com / Password1!

| # | 操作 | 期待される結果 |
|---|------|--------------|
| C-1 | ログイン後の画面ヘッダー確認 | 「テスト株式会社 管理者」と表示 |
| C-2 | DS管理画面を開く | CompanyBフォルダ / R14-CRAC5-B / R14-CRAC6-B の3フォルダのみ表示 |
| C-3 | **重要**: Company A のフォルダが表示されないことを確認 | E2E-R23テストフォルダA、R12-DSF-BC1系は表示されない |

---

### シナリオ D: 閲覧者 (user1@)

**ログイン**: user1@example.com / Password1!
**このユーザーの権限**: E2E-R23テストフォルダA に **viewer** 権限

| # | 操作 | 期待される結果 |
|---|------|--------------|
| D-1 | サイドバー確認 | トピック管理 / データソース管理のみ |
| D-2 | DS管理画面を開く | 権限のあるフォルダが表示される |
| D-3 | E2E-R23テストフォルダAをクリック | フォルダ内のサブフォルダ・ファイルが閲覧できる |
| D-4 | 「新規フォルダ」ボタンでフォルダ作成を試みる | **エラー**になる（UIでボタンが押せるがAPIで403拒否） |
| D-5 | ⋮ メニュー →「名前の変更」 | **エラー**になる（API 403「権限がありません」） |
| D-6 | ⋮ メニュー →「削除」 | **エラー**になる（API 403「権限がありません」） |

> **裏側の処理**: viewer権限はDBの `permissions` テーブルに `role=0` で登録されています。
> APIコントローラの `require_ds_editor` フィルタが editor(1)以上を要求するため、
> viewer(0) では作成/編集/削除が全て 403 Forbidden で拒否されます。

---

### シナリオ E: 編集者 (user2@)

**ログイン**: user2@example.com / Password1!
**このユーザーの権限**: E2E-R23テストフォルダA に **editor** 権限

| # | 操作 | 期待される結果 |
|---|------|--------------|
| E-1 | DS管理画面を開く | E2E-R23テストフォルダA / テストフォルダA が表示（権限設定されたフォルダのみ） |
| E-2 | E2E-R23テストフォルダA内でフォルダ作成 | **作成成功**（editor権限があるため） |
| E-3 | 作成したフォルダの名前を変更 | **変更成功** |
| E-4 | フォルダを削除 | **削除成功** |
| E-5 | ファイル検索で「e2e-r23」を検索 | 検索結果にファイルが表示される |

> **裏側の処理**: editor権限は `role=1` です。APIの `require_ds_editor` は editor(1)以上を
> 要求するため、CRUD操作が全て許可されます。ただし、権限管理（他ユーザーへの権限付与）は
> owner(2)が必要なため、editorにはできません。

---

### シナリオ F: 一般ユーザー (user3@)

**ログイン**: user3@example.com / Password1!
**このユーザーの権限**: グループ経由でいくつかのフォルダに権限あり。E2E-R23テストフォルダAには権限なし。

| # | 操作 | 期待される結果 |
|---|------|--------------|
| F-1 | DS管理画面を開く | グループ経由で権限のあるフォルダのみ表示（R13-PD-Group系等） |
| F-2 | E2E-R23テストフォルダAが表示されないことを確認 | 個別権限もグループ権限もないため非表示 |
| F-3 | 表示されたフォルダでフォルダ作成を試みる | **エラー**（グループ経由の権限がviewerレベルのため） |

> **裏側の処理**: user3@ は `role=0`（general）です。DSフォルダの表示は Permission テーブルと
> UserGroupMembership を JOIN して、個人+グループの権限があるフォルダのみを返却します。
> E2E-R23テストフォルダAには個人権限もグループ権限もないため、APIレスポンスに含まれません。

---

### シナリオ G: 権限なしユーザー (test_r9_noperm@)

**ログイン**: test_r9_noperm@example.com / Password1!
**このユーザーの権限**: DS権限一切なし

| # | 操作 | 期待される結果 |
|---|------|--------------|
| G-1 | サイドバー確認 | トピック管理のみ。**データソース管理メニューが表示されない** |
| G-2 | URL直接入力: http://localhost:3000/data_sources | 「データソース管理へのアクセス権限がありません。」→ トピック管理にリダイレクト |
| G-3 | API直接呼び出し: DevToolsコンソールで `fetch('/api/data_source_folders').then(r=>r.json()).then(d=>console.log(d))` | `{"folders":[],"files":[],"breadcrumb":[]}` （空の配列が返る） |

> **裏側の処理**: DS管理メニューの表示/非表示は、ユーザーに1つでもDS関連の Permission が
> 存在するかどうかで判定しています。test_r9_noperm@ には permissions レコードが一切ないため、
> サイドバーにメニューが表示されず、画面URLに直接アクセスしてもリダイレクトされます。

---

### シナリオ H: Company Bユーザー (user4@)

**ログイン**: user4@example.com / Password1!
**このユーザーの権限**: テスト株式会社（B）所属、個別DS権限なし

| # | 操作 | 期待される結果 |
|---|------|--------------|
| H-1 | サイドバー確認 | トピック管理のみ。データソース管理メニューなし |
| H-2 | API直接呼び出し: `fetch('/api/data_source_folders').then(r=>r.json()).then(d=>console.log(d))` | `{"folders":[],"files":[],"breadcrumb":[]}` |
| H-3 | **重要**: Company A のフォルダIDを知っている場合でもアクセス不可を確認 | Company A のフォルダIDで `/api/data_source_folders?parent_id={A社のID}` を呼んでも空か403 |

> **裏側の処理**: APIコントローラの `require_company_context` フィルタが、
> `current_company_id` を用いて全クエリに会社スコープを適用します。
> Company B のユーザーが Company A のリソースIDを直接指定しても、
> サーバーサイドで `where(company_id: current_company_id)` が適用されるため、
> 結果に含まれません。

---

### シナリオ I: DS⇄トピック連携 (admin@ or admin1@ で実施)

**ログイン**: admin@example.com / Password1! （または admin1@example.com）

#### I-1. ファイルアップロード → AI学習

| # | 操作 | 期待される結果 |
|---|------|--------------|
| I-1a | DS管理画面 → フォルダ内で「ファイルを追加」→ テストファイル(PDF/TXT等)をアップロード | ファイルが一覧に表示される。AI学習状態: 「未学習」 |
| I-1b | しばらく待ってページをリロード | AI学習状態が「学習中」→「学習完了」に変わる |
| I-1c | AI学習完了ファイルの横に緑の「学習完了」バッジが表示されることを確認 | 学習完了バッジ表示 |

> **裏側の処理**: アップロード時に `SqsMessageService` が SQS キューにメッセージを送信。
> Python Worker (`worker/worker.py`) が SQS をポーリングし、`data_acquisition_index_step` を実行:
> S3 からファイルダウンロード → LlamaIndex でテキスト抽出 → チャンク分割 →
> OpenAI Embedding (1536次元ベクトル) → `data_knowledge_documents` テーブルに保存 (pgvector)。
> 完了後 `DataSourceFile.ai_status` が `completed(2)` に更新されます。

**対応ファイル形式**: pdf / xlsx / xls / docx / doc / pptx / ppt / csv / txt（9種類）

#### I-2. DSファイルからトピック一括作成

| # | 操作 | 期待される結果 |
|---|------|--------------|
| I-2a | AI学習完了ファイルのチェックボックスを選択 | チェックが入る |
| I-2b | 「トピック作成」ボタンをクリック | トピック作成ダイアログが表示 |
| I-2c | トピック名を入力して作成 | 成功メッセージ。トピック一覧画面に新トピックが表示される |
| I-2d | **失敗ケース**: AI未完了ファイル(pending/processing)をリンクしようとする | エラー: 「AI処理が完了したファイルのみリンク可能です」 |

> **裏側の処理**: `bulk_create_topic` アクションが `Topic` を作成し、
> `topic_data_source_links` 中間テーブルにレコードを INSERT。
> `TopicDataSourceLink` モデルの `file_must_be_completed` バリデーションで
> `ai_status != completed` のファイルは拒否されます。

#### I-3. ナレッジタブ（トピック⇄DSリンク管理）

| # | 操作 | 期待される結果 |
|---|------|--------------|
| I-3a | トピック一覧 → トピックをクリック → 「ナレッジ」タブ | リンク済みDSファイルの一覧が表示される |
| I-3b | 「ナレッジ追加」ボタン → DSフォルダをブラウズ → completedファイルを選択して追加 | ナレッジ一覧にファイルが追加される |
| I-3c | リンク済みファイルの解除ボタンをクリック | ファイルがナレッジ一覧から消える（DSのファイル本体は残る） |
| I-3d | ナレッジタブでファイルにチェック → 「チャット」タブに切替 → 質問入力 | チェックしたファイルのみを対象にRAG検索が実行される |

> **裏側の処理**: ナレッジ追加は `POST /api/topics/{id}/data_source_links`。
> 解除は `DELETE /api/topics/{id}/data_source_links`（物理削除、ソフトデリートなし）。
> ナレッジ検索は、選択されたファイルIDで `topic_data_source_links` を JOIN して
> pgvector 検索 → Cohere ReRank API（上位5件）→ LLM回答生成の流れ。

#### I-4. トピックチャット（RAG検索）

| # | 操作 | 期待される結果 |
|---|------|--------------|
| I-4a | トピック詳細 →「チャット」タブ → 質問を入力して送信 | AIがリンク済みDSファイルの内容を元に回答をストリーミング表示 |
| I-4b | 回答の内容がリンクしたDSファイルに関連する情報を含むか確認 | DSファイルの内容に基づいた回答が返る |
| I-4c | DSリンクを解除した後に同じ質問をする | 解除したファイルの情報は回答に含まれない |

> **裏側の処理**: `topic-agent` が実行され、`rag_retriever` ツールで
> ユーザーの質問を Embedding 化 → pgvector で類似検索
> （`topic_data_source_links` JOIN でフィルタ）→ Cohere ReRank →
> 上位5件をコンテキストとして LLM に渡し、回答をストリーミング生成。

---

### シナリオ J: ヒアリングフロー (admin@ + respondentユーザー)

**管理者**: admin@example.com / Password1!
**回答者**: admin1@example.com / Password1! （またはuser系アカウント）

#### J-1. ヒアリング依頼の作成

| # | 操作 | 期待される結果 |
|---|------|--------------|
| J-1a | admin@ でログイン → トピック一覧 → トピックを選択 →「ヒアリング依頼」ボタン | ヒアリング依頼作成画面が表示 |
| J-1b | 回答者（respondent）を選択 → 依頼を作成 | ヒアリングステータスが「未着手」に |
| J-1c | しばらく待つ（Worker がヒアリング計画を生成中） | ステータスが「未着手」のまま（計画生成完了） |

> **裏側の処理**: `Request.create!` → SQS 送信 (`hearing_create`) →
> Worker の `PlanGenerationWorkflow` が実行:
> 1. `document_parse_step`: 添付ドキュメントをテキスト抽出
> 2. `document_index_step`: LlamaIndex でベクトル化
> 3. `generate_plan_step`: AI がヒアリング計画（質問リスト）を生成
> → `RequestContent.context` に計画を保存 → `Request.status` = `not_started`

#### J-2. ヒアリング実施（ソクラテス式ヒアリング）

| # | 操作 | 期待される結果 |
|---|------|--------------|
| J-2a | 回答者アカウントでログイン → トピック一覧 → ヒアリングの「開始」ボタン | ヒアリングチャット画面が開く。AIの最初の質問が表示される |
| J-2b | AIの質問に回答を入力して送信 | AIが回答を分析し、次の深掘り質問を生成（ストリーミング表示） |
| J-2c | 数回のQ&Aを繰り返す | PBMステートマシンに従い段階的に深掘りが進む |
| J-2d | 「ヒアリング完了」ボタンをクリック | ステータスが「検証待ち」に変わる |

> **裏側の処理**: チャットは `hearing-agent` が処理。
> **PBMステートマシン（3段階）**:
> - Step 0: **Hard NG排除** — 致命的な問題の有無を確認
> - Step 1: **前提確認** — 判断の前提条件を検証（3つ以上確認で次へ）
> - Step 2: **定量/定性評価** — データに基づく深掘り（coverage_score >= 0.8 で完了）
>
> **バイアス検出（2段階）**:
> - Stage 1: パターンマッチ（「大丈夫」「いつも」「絶対」「なんとなく」等を検出、コスト0）
> - Stage 2: LLMコンテキスト注入（Stage 1検出時のみ、AIが補正質問を生成）
>
> 完了時に SQS 送信 (`hearing_finish`) → Worker の `QaGenerationWorkflow` が
> ヒアリング中のメッセージからQ&Aセット（質問/カテゴリ/意図/関連状況/回答）を抽出・保存。

#### J-3. 検証

| # | 操作 | 期待される結果 |
|---|------|--------------|
| J-3a | admin@ でログイン → 該当トピック → ヒアリングの「検証」ボタン | 検証チャット画面が開く |
| J-3b | AIがヒアリング結果のサマリーを表示 → 検証者が確認 | ヒアリング内容の矛盾・不足がないかAIがチェック |
| J-3c | 問題なければ承認 / 問題あれば再ヒアリング要求 | 承認→ステータス「完了」/ 再ヒアリング→ステータス「再ヒアリング」 |

> **裏側の処理**: `validation-agent` が実行。`rag_retriever`, `qa_query`,
> `web_search` ツールを使って多角的に検証。再ヒアリング時は
> `Request.status` → `rehearing` → 新しい `Room` が作成され、
> 前回の結果をコンテキストとして引き継いだ追加ヒアリングが実施されます。

#### J-4. トピックステータスの自動更新

| # | 操作 | 期待される結果 |
|---|------|--------------|
| J-4a | 全てのヒアリングが「完了」になった後、トピック一覧を確認 | トピックのステータスが自動で「完了」に更新 |
| J-4b | Q&Aタブやエクスポート(CSV)でヒアリング結果を確認 | 構造化されたQ&Aデータが閲覧・ダウンロード可能 |

> **裏側の処理**: `Request` の `after_save` コールバックで `Topic#update_status` が自動実行。
> 全 Request が `completed` → `Topic.status` = `completed` に更新。
> Q&A データは `/api/requests/{id}/qa_data` (JSON) / `/api/requests/{id}/qa_csv` (CSV) で取得。

---

### シナリオ K: DS⇄トピック連携の権限テスト

| # | アクター | 操作 | 期待される結果 |
|---|---------|------|--------------|
| K-1 | user2@ (editor) | ナレッジタブでDSファイルをトピックにリンク追加 | **成功**（topic editor + DS editor の両方を持つ） |
| K-2 | user1@ (viewer) | ナレッジタブでDSファイルをトピックにリンク追加 | **失敗** 403（DS viewer ではリンク追加不可） |
| K-3 | user1@ (viewer) | ナレッジタブでリンク済みファイル一覧を閲覧 | **成功**（topic viewer で閲覧可能） |
| K-4 | user1@ (viewer) | トピックチャットで質問 | **成功**（viewer でもチャットは利用可能） |
| K-5 | test_r9_noperm@ | トピックチャットにアクセス | **失敗**（トピック権限なし） |

> **裏側の処理**: DS⇄トピックリンクの追加には **両方のリソースに対する editor 権限**が必要。
> `TopicDataSourceLinksController#create` は `require_topic_editor` と
> DS ファイルの `editable_by?` の両方をチェックします。

---

### シナリオ L: 社内辞書 ↔ チャット連携 (admin1@ で実施)

**ログイン**: admin1@example.com / Password1! （企業管理者）
**前提**: 社内辞書に用語が登録済み（例: KPI報告書、OKR会議、SLA契約）。トピックにDSファイルがリンク済み。

| # | 操作 | 期待される結果 |
|---|------|--------------|
| L-1 | トピックチャットで辞書登録用語を含む質問を送信（例:「KPI報告書とは何ですか？」） | AIの回答に辞書の定義が含まれる（例:「定義（社内用語）：KPI報告書 — 毎月末に提出する重要業績評価指標の報告書」） |
| L-2 | 辞書に未登録の用語のみで質問（例:「ガントチャートやスクラム開発について教えてください」） | 辞書定義は表示されない。ヒアリングQAやDSにも情報がなければ「関連情報なし」と回答 |
| L-3 | 辞書用語＋DS検索を同時にトリガーする質問（例:「OKR会議のSLA契約について、ドキュメントも検索して詳しく教えてください」） | 辞書定義（OKR会議、SLA契約）が提示され、かつretrieve_contextでDS内容も回答に含まれる |
| L-4 | 辞書用語を含むがDS内容と無関係な質問（例:「KPI報告書の一般的なフォーマットは？一般論で教えてください」） | 辞書定義は提示されるが、「追加の情報は見つかりませんでした」と正直に回答 |

> **裏側の処理**: `POST /api/topic` (ai-server) のリクエストハンドラで、
> ユーザーのメッセージテキストに対して `getMatchingGlossaryTerms(companyId, userMessage)` を実行。
> `company_glossary_terms` テーブルに対して `position(term IN $2) > 0` でSQL部分一致検索を行い、
> マッチした用語と定義を `topic-agent` の system instructions に `## Company Glossary Terms` セクションとして注入。
> AIはプロンプトルールにより、辞書用語がマッチした場合は必ずその定義を先に提示し、
> ツール検索結果がなくても辞書定義だけは回答に含める。

---

### シナリオ M: AIレスポンス品質検証 (admin1@ で実施)

**ログイン**: admin1@example.com / Password1! （企業管理者）
**前提**: トピックにDSファイルがリンク済み。ai-serverが起動済み。

| # | 操作 | 期待される結果 |
|---|------|--------------|
| M-1 | DS内容に関連する質問を送信（例:「E2Eテストのプロジェクト概要とKPI目標について教えてください」） | `retrieve_context` ツールが呼ばれ（Completed表示）、DS内のプロジェクト名・チーム・テスト対象・KPI指標等が正しく回答に含まれる |
| M-2 | ヒアリングQA未登録のトピックで `query_qa` のみ呼ばれる質問 | `query_qa` → Completed、「この質問に関連する情報は見つかりませんでした」と回答。エラーは発生しない |
| M-3 | チャットページのレイアウトを確認 | トピック名（例:「辞書+DS連動テスト」）と説明文が左端から完全に表示される。文字の切れや重なりなし |
| M-4 | 長めの質問を送信してストリーミング応答を確認 | 応答がリアルタイムでストリーミング表示され、途中で止まったり切れたりしない |

> **裏側の処理（RAGパイプライン）**:
> 1. `topic-agent` が `retrieve_context` ツールを呼び出し
> 2. `searchVectors()` (vector-store.ts) で pgvector ハイブリッド検索実行
>    - `(metadata_::jsonb->>'_node_content')::jsonb->'metadata'->>'document_id'` で `topic_data_source_links` JOIN
>    - `USE_NEW_TOPIC_LINKS=true` 環境変数でリンクテーブル方式を使用
> 3. `rerankDocuments()` (reranker.ts) で Cohere ReRank（APIキー未設定時は元の類似度順でフォールバック）
> 4. 検索結果をコンテキストとして LLM に渡し回答生成
>
> **既知の修正済みバグ（commit e78ff3f）**:
> - JSONB演算子 `->` → `->>` 修正（`_node_content` のJSONテキスト展開）
> - `requestId` が空配列 `[]` として渡される問題（Array.isArray チェック追加）
> - Cohere API キー未設定時の401エラー（フォールバック追加）
>
> **レイアウト修正**:
> - `.content-header` の `margin: 10px 40px 40px 0` が `main-content` の `overflow: hidden` と組み合わさり
>   `scrollLeft: 40px` の水平スクロールが発生していた問題を修正
> - チャットページ (rooms/show.html.erb) で `.content-header { display: none !important }` を設定

---

## 8. DevTools での API 直接検証方法

ブラウザの DevTools (F12) → Console タブで以下を実行できます。

### フォルダ一覧取得
```javascript
fetch('/api/data_source_folders')
  .then(r => r.json())
  .then(d => console.log('フォルダ数:', d.folders.length, d.folders.map(f => f.name)))
```

### サブフォルダ取得（parent_id指定）
```javascript
fetch('/api/data_source_folders?parent_id=FOLDER_ID_HERE')
  .then(r => r.json())
  .then(d => console.log(d))
```

### フォルダ作成テスト
```javascript
fetch('/api/data_source_folders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
  },
  body: JSON.stringify({ name: 'テストフォルダ名', parent_id: 'PARENT_FOLDER_ID' })
}).then(r => { console.log('Status:', r.status); return r.json(); }).then(d => console.log(d))
```

### フォルダ名変更テスト
```javascript
fetch('/api/data_source_folders/FOLDER_ID', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
  },
  body: JSON.stringify({ name: '新しい名前' })
}).then(r => { console.log('Status:', r.status); return r.json(); }).then(d => console.log(d))
```

### フォルダ削除テスト
```javascript
fetch('/api/data_source_folders/FOLDER_ID', {
  method: 'DELETE',
  headers: {
    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
  }
}).then(r => { console.log('Status:', r.status); return r.json(); }).then(d => console.log(d))
```

### ファイル検索テスト
```javascript
fetch('/api/data_source_files/search?q=検索キーワード')
  .then(r => r.json())
  .then(d => console.log(d))
```

### DS⇄トピック連携: リンク済みファイル一覧取得
```javascript
fetch('/api/topics/TOPIC_ID/data_source_links')
  .then(r => r.json())
  .then(d => console.log('リンク済みファイル:', d))
```

### DS⇄トピック連携: ファイルをトピックにリンク
```javascript
fetch('/api/topics/TOPIC_ID/data_source_links', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
  },
  body: JSON.stringify({ data_source_file_ids: ['FILE_ID_1', 'FILE_ID_2'] })
}).then(r => { console.log('Status:', r.status); return r.json(); }).then(d => console.log(d))
```

### DS⇄トピック連携: リンク解除
```javascript
fetch('/api/topics/TOPIC_ID/data_source_links', {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
  },
  body: JSON.stringify({ data_source_file_ids: ['FILE_ID_1'] })
}).then(r => { console.log('Status:', r.status); return r.json(); }).then(d => console.log(d))
```

### ファイルに紐付くトピック一覧
```javascript
fetch('/api/data_source_files/FILE_ID/linked_topics')
  .then(r => r.json())
  .then(d => console.log('紐付きトピック:', d))
```

### トピック一括作成（DSファイルから）
```javascript
fetch('/api/data_source_files/bulk_create_topic', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
  },
  body: JSON.stringify({ file_ids: ['COMPLETED_FILE_ID_1'] })
}).then(r => { console.log('Status:', r.status); return r.json(); }).then(d => console.log(d))
```

---

## 9. 内部処理フロー図

### 8-1. ログイン〜画面表示の流れ

```
[ブラウザ] POST /login (email, password)
    ↓
[SessionsController] authenticate → session[:uid], session[:user_type] 設定
    ↓
[リダイレクト] → / (トピック一覧)
    ↓
[ApplicationController] set_current_user → Admin or User をロード
    ↓
[サイドバー表示判定]
  ├─ Admin?            → 全メニュー表示
  ├─ role=9?           → 管理系 + DS管理表示
  └─ User?             → DS権限あり → DS管理表示 / なし → 非表示
```

### 8-2. DS管理画面のフォルダ取得フロー

```
[ブラウザ] GET /api/data_source_folders?parent_id=xxx
    ↓
[Api::DataSourceFoldersController#index]
    ↓
[require_company_context] → company_idスコープ適用
    ↓
[ユーザー種別で分岐]
  ├─ Admin / CompanyAdmin?
  │    → 自社(or全社)のフォルダを全取得
  │
  └─ User?
       → user_ds_permissions() で権限プリロード
       → permissions テーブル JOIN
       │  ├─ 個人権限 (grantee_type=User, grantee_id=自分)
       │  └─ グループ権限 (grantee_type=UserGroup, grantee_id=所属グループ)
       → 権限のあるフォルダ + その祖先チェーン（ナビゲーション用）を返却
    ↓
[レスポンス] { folders: [...], files: [...], breadcrumb: [...] }
```

### 8-3. フォルダ作成の権限チェックフロー

```
[ブラウザ] POST /api/data_source_folders { name, parent_id }
    ↓
[Api::DataSourceFoldersController#create]
    ↓
[before_action: require_ds_editor]
    ↓
[parent_folder.editable_by?(current_user, user_type)]
  ├─ Admin?        → true (無条件許可)
  ├─ CompanyAdmin?  → true (自社内なら許可)
  └─ User?
       ├─ 直接権限チェック (Permission: grantee=self, permissible=parent)
       │    → role >= editor(1) ? → 許可
       ├─ グループ権限チェック (Permission: grantee=所属グループ)
       │    → 最高roleが editor(1)以上 ? → 許可
       └─ 継承権限チェック (parent の permission_parent を遡る)
            → いずれかの祖先で editor(1)以上の権限 ? → 許可
    ↓
[許可] → フォルダ作成 → 201 Created
[拒否] → 403 Forbidden {"error":"権限がありません"}
```

### 8-4. 同名フォルダ防止の処理

```
[フォルダ作成リクエスト]
    ↓
[DataSourceFolder モデルバリデーション]
  validate :name_uniqueness_in_parent
    → 同じ parent_id + 同じ name のフォルダが存在するか?
    → 存在する場合: errors.add → 422 Unprocessable Entity
    → レスポンス: {"error":"同じフォルダ内に同名のフォルダが存在します"}
```

---

## 10. チェックリスト（印刷用）

検証時にチェックマークを入れて使えます。

```
[ ] A-1  admin@     サイドバー全6メニュー表示
[ ] A-2  admin@     DS管理画面・全社フォルダ表示
[ ] A-3  admin@     フォルダナビゲーション・パンくずリスト
[ ] A-4  admin@     フォルダ作成
[ ] A-5  admin@     フォルダ名変更
[ ] A-6  admin@     フォルダ削除（確認ダイアログ）
[ ] A-7  admin@     ファイル検索
[ ] A-8  admin@     同名フォルダ作成防止

[ ] B-1  admin1@    ヘッダー「株式会社サンプル 管理者」
[ ] B-2  admin1@    サイドバー（会社/管理者管理なし）
[ ] B-3  admin1@    DS管理画面・自社フォルダのみ
[ ] B-4  admin1@    フォルダ作成
[ ] B-5  admin1@    フォルダ名変更
[ ] B-6  admin1@    フォルダ削除
[ ] B-7  admin1@    Company Bフォルダ非表示

[ ] C-1  admin2@    ヘッダー「テスト株式会社 管理者」
[ ] C-2  admin2@    Company Bフォルダのみ表示（3件）
[ ] C-3  admin2@    Company Aフォルダ非表示

[ ] D-1  user1@     サイドバー（トピック/DS管理のみ）
[ ] D-2  user1@     DS管理画面・権限フォルダ表示
[ ] D-3  user1@     フォルダ内閲覧OK
[ ] D-4  user1@     フォルダ作成 → 403拒否
[ ] D-5  user1@     フォルダ名変更 → 403拒否
[ ] D-6  user1@     フォルダ削除 → 403拒否

[ ] E-1  user2@     DS管理画面・権限フォルダ表示
[ ] E-2  user2@     フォルダ作成 → 成功
[ ] E-3  user2@     フォルダ名変更 → 成功
[ ] E-4  user2@     フォルダ削除 → 成功
[ ] E-5  user2@     ファイル検索

[ ] F-1  user3@     DS管理・グループ経由フォルダのみ表示
[ ] F-2  user3@     E2E-R23テストフォルダA非表示
[ ] F-3  user3@     フォルダ作成 → 403拒否

[ ] G-1  noperm@    DS管理メニュー非表示
[ ] G-2  noperm@    URL直接アクセス → リダイレクト
[ ] G-3  noperm@    API → 空配列

[ ] H-1  user4@     DS管理メニュー非表示
[ ] H-2  user4@     API → 空配列
[ ] H-3  user4@     Company AのフォルダIDでアクセス不可

--- DS⇄トピック連携 ---
[ ] I-1a admin@     ファイルアップロード → 一覧表示
[ ] I-1b admin@     AI学習状態: 未学習→学習中→学習完了
[ ] I-1c admin@     学習完了バッジ表示
[ ] I-2a admin@     学習完了ファイルを選択
[ ] I-2b admin@     トピック一括作成
[ ] I-2c admin@     トピック一覧に新トピック表示
[ ] I-2d admin@     未完了ファイルでリンク → エラー
[ ] I-3a admin@     ナレッジタブ表示・リンク済みファイル一覧
[ ] I-3b admin@     ナレッジ追加（DSフォルダブラウズ→ファイル選択）
[ ] I-3c admin@     ナレッジ解除（ファイル本体は残る）
[ ] I-3d admin@     ナレッジ選択→チャットタブで検索
[ ] I-4a admin@     トピックチャットで質問→AI回答
[ ] I-4b admin@     回答がDSファイル内容に基づく
[ ] I-4c admin@     リンク解除後→回答に含まれない

--- ヒアリングフロー ---
[ ] J-1a admin@     ヒアリング依頼作成画面表示
[ ] J-1b admin@     回答者選択→依頼作成→未着手
[ ] J-1c admin@     Worker計画生成完了
[ ] J-2a 回答者      ヒアリングチャット開始→AI質問表示
[ ] J-2b 回答者      回答→AIが深掘り質問生成
[ ] J-2c 回答者      PBMステートマシン段階的深掘り
[ ] J-2d 回答者      ヒアリング完了→検証待ち
[ ] J-3a admin@     検証チャット開始
[ ] J-3b admin@     AI検証サマリー表示
[ ] J-3c admin@     承認→完了 / 再ヒアリング→戻る
[ ] J-4a admin@     全Request完了→Topic自動完了
[ ] J-4b admin@     Q&Aデータ閲覧・CSV出力

--- DS⇄トピック権限テスト ---
[ ] K-1  user2@     editor: ナレッジリンク追加 → 成功
[ ] K-2  user1@     viewer: ナレッジリンク追加 → 403
[ ] K-3  user1@     viewer: ナレッジ一覧閲覧 → 成功
[ ] K-4  user1@     viewer: トピックチャット → 成功
[ ] K-5  noperm@    トピックチャットアクセス → 失敗

--- 社内辞書↔チャット連携 ---
[ ] L-1  admin1@    辞書用語を含む質問→辞書定義がAI回答に含まれる
[ ] L-2  admin1@    辞書未登録用語のみの質問→辞書定義は表示されない
[ ] L-3  admin1@    辞書用語＋DS検索→辞書定義＋DS内容の両方が回答に含まれる
[ ] L-4  admin1@    辞書用語を含むがDS無関係な質問→辞書定義のみ提示

--- AIレスポンス品質検証 ---
[ ] M-1  admin1@    DS検索→retrieve_contextが呼ばれ内容を正しく解釈
[ ] M-2  admin1@    query_qaのみ→ヒアリングQA未登録時「情報なし」と回答
[ ] M-3  admin1@    チャットページレイアウト崩れなし（タイトル/説明全文表示）
[ ] M-4  admin1@    ストリーミング応答が正常に完了する

--- 自動テスト（Rails Runner）実施済み ---
[x] C1-1a~1b  フォルダ作成・名前変更（企業管理者）
[x] C1-1c~1d  サブフォルダ作成・同名拒否(422)
[x] C1-1e~1f  Viewer: viewable=true, editable=false
[x] C1-1g     Editor: editable=true
[x] C1-1h~1i  NoPerm拒否・クロスカンパニー拒否
[x] C1-1j~1l  サブフォルダ権限継承（viewer/editor）
[x] C1-1m     企業管理者アクセス（コントローラー短絡で実質PASS）
[x] C1-1n     特権管理者フルアクセス
[x] C1-1o     SQLインジェクション防止
[x] C1-1p     循環参照防止
[x] C1-1q~1v  ファイル権限テスト（継承/クロスカンパニー）
[x] C2-1~4    TopicDataSourceLink構造・重複防止・ai_statusバリデーション
[x] C3-1~7    RAG会社分離（metadata_/topic_data_source_links JOIN）
[x] C4-1~10   3階層権限継承・直接権限優先・グループ権限・NoPerm/Cross拒否
[x] H1-1~5    ai_status分布・completed存在・S3キー・TopicDSLinks存在
[x] H2-1~3    DSリンクあり/なしトピック・knowledge_documents確認
[x] H3-1~2    AI未完了ファイル存在・ai_statusバリデーション確認
[x] H4-1~2    リクエスト・ルーム存在確認
[x] M1-1~8    特殊文字検索安全性（7/8 PASS、NULLバイトはPGが拒否）
[x] M3-1      カスケードsoft delete動作
[x] M4-1      グループメンバーシップ確認
[x] M5-1~3    辞書マッチング境界（完全一致○/部分文字列×）
[x] M6-1~2    5階層フォルダネスト・権限継承

--- UIブラウザテスト実施済み ---
[x] L-UI-1    DS管理画面：フォルダ一覧表示・ボタン・検索ボックス
[x] L-UI-2    トピックチャット画面：タイトル表示・チャット/ナレッジタブ切替
[x] L-UI-3    ナレッジタブ：ファイル一覧・完了バッジ・解除ボタン・追加ボタン
[x] L-UI-4    レスポンシブ1512px（PASS）/768px（PASS）/375px（モバイル非最適化）
```
