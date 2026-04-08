# データフロー

## チャット処理フロー

ユーザーがチャットを送信してから応答が表示されるまでの流れ。

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant React as React SPA
    participant AI as AI Server
    participant DB as PostgreSQL
    participant S3 as AWS S3

    User->>React: メッセージ送信
    React->>AI: POST /api/hearing (SSE)
    AI->>DB: ユーザーメッセージ保存

    alt ファイル添付あり
        AI->>S3: ファイルアップロード
        AI->>DB: MessageFile保存
    end

    AI->>AI: Mastraエージェント実行

    loop ストリーミング
        AI-->>React: テキストチャンク送信
        React-->>User: リアルタイム表示
    end

    AI->>DB: AIメッセージ保存
    React->>User: 完了表示
```

## チャット種別ごとの処理

### Hearing (ヒアリング)

ユーザーから情報を収集するための対話。

```mermaid
flowchart LR
    A[ヒアリング開始] --> B{初回メッセージ?}
    B -->|Yes| C[初期プロンプト生成]
    B -->|No| D[コンテキスト取得]
    C --> E[hearing-agent実行]
    D --> E
    E --> F[応答ストリーミング]
    F --> G[メッセージ保存]
```

### Validation (検証)

収集した情報の検証・確認を行う対話。ツールを使用可能。

```mermaid
flowchart LR
    A[検証開始] --> B[validation-agent実行]
    B --> C{ツール必要?}
    C -->|Yes| D[RAG/Web検索実行]
    C -->|No| E[応答生成]
    D --> E
    E --> F[メッセージ保存]
```

### Topic (トピック)

トピック単位での横断的な議論。複数リクエストの情報を参照可能。

```mermaid
flowchart LR
    A[トピック開始] --> B[トピック情報取得]
    B --> C[関連リクエスト取得]
    C --> D[topic-agent実行]
    D --> E{ツール必要?}
    E -->|Yes| F[RAG/QA/Web検索]
    E -->|No| G[応答生成]
    F --> G
    G --> H[メッセージ保存]
```

## Worker処理フロー

WorkerはSQSからメッセージを受信し、`next_status`に応じて異なる処理を実行。

```mermaid
flowchart TB
    A[SQSメッセージ受信] --> B{action_type判定}

    B --> C{ドキュメントあり?}
    C -->|Yes| D[S3からダウンロード]
    D --> E[LlamaIndexで解析]
    E --> F[ベクトル化・保存]
    C -->|No| G{next_status?}
    F --> G

    G -->|not_started/rehearing| H[Plan Generator]
    G -->|awaiting_verification| I[QA Generator]
    G -->|manual_generation| K[Manual Generator]
    G -->|その他| J[ステータス更新のみ]

    H --> L[ヒアリング計画生成]
    L --> M[RequestContent保存]

    I --> N[会話からQA抽出]
    N --> O[QAペア保存]

    K --> P[マニュアル生成]
    P --> Q{動画あり?}
    Q -->|Yes| R[Video Encoder]
    Q -->|No| S[Manual保存]
    R --> S

    M --> T[Requestステータス更新]
    O --> T
    S --> T
    J --> T

    T --> U[SQSメッセージ削除]
```

## ドキュメント処理フロー

### ヒアリング添付ドキュメント

ユーザーがヒアリング中にアップロードしたドキュメントがベクトル化されるまでの流れ。

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Rails as Core (Rails)
    participant S3 as AWS S3
    participant SQS as AWS SQS
    participant Worker as Worker
    participant DB as PostgreSQL

    User->>Rails: ドキュメントアップロード
    Rails->>S3: ファイル保存
    Rails->>DB: RequestDocument作成 (pending)
    Rails->>SQS: 処理ジョブ送信
    Rails->>User: アップロード完了

    Note over Worker: 非同期処理

    Worker->>SQS: メッセージ受信
    Worker->>S3: ファイル取得
    Worker->>Worker: LlamaIndex解析
    Worker->>Worker: チャンク分割
    Worker->>Worker: 埋め込み生成
    Worker->>DB: ベクトル保存 (pgvector)
    Worker->>DB: ステータス更新 (processed)
```

### データソースファイル処理

DSファイルがアップロードされ、ベクトル化後にトピックにリンクされるまでの流れ。

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Rails as Core (Rails)
    participant S3 as AWS S3
    participant SQS as AWS SQS
    participant Worker as Worker
    participant DB as PostgreSQL

    User->>Rails: DSファイルアップロード (POST /api/data_source_files)
    Rails->>S3: ファイル保存 (datasource/{company_id}/{timestamp}/{filename})
    Rails->>DB: DataSourceFile作成 (ai_status: pending)
    Rails->>SQS: 処理ジョブ送信 (action_type: data_acquisition_upload)
    Rails->>User: アップロード完了

    Note over Worker: 非同期処理

    Worker->>SQS: メッセージ受信
    Worker->>S3: ファイル取得
    Worker->>Worker: LlamaIndex解析・チャンク分割・埋め込み生成
    Worker->>DB: data_knowledge_documents にベクトル保存
    Worker->>DB: DataSourceFile.ai_status → completed

    Note over User: completedファイルをトピックにリンク

    alt A方向: DS → トピック作成
        User->>Rails: POST /api/data_source_files/bulk_create_topic
        Rails->>DB: Topic作成 + topic_data_source_links INSERT
    else B方向: トピック → ナレッジ追加
        User->>Rails: POST /api/topics/:id/data_source_links
        Rails->>DB: topic_data_source_links INSERT
    end

    User->>Rails: ナレッジ検索
    Rails->>DB: topic_data_source_links経由でRAG検索
```

## RAG検索フロー

ユーザーの質問に対して関連ドキュメントを検索する流れ。トピック内のナレッジ検索では、`topic_data_source_links` 中間テーブルを経由してリンク済みファイルのチャンクのみを対象にフィルタする。

```mermaid
sequenceDiagram
    participant Agent as Mastraエージェント
    participant Tool as RAG Tool
    participant Embed as Embedding Service
    participant DB as PostgreSQL
    participant Cohere as Cohere API

    Agent->>Tool: retrieve_context(topicId, fileIds?)
    Tool->>Embed: クエリ埋め込み生成
    Embed-->>Tool: ベクトル (1536次元)

    alt fileIds指定あり
        Tool->>DB: pgvector検索 + fileIdsフィルタ
    else トピック全体
        Tool->>DB: pgvector検索 + topic_data_source_links JOIN
    end

    DB-->>Tool: 上位20件
    Tool->>Cohere: Rerank API
    Cohere-->>Tool: 上位5件 (スコア付き)
    Tool-->>Agent: フォーマット済みテキスト + ソース情報
```

**検索モード:** ハイブリッド検索（デフォルト）= ベクトル類似度(0.7) + 全文テキスト検索(0.3)のスコア合成。vector / text 単独モードも選択可能。

## メッセージ保存の詳細

メッセージがどのように保存されるかの詳細フロー。

```mermaid
flowchart TB
    A[メッセージ受信] --> B{タイプ判定}
    B -->|user| C[ユーザーメッセージ保存]
    B -->|assistant| D[AIメッセージ保存]

    C --> E{前のAIメッセージ存在?}
    E -->|Yes| F[question_id設定]
    E -->|No| G[question_id=null]

    F --> H[messages INSERT]
    G --> H
    D --> H

    H --> I{ファイル添付?}
    I -->|Yes| J[message_files INSERT]
    I -->|No| K[完了]
    J --> K
```

## ルーム管理

チャットルームの作成と取得の流れ。

```mermaid
flowchart TB
    A[ルーム要求] --> B{find_or_create}
    B --> C{既存ルーム検索}
    C -->|hearing| D[未完了のhearingルーム検索]
    C -->|validation/topic| E[任意のルーム検索]

    D --> F{見つかった?}
    E --> F

    F -->|Yes| G[既存ルーム返却]
    F -->|No| H[新規ルーム作成]

    H --> I[Room INSERT]
    I --> G
```

## エンドポイント対応表

| エンドポイント | 処理内容 | 使用エージェント |
|--------------|---------|----------------|
| `POST /api/hearing` | ヒアリング対話 | hearing-agent |
| `POST /api/validation` | 検証対話 | validation-agent |
| `POST /api/topic` | トピック議論 | topic-agent |
| `POST /api/chat` | 構造化審査/QA（開発中） | flow-agent / qa-agent |
| `POST /api/suggestions` | 提案生成 | - |
| `GET /api/health` | ヘルスチェック | - |

## 開発中の機能

以下の機能は現在開発中で、ai-server単体（`ai-server/app/page.tsx`）からのみ利用可能です。Core側との統合は今後対応予定。

### Flow Chat (構造化審査)

flow.jsonに基づく構造化された審査フロー。

- エンドポイント: `POST /api/chat` (mode=flow)
- 使用エージェント: flow-agent
- 機能: チェック項目を順に確認し、send_suggestionsツールで選択肢を提示

### QA (フロー質問応答)

審査フローに関する質問応答。

- エンドポイント: `POST /api/chat` (mode=qa)
- 使用エージェント: qa-agent
- 機能: flow.jsonの内容を参照して回答
