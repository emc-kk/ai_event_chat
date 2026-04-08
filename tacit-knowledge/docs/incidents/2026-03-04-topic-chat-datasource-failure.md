# インシデントレポート: トピックチャットからデータソースを参照できない (2026-03-04)

## サマリ

| 項目 | 内容 |
|---|---|
| 発生日 | 2026-03-04 |
| 影響 | プレビュー環境（mock/ds-acl）でトピックチャットがデータソースファイルのコンテキストを取得できない |
| 根本原因 | 複合的（5つの独立した問題が同時に発生） |
| 復旧時間 | 約3時間（調査・DB手動修正・コード修正・デプロイ） |
| データ消失 | なし |
| 対応PR | [#117](https://github.com/emc-kk/skillrelay/pull/117) (main), mock/ds-acl 直接コミット |

## 症状

トピックチャットで質問すると以下の2つのエラーが発生:

1. **`retrieve_context` ツール**: 「関連するコンテキスト情報が見つかりませんでした」 — データソースからインデックスされたドキュメントが検索にヒットしない
2. **`query_qa` ツール**: `relation "data_knowledge_hearing_qa" does not exist` — テーブル未存在によるハードエラー

## タイムライン

| 時刻 (JST) | イベント |
|---|---|
| 15:00頃 | AI学習機能の動作確認完了（ファイルアップロード→学習完了を確認） |
| 15:10 | データソース検索でインデックス済みコンテンツがヒットすることを確認 |
| 15:15 | トピックチャットで質問 → `retrieve_context` が空結果を返す |
| 15:20 | DB調査開始 — `topic_data_source_links` テーブルが空であることを発見 |
| 15:25 | `data_knowledge_documents` の `metadata_.topic_id` が全て NULL であることを発見 |
| 15:30 | 手動で `topic_data_source_links` に3件挿入、`metadata_.topic_id` を更新 |
| 15:35 | 再テスト → `query_qa` がテーブル未存在エラーでクラッシュ |
| 15:40 | `data_knowledge_hearing_qa` テーブルが存在しないことを確認 |
| 15:45 | 手動でテーブル作成（`CREATE TABLE`） |
| 16:00 | 根本原因の分析完了、コード修正開始 |
| 17:00 | PR #117 に追加コミット push |
| 17:15 | mock/ds-acl に独自修正 push |
| 17:20 | 全 mock ブランチに main を merge & push |

## 原因分析

### 問題1: `data_knowledge_hearing_qa` テーブルが存在しない

**直接原因**: このテーブルは Python worker の LlamaIndex `PGVectorStore` が QA 生成ワークフロー実行時に動的に作成する。プレビュー環境では QA 生成が一度も実行されていないため、テーブル自体が存在しなかった。

**影響**: AI server の `query_qa` ツールがこのテーブルを直接クエリするため、`relation "data_knowledge_hearing_qa" does not exist` エラーでトピックチャット全体がクラッシュ。

```
-- テーブルは以下の呼び出しチェーンで初めて作成される:
-- run_qa_generation() → create_knowledge_hearing_qa_vector_store() → PGVectorStore.from_params()
-- プレビュー環境ではこのフローが未実行だった
```

**発見が遅れた理由**:
1. 本番環境では QA 生成が既に実行済みのためテーブルが存在する
2. AI 学習（データソースインデックス）のテスト時は `data_knowledge_documents` テーブルのみ使用するため問題が顕在化しない
3. トピックチャット時に初めて `query_qa` が呼ばれるため、そこで初めてエラーになる

### 問題2: `topic_data_source_links` が空

**直接原因**: `bulk_create_topic` アクションで `completed?`（ai_status == 2）のファイルのみリンクを作成していた。

```ruby
# 修正前: completed? のファイルのみリンク作成
completed_files = files.select(&:completed?)
completed_files.each do |file|
  TopicDataSourceLink.create!(topic: topic, data_source_file: file, linked_by: current_user)
end
```

テスト時の状況:
- ファイルアップロード → AI学習完了を確認
- しかしトピック作成時にファイルの `ai_status` が何らかの理由で `completed` でなかった可能性がある
- または、トピック作成が AI 学習完了前に行われた

**影響**: `USE_NEW_TOPIC_LINKS=true` 時に `retrieve_context` が結合テーブル経由でフィルタリングするため、リンクがないとドキュメントが一切ヒットしない。

### 問題3: `metadata_.topic_id` が NULL

**直接原因**: データソースファイルのインデックス時（`data_acquisition_index_step`）では `topic_id` を `None` として渡している。

```python
# data_acquisition_index_step.py
await asyncio.to_thread(
    process_directory_indexing,
    temp_dir,
    None,  # request_id (データソースの場合は None)
    None,  # topic_id ← ここが問題
    relative_path_to_document_id,
)
```

データソースファイルはトピックとは独立してインデックスされるため、インデックス時点では `topic_id` が不明。後からトピックに紐づけた場合、メタデータは更新されない。

**影響**: レガシーモード（`USE_NEW_TOPIC_LINKS` 未設定）では `metadata_->>'topic_id'` でフィルタリングするため、NULL のドキュメントは検索にヒットしない。

### 問題4: `USE_NEW_TOPIC_LINKS` がプレビュー環境で未設定

**直接原因**: `cloudformation/templates/11-preview.yml` の AI server 環境変数に `USE_NEW_TOPIC_LINKS` が含まれていなかった。

**影響**: AI server がレガシーモード（`metadata_->>'topic_id'` フィルタリング）で動作。問題3 と合わせて、データソースファイルがトピックチャットから一切参照できない状態。

```typescript
// ai-server/lib/rag/vector-store.ts
if (process.env.USE_NEW_TOPIC_LINKS === 'true') {
  // 新モード: topic_data_source_links 結合テーブル経由
  sql += ` AND ... IN (SELECT data_source_file_id FROM topic_data_source_links WHERE topic_id = $N)`
} else {
  // レガシーモード: metadata_.topic_id 直接フィルタリング ← プレビューではこちらが使われていた
  sql += ` AND metadata_->>'topic_id' = $N`
}
```

### 問題5: Mastra PK制約名の不一致（大和環境で発見）

**直接原因**: `@mastra/pg` v1.1.0 でデフォルト `schemaName` が `"public"` に変更。PK制約名が `mastra_ai_spans_traceid_spanid_pk` → `public_mastra_ai_spans_traceid_spanid_pk` に変わり、既存DBとの不一致で `PostgresStore.init()` が「multiple primary keys」エラーでクラッシュ。

## 対応内容

### Phase 1: DB手動修正（対症療法）

プレビュー環境のDBに直接接続して修正:

```sql
-- 1. data_knowledge_hearing_qa テーブル作成
CREATE TABLE data_knowledge_hearing_qa (
  id bigserial PRIMARY KEY,
  text varchar NOT NULL,
  metadata_ json,
  node_id varchar,
  embedding vector(1536),
  text_search_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED
);

-- 2. topic_data_source_links にリンク挿入（3件）
INSERT INTO topic_data_source_links (id, topic_id, data_source_file_id, linked_by_id, linked_by_type, created_at)
VALUES (...);

-- 3. metadata_.topic_id を更新
UPDATE data_knowledge_documents
SET metadata_ = (metadata_::jsonb || jsonb_build_object('topic_id', '<topic_id>'))::json
WHERE ...;
```

### Phase 2: コード修正（根本対策）

#### PR #117 (main → merged)

| ファイル | 修正内容 | 対応する問題 |
|---|---|---|
| `ai-server/instrumentation.ts` | Mastra PK制約リネーム + `data_knowledge_hearing_qa` テーブルの `CREATE TABLE IF NOT EXISTS` | 問題1, 問題5 |
| `ai-server/lib/services/knowledge-qa-service.ts` | `safeQaQuery()` ラッパー追加 — テーブル未存在時に空配列を返す | 問題1（多重防御） |
| `cloudformation/templates/11-preview.yml` | AI server に `USE_NEW_TOPIC_LINKS=true` 追加 | 問題4 |

#### mock/ds-acl 直接コミット

| ファイル | 修正内容 | 対応する問題 |
|---|---|---|
| `core/app/controllers/api/data_source_files_controller.rb` | `bulk_create_topic` で全選択ファイルにリンク作成（`completed?` 制限を撤廃） | 問題2 |
| `worker/src/workflows/steps/data_acquisition_index.py` | AI学習完了後に `topic_data_source_links` を逆引きしてレガシー `metadata_.topic_id` を更新 | 問題3 |

### 修正の詳細

#### 1. `instrumentation.ts` — テーブル自動作成

AI server の Next.js instrumentation hook でサーバー起動時にテーブルの存在を保証:

```typescript
// 既存の Mastra PK リネームに加えて追加
await pool.query(`
  CREATE TABLE IF NOT EXISTS data_knowledge_hearing_qa (
    id bigserial PRIMARY KEY,
    text varchar NOT NULL,
    metadata_ json,
    node_id varchar,
    embedding vector(1536),
    text_search_tsv tsvector
      GENERATED ALWAYS AS (to_tsvector('english', text)) STORED
  );
`)
```

#### 2. `knowledge-qa-service.ts` — graceful fallback

全QAクエリ関数を `safeQaQuery()` でラップし、テーブル未存在エラーをハンドリング:

```typescript
async function safeQaQuery<T extends Record<string, unknown>>(
  sql: string, params: unknown[]
): Promise<T[]> {
  try {
    return await query<T>(sql, params)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('relation') && msg.includes('does not exist')) {
      console.warn('[KnowledgeQaService] table does not exist yet — returning empty results')
      return []
    }
    throw error
  }
}
```

#### 3. `bulk_create_topic` — 全ファイルリンク

```ruby
# 修正後: AI学習状態に関わらず全ファイルにリンク作成
files.each do |file|
  TopicDataSourceLink.create!(
    topic: topic,
    data_source_file: file,
    linked_by: current_user
  )
end
```

#### 4. `data_acquisition_index_step` — 完了後のレガシーメタデータ更新

```python
def update_legacy_topic_metadata(db, file_id):
    """AI学習完了後、紐づくトピックの metadata_.topic_id を更新"""
    links = db.execute_query(
        "SELECT topic_id FROM topic_data_source_links WHERE data_source_file_id = %s",
        [file_id], fetch=True,
    )
    for link in links:
        db.execute_query("""
            UPDATE data_knowledge_documents
            SET metadata_ = (metadata_::jsonb || jsonb_build_object('topic_id', %s::text))::json
            WHERE (metadata_::jsonb->>'_node_content')::jsonb->'metadata'->>'document_id' = %s
        """, [link['topic_id'], file_id])
```

## 再発防止策

| 対策 | 状態 | 詳細 |
|---|---|---|
| `data_knowledge_hearing_qa` テーブルの起動時自動作成 | ✅ 実装済 | `instrumentation.ts` で `CREATE TABLE IF NOT EXISTS` |
| `query_qa` のテーブル未存在ハンドリング | ✅ 実装済 | `safeQaQuery()` ラッパーによる多重防御 |
| `USE_NEW_TOPIC_LINKS` の CloudFormation 追加 | ✅ 実装済 | プレビュー AI server 環境変数に追加 |
| `bulk_create_topic` の全ファイルリンク | ✅ 実装済 | `completed?` 制限を撤廃 |
| AI学習完了後のレガシーメタデータ更新 | ✅ 実装済 | `update_legacy_topic_metadata()` をインデックス完了後に呼び出し |

## データフロー図（修正後）

```
ファイルアップロード
  │
  ├─ Rails: DataSourceFile 作成 (ai_status: pending)
  ├─ Rails: SQS メッセージ送信
  │
  ▼
SQS → Lambda Worker
  │
  ├─ S3 からファイルダウンロード
  ├─ LlamaIndex でベクトルインデックス作成
  │   └─ data_knowledge_documents にチャンク挿入
  ├─ ai_status を completed に更新
  └─ ★ topic_data_source_links を逆引きして metadata_.topic_id 更新 [NEW]

トピック作成（bulk_create_topic）
  │
  ├─ Topic レコード作成
  ├─ ★ 全選択ファイルに TopicDataSourceLink 作成 [FIXED: 以前は completed のみ]
  └─ レガシー: metadata_.topic_id を更新

トピックチャット（AI Server）
  │
  ├─ retrieve_context ツール
  │   └─ ★ USE_NEW_TOPIC_LINKS=true → topic_data_source_links 経由でフィルタ [NEW]
  │
  └─ query_qa ツール
      ├─ ★ data_knowledge_hearing_qa が instrumentation.ts で自動作成済み [NEW]
      └─ ★ テーブル未存在でも safeQaQuery() で空結果を返す [NEW]
```

## 教訓

1. **動的テーブル作成はアンチパターン**: LlamaIndex が初回利用時にテーブルを作成する設計は、読み取り側（AI server）が書き込み側（worker）のライフサイクルに依存してしまう。テーブルは起動時に明示的に作成すべき。

2. **フィルタリングモードの環境変数は忘れやすい**: 新しい機能フラグ（`USE_NEW_TOPIC_LINKS`）を追加した際、全環境の設定に反映されているか確認するチェックリストが必要。

3. **「完了済みのみリンク」は過度に制限的**: ユーザーが明示的にファイルを選択してトピックを作成する場合、AI学習状態に関わらずリンクすべき。リンクの意味は「このファイルはこのトピックに関連する」であり、「インデックス済み」ではない。

4. **多重防御（Defense in Depth）が重要**: テーブル自動作成（instrumentation）+ エラーハンドリング（safeQaQuery）の2段構えにすることで、どちらか一方が失敗しても致命的にならない。
