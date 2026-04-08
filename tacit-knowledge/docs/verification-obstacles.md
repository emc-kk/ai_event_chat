# 動作確認 障害マップ

## 概要

各フローごとに、動作確認を阻む要因を図示する。

凡例: `🔴` = ブロッカー、`🟡` = 手間がかかる、`🟢` = 確認可能

---

## フロー1: ヒアリングチャット（初回質問が来ない問題含む）

```mermaid
graph LR
    subgraph "React Frontend"
        A["chat-room.tsx\n初回: __INITIAL_MESSAGE__ 送信"]
    end

    subgraph "Rails API"
        B["messages_controller\nrooms_controller"]
    end

    subgraph "AI Server"
        C["POST /api/hearing\nSSE streaming"]
        D["hearing-agent.ts\nMastra SDK"]
        E["RAG retriever\npgvector"]
    end

    subgraph "外部API"
        F["OpenAI gpt-5-mini"]
        G["Cohere reranker"]
    end

    A -->|"__INITIAL_MESSAGE__"| B
    B -->|Proxy| C
    C --> D
    D --> E
    D --> F
    E --> G

    style A fill:#fee,stroke:#c00
    style C fill:#fee,stroke:#c00
    style D fill:#fee,stroke:#c00
    style E fill:#fee,stroke:#c00
    style F fill:#ffd,stroke:#aa0
    style G fill:#ffd,stroke:#aa0
    style B fill:#efe,stroke:#0a0
```

### 初回質問が飛んでこない問題の原因候補

フロントエンドが `__INITIAL_MESSAGE__` を送信 → AI Serverが受け取り → hearing-agentが初回応答を生成、という流れ。
以下のどこかで止まっている可能性がある。

```mermaid
graph TD
    Q{"初回質問が来ない"}
    Q --> Q1["1. __INITIAL_MESSAGE__\nが送信されていない"]
    Q --> Q2["2. AI Serverに\nリクエストが届いていない"]
    Q --> Q3["3. AI Serverが\nエラーを返している"]
    Q --> Q4["4. SSEストリームが\n途中で切れている"]

    Q1 --> R1["chat-room.tsx L254-267\ninitialMessages.length===0\nの条件を確認"]
    Q2 --> R2["Railsのproxy設定\nai_server_client.rb\nのURLとタイムアウトを確認"]
    Q3 --> R3["AI Serverのログを確認\nOpenAI APIキー有無\nMastra初期化エラー"]
    Q4 --> R4["ブラウザDevToolsで\nネットワーク確認\nSSE接続状態"]

    style Q fill:#fee,stroke:#c00
    style Q1 fill:#ffd,stroke:#aa0
    style Q2 fill:#ffd,stroke:#aa0
    style Q3 fill:#ffd,stroke:#aa0
    style Q4 fill:#ffd,stroke:#aa0
```

### 障害ポイント

| # | 箇所 | 問題 | 影響 |
|---|------|------|------|
| 1 | AI Server全体 | **テストファイル 0件** | Agent・RAG・SSEが一切テストされていない |
| 2 | hearing-agent.ts | **OpenAI APIモック不在** | 実APIキーがないと動作確認不可 |
| 3 | RAG pgvector | **テストデータ/Seed不在** | ベクトルDBが空だとRAG検索が空振り |
| 4 | SSE streaming | **E2Eテスト不在** | フロント→Rails→AI Serverの結合が未検証 |
| 5 | React components | **Systemテスト空** | chat-app/chat-roomのUIテストなし |

---

## フロー2: トピックチャット（ヒアリング完了が前提条件）

```mermaid
graph TD
    subgraph "前提条件チェーン 🔴"
        P1["1. ヒアリング実施\n初回質問が来る必要あり"]
        P2["2. ヒアリング完了\nfinish_hearing API"]
        P3["3. Worker処理完了\nQA生成・Plan生成"]
        P4["4. Request status = completed"]
        P5["5. Topic status = completed\n全Requestがcompleted"]
        P6["6. ComparisonSession完了\nある場合のみ"]
        P7["7. topic.chat_accessible? = true\nやっとトピックチャット可能"]
    end

    P1 --> P2 --> P3 --> P4 --> P5 --> P6 --> P7

    subgraph "トピックチャット本体"
        T1["chat-room.tsx"] --> T2["api topic SSE"]
        T2 --> T3["topic-agent.ts"]
        T3 --> T4["RAG + qa-query-tool"]
        T3 --> T5["OpenAI"]
    end

    P7 --> T1

    style P1 fill:#fee,stroke:#c00
    style P2 fill:#ffd,stroke:#aa0
    style P3 fill:#fee,stroke:#c00
    style P5 fill:#ffd,stroke:#aa0
    style T3 fill:#fee,stroke:#c00
    style T4 fill:#fee,stroke:#c00
    style T5 fill:#ffd,stroke:#aa0
```

### 障害ポイント

| # | 箇所 | 問題 |
|---|------|------|
| 6 | 前提条件チェーン | **ヒアリング→完了→Worker処理→ステータス更新を全て通過しないとトピックチャットに到達不可** |
| 7 | chat_accessible? | Topic.completed? かつ 全ComparisonSession.completed? が必要 |
| 8 | qa-query-tool | QAデータがDBに入っていないとツール呼び出しが空振り |
| 9 | ショートカット不在 | **ステータスを直接completedにするSeedやRakeタスクがない** |

---

## フロー3: 権限別の動作確認

```mermaid
graph TD
    subgraph "ユーザーロール 3種"
        U1["general\n権限なしデフォルト"]
        U2["veteran\n熟練者"]
        U3["company_admin\n会社管理者"]
    end

    subgraph "管理者 2種"
        A1["privileged_admin\ncompany_id=nil 全権限"]
        A2["company_admin\n会社スコープ管理者"]
    end

    subgraph "リソース権限 3段階"
        P1["viewer 0"]
        P2["editor 1"]
        P3["owner 2"]
    end

    subgraph "権限対象 4リソース"
        R1["TopicFolder"]
        R2["Topic"]
        R3["DataSourceFolder"]
        R4["DataSourceFile"]
    end

    U1 & U2 & U3 --- P1 & P2 & P3
    P1 & P2 & P3 --- R1 & R2 & R3 & R4

    style U1 fill:#fee,stroke:#c00
    style U2 fill:#fee,stroke:#c00
    style U3 fill:#ffd,stroke:#aa0
```

### 障害ポイント

| # | 箇所 | 問題 |
|---|------|------|
| 10 | Seedデータ | **db/seeds.rbが空** → 各ロールのユーザーを毎回手動作成 |
| 11 | ロール切替 | **ロール切替機能なし** → 確認のたびにログアウト→別ユーザーでログイン |
| 12 | 権限組合せ | 3ロール x 3権限段階 x 4リソース = **36パターン** を手動確認 |
| 13 | Fixture存在するが | テスト用のみ（users.yml）、**開発環境のSeedには含まれていない** |

---

## フロー4: ファイルアップロード & AI読み込み

```mermaid
graph LR
    subgraph "アップロード"
        U["ユーザー\nファイル選択"]
        C1["data_source_files_controller\n許可: pdf xlsx xls docx\ndoc pptx ppt csv txt"]
    end

    subgraph "Worker処理"
        W1["document_parse.py\nLlamaIndex + Vision API"]
        W2["document_index.py\nEmbedding生成"]
    end

    subgraph "保存先"
        S3["S3 LocalStack"]
        PG["pgvector embeddings"]
    end

    U --> C1 --> S3
    S3 --> W1 --> W2 --> PG

    style U fill:#fee,stroke:#c00
    style W1 fill:#fee,stroke:#c00
    style W2 fill:#fee,stroke:#c00
    style S3 fill:#ffd,stroke:#aa0
```

### 障害ポイント

| # | 箇所 | 問題 |
|---|------|------|
| 14 | サンプルファイル | **テスト用アップロードファイルが一切ない**（test/fixtures/files/ は空） |
| 15 | 確認手順 | 毎回「適当なPDFやDocxを探す→アップロード→Worker処理待ち→確認」が必要 |
| 16 | Worker処理 | SQS + S3 + OpenAI Embeddings全てが動いている必要あり |
| 17 | 処理結果確認 | パース・インデックス結果を確認するUIが限定的 |

---

## フロー5: AI生成（Worker）

```mermaid
graph LR
    subgraph "Rails"
        A3["finish_hearing controller"]
        B3["SqsMessageService"]
    end
    subgraph "LocalStack"
        C3["SQS Queue"]
    end
    subgraph "Worker Python"
        D3["workflows index.py"]
        E3["plan_generation.py"]
        F3["qa_generation.py"]
        G3["manual_generation.py"]
    end
    subgraph "外部"
        H3["OpenAI gpt-5-mini"]
        I3["S3 Storage"]
    end

    A3 --> B3 --> C3 --> D3
    D3 --> E3 & F3 & G3
    E3 & F3 & G3 --> H3
    E3 & F3 & G3 --> I3

    style D3 fill:#fee,stroke:#c00
    style E3 fill:#fee,stroke:#c00
    style F3 fill:#fee,stroke:#c00
    style G3 fill:#fee,stroke:#c00
    style H3 fill:#ffd,stroke:#aa0
    style C3 fill:#ffd,stroke:#aa0
```

### 障害ポイント

| # | 箇所 | 問題 |
|---|------|------|
| 18 | Worker全体 | **テストファイル 0件、pytest未設定** |
| 19 | generation系 | **LLMモック不在** → 毎回実API呼び出し必須 |
| 20 | SQS/S3 | LocalStack依存 → Docker起動必須 |

---

## 全体サマリ: 何がどれだけブロックしているか

```mermaid
graph TD
    subgraph "即座にブロック 🔴"
        B1["AI Server テスト0件\nモック0件"]
        B2["Worker テスト0件\npytest未設定"]
        B3["Seedデータ空\n開発用ユーザーなし"]
        B4["サンプルファイル0件\nアップロード確認不可"]
        B5["トピックチャットに\n到達するまで7ステップ"]
    end

    subgraph "手間がかかる 🟡"
        Y1["権限確認36パターン\n手動ログイン切替"]
        Y2["外部API依存\nOpenAI Cohere"]
        Y3["Docker全サービス\n起動が前提"]
    end

    subgraph "存在するが不十分 🟢"
        G1["Rails Fixture 6件\nテスト用のみ"]
        G2["Rails テスト8件\n大半スケルトン"]
    end

    style B1 fill:#fee,stroke:#c00
    style B2 fill:#fee,stroke:#c00
    style B3 fill:#fee,stroke:#c00
    style B4 fill:#fee,stroke:#c00
    style B5 fill:#fee,stroke:#c00
    style Y1 fill:#ffd,stroke:#aa0
    style Y2 fill:#ffd,stroke:#aa0
    style Y3 fill:#ffd,stroke:#aa0
    style G1 fill:#efe,stroke:#0a0
    style G2 fill:#efe,stroke:#0a0
```

---

## 優先度付き改善案

| 優先度 | 対象 | 施策 | 効果 |
|--------|------|------|------|
| **P0** | Seed | 開発用Seedデータ作成（各ロールユーザー + Topic + Request + Room + Message） | ログイン後すぐに各画面を確認可能に |
| **P0** | サンプルファイル | test/fixtures/files/ にPDF・DOCX・CSVサンプルを配置 | ファイルアップロード確認を即座に実施可能に |
| **P0** | トピックチャット | Rakeタスク `rake dev:setup_completed_topic` で完了済みTopicを作成 | ヒアリング全工程をスキップしてトピックチャットを確認可能に |
| **P1** | 権限確認 | Rakeタスク `rake dev:switch_role[user_id,role]` またはAdmin UIにロール切替ボタン | ログアウト不要で権限別確認が可能に |
| **P1** | AI Server | OpenAI/Cohereモック作成 + Agent単体テスト | APIキーなしでチャット確認可能に |
| **P1** | ヒアリング初回 | AI Serverの `__INITIAL_MESSAGE__` 処理のデバッグ・修正 | ヒアリングチャットが開始可能に |
| **P2** | Worker | pytest導入 + LLMモック | AI生成の単体確認 |
| **P2** | E2E | Playwright導入 | フロント結合の自動検証 |
| **P3** | CI | AI Server/Workerテストをパイプライン追加 | リグレッション防止 |
