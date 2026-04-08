# ソクラテス式ヒアリング アーキテクチャ設計書

## 1. 概要

### 1.1 目的

ヒアリングチャットにおいて、**熟練者の暗黙知を構造的に抽出する**ためのアーキテクチャ。
「LLM は構造化データを出力、コードがフローを制御」という原則に基づき、ヒアリングの進行管理をプログラム側で行う。

### 1.2 旧アーキテクチャの問題

以前の実装では「レイヤー構造」分類を LLM ツール呼び出しに全面依存していた：

| 問題 | 詳細 |
|------|------|
| LLM に判断を丸投げ | 分類・充足度・フィルタリング全てが LLM ツール。不安定・高コスト |
| ステートマシン不在 | ヒアリングの進行制御がなく、LLM が自由に動く |
| プロンプト肥大化 | レイヤー説明だけで 70 行以上追加 |
| バイアス検出なし | ユーザーの認知バイアスを検出する仕組みがない |

### 1.3 新アーキテクチャの設計思想

```
┌──────────────────────────────────────────────────────┐
│  ユーザーメッセージ                                     │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────┐    ┌─────────────────────┐
│  Stage 1: バイアス検出     │───▶│  bias_flags テーブル  │
│  (正規表現パターンマッチ)    │    │  status: pending     │
│  コスト: 0, 遅延: ~1ms    │    └─────────────────────┘
└──────────────┬───────────┘
               │
               ▼
┌──────────────────────────┐    ┌─────────────────────────┐
│  PBM ステップ状態取得       │◀──│  hearing_step_states    │
│  (DB から現在のステップ)     │    │  current_step: 0/1/2   │
└──────────────┬───────────┘    └─────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  プロンプト注入                                        │
│  - PBM ステップコンテキスト (ステップごとの指示)          │
│  - バイアスアラート (pending フラグから生成)              │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  LLM (OpenAI) レスポンス生成                           │
│  末尾に <!--HEARING_META {...} --> ブロックを出力       │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  TransformStream                                      │
│  1. HEARING_META を抽出・パース                        │
│  2. META 除去済みテキストをクライアントに送信             │
│  3. hearing_extracts に知識を保存                      │
│  4. ステップ遷移を判定・実行                            │
└──────────────────────────────────────────────────────┘
```

---

## 2. PBM ステートマシン

### 2.1 3 つのステップ

| Step | 名前 | 目的 | 完了条件 |
|------|------|------|---------|
| 0 | Hard NG 排除 | 致命的な問題の有無を確認 | LLM が `no_dealbreakers: true` を返す |
| 1 | 前提確認 | 判断の前提条件を検証 | 3 つ以上の前提が確認される (`premises_confirmed.length >= 3`) |
| 2 | 定量・定性評価 | データに基づく深掘り | カバレッジスコアが 0.8 以上 (`coverage_score >= 0.8`) |

### 2.2 ステップ遷移のルール

- ステップの進行は**プログラム側で制御**される。LLM はステップを進めることができない
- LLM は `HEARING_META.step_signals` で状態を報告するだけ
- `evaluateStepTransition()` が完了条件を判定し、DB を更新する
- ステップは前進のみ (0 → 1 → 2)。後退はない

### 2.3 関連ファイル

| ファイル | 役割 |
|---------|------|
| `ai-server/lib/services/pbm-state-machine.ts` | ステップ状態管理・遷移判定・プロンプト生成 |
| `core/app/models/hearing_step_state.rb` | Rails モデル |
| `core/db/migrate/20260123000001_add_hearing_layers.rb` | DB スキーマ |

### 2.4 主要関数

```
getOrCreateStepState(requestId)
  → DB から現在のステップ状態を取得。なければ Step 0 で初期化

getStepContext(state)
  → 現在のステップに応じたプロンプトテキストを生成

evaluateStepTransition(requestId, state, signals)
  → step_signals に基づいてステップ遷移を判定・実行

saveExtracts(requestId, messageId, step, extracts)
  → 抽出された知識を hearing_extracts テーブルに保存

parseAndStripMeta(fullText)
  → レスポンスから <!--HEARING_META {...} --> を抽出・除去
```

---

## 3. 2 段階バイアス検出

### 3.1 Stage 1: パターンマッチング

**コスト: 0、遅延: ~1ms**

ユーザーメッセージに対して正規表現でバイアスパターンを検出する。
検出されたら `bias_flags` テーブルに `pending` 状態で保存。

| バイアス種別 | パターン例 | 説明 |
|-------------|-----------|------|
| `optimistic_assertion` | だと思う、大丈夫、問題ない | 楽観的な断定 |
| `confirmation_bias` | 前回も、いつも、毎回 | 確証バイアス |
| `sunk_cost` | ここまでやったから、せっかく | 埋没コストへの固執 |
| `groupthink` | みんなも、普通は、常識 | 集団思考・同調圧力 |
| `overconfidence` | 絶対、間違いない、確実 | 過度な確信 |
| `vague_reasoning` | なんとなく、感覚的に、肌感覚 | 曖昧な根拠 |

### 3.2 Stage 2: LLM コンテキスト注入

Stage 1 でフラグが立った場合**のみ**、次回の LLM 呼び出し時にプロンプトへアラートを注入する。

```
## バイアス検出アラート
以下のバイアスの可能性が検出されました。自然な会話の中で、
適切なタイミングで確認の質問を挿入してください。
即座に問い詰めるのではなく、話題の区切りで自然に問いかけてください。

- 「前回もうまくいった」→ 確証バイアスの可能性。前回と今回の条件の違いを確認
```

LLM が補正質問を行ったら `HEARING_META.step_signals.bias_addressed: true` を返し、
プログラム側が `bias_flags.status` を `injected` に更新する。

### 3.3 関連ファイル

| ファイル | 役割 |
|---------|------|
| `ai-server/lib/services/bias-detector.ts` | パターン定義・検出・アラート生成 |
| `core/app/models/bias_flag.rb` | Rails モデル |

---

## 4. HEARING_META 構造化出力

### 4.1 フォーマット

LLM はレスポンスの末尾に以下の HTML コメント形式で構造化データを出力する：

```
<!--HEARING_META
{
  "step": 0,
  "extracts": [
    {
      "layer": 3,
      "content": "IRR 15%以上を基準としている",
      "hypothesis": "ROE基準と連動している可能性"
    }
  ],
  "step_signals": {
    "no_dealbreakers": true,
    "premises_confirmed": ["リスク許容度", "投資期間"],
    "coverage_score": 0.6,
    "bias_addressed": true
  }
}
-->
```

### 4.2 知識レイヤー (extracts.layer)

| Layer | 名前 | 説明 |
|-------|------|------|
| 0 | 原則 | ほぼ不変の原則 |
| 1 | 判断基準 | 会社全体の判断基準 |
| 2 | リスク構造 | リスク分解構造 |
| 3 | 案件事実 | 案件の事実情報 |
| 4 | 判断プロセス | 推論プロセスと暗黙の前提 |

### 4.3 ステップシグナル (step_signals)

| フィールド | 型 | 使用ステップ | 説明 |
|-----------|------|------------|------|
| `no_dealbreakers` | boolean | Step 0 | 致命的問題なしの判定 |
| `dealbreaker_found` | string | Step 0 | 致命的問題が見つかった場合の説明 |
| `premises_confirmed` | string[] | Step 1 | 確認された前提のリスト |
| `coverage_score` | number | Step 2 | 仮説カバレッジスコア (0.0-1.0) |
| `bias_addressed` | boolean | 全ステップ | バイアスアラートに対応したか |

### 4.4 除去のタイミング

1. **サーバー側 (TransformStream の flush)**: ストリーミング完了後にパース・除去
2. **クライアント側 (安全策)**: `stripHearingMeta()` でストリーミング中に表示される可能性を除去

---

## 5. データベーススキーマ

### 5.1 新規テーブル

#### hearing_step_states
PBM ステートマシンの状態を保持。リクエストごとに 1 レコード。

| カラム | 型 | 説明 |
|-------|------|------|
| id | string(26) | ULID |
| request_id | string(26) | FK: requests |
| current_step | integer | 0, 1, 2 |
| current_step_status | string | active / completed |
| step_completion | jsonb | ステップごとの完了情報 |
| extracted_knowledge | jsonb | ステップごとの抽出済み知識 |

#### hearing_extracts
LLM が抽出した知識を蓄積。

| カラム | 型 | 説明 |
|-------|------|------|
| id | string(26) | ULID |
| request_id | string(26) | FK: requests |
| source_message_id | string(26) | FK: messages (nullable) |
| pbm_step | integer | 抽出時の PBM ステップ |
| knowledge_layer | integer | 知識レイヤー (0-4) |
| content | text | 抽出された知識 |
| hypothesis | text | 生成された仮説 (nullable) |
| data_type | string | Phase 2 用 (未使用) |
| medallion | string | Phase 2 用 (デフォルト: bronze) |

#### bias_flags
バイアス検出結果を保持。

| カラム | 型 | 説明 |
|-------|------|------|
| id | string(26) | ULID |
| request_id | string(26) | FK: requests |
| source_message_id | string(26) | FK: messages (nullable) |
| bias_type | string | バイアス種別 |
| detection_stage | string | pattern_match / llm_contextual |
| original_text | text | 検出元テキスト |
| correction_question | text | 補正質問 (nullable) |
| status | string | pending / injected / dismissed |
| pbm_step | integer | 検出時の PBM ステップ |

### 5.2 既存テーブルの変更

#### messages テーブル
- `pbm_step` (integer): このメッセージ時点の PBM ステップ
- `meta_json` (jsonb): LLM が出力した HEARING_META

---

## 6. リクエスト処理フロー

### 6.1 hearing/route.ts の処理順序

```
1. ユーザーメッセージ受信
2. requestData を DB から取得
3. PBM ステップ状態を取得 (getOrCreateStepState)
4. ステップコンテキストを生成 (getStepContext)
5. バイアスパターン検出 - Stage 1 (detectBiasPatterns)
6. ユーザーメッセージを DB に保存
7. バイアスフラグがあれば DB に保存 (saveBiasFlags)
8. pending バイアスからアラートテキスト生成 (getBiasAlerts)
9. RequestContext にステップコンテキスト・バイアスアラートを設定
10. LLM ストリーミング開始 (handleChatStream)
11. TransformStream で全テキストを蓄積
12. ストリーミング完了時 (flush):
    a. HEARING_META をパース・除去 (parseAndStripMeta)
    b. アシスタントメッセージを DB に保存 (META 除去済み)
    c. 抽出知識を hearing_extracts に保存 (saveExtracts)
    d. ステップ遷移を判定 (evaluateStepTransition)
    e. バイアス対応済みなら bias_flags を injected に更新
```

### 6.2 エージェント構成

```
hearingAgent
├── instructions: 動的生成 (requestContext から pbmStepContext, biasAlerts を取得)
├── model: OpenAI (configurable)
├── memory: Mastra Memory (thread per room)
└── tools:
    └── send_suggestions: 回答候補をクライアントに表示
```

---

## 7. Phase 2 以降の拡張ポイント

現在のスキーマには Phase 2 用のカラムが準備されている（未使用）：

| カラム | テーブル | Phase 2 での用途 |
|-------|---------|----------------|
| `data_type` | hearing_extracts | immutable/stable/variable/historical に分類 |
| `medallion` | hearing_extracts | bronze → silver → gold のデータ品質昇格 |

Phase 3 ではリスク分解レイヤー (knowledge_layer) のカスタマイズ機能を追加予定。

---

## 8. 削除したもの

以下のファイル・機能は旧「レイヤー構造」実装として削除された：

| ファイル / 機能 | 理由 |
|---------------|------|
| `layer-classification-tool.ts` | LLM ツールによる分類 → HEARING_META に統合 |
| `layer-completeness-tool.ts` | LLM ツールによる充足度判定 → PBM ステートマシンに統合 |
| `socratic-filtering-tool.ts` | LLM ツールによるフィルタリング → バイアス検出に統合 |
| `hearing-layer-panel.tsx` | レイヤー表示 UI → 不要 |
| `HearingLayersController` | レイヤー API → 不要 |
| `HearingLayerContent` / `HearingLayerStatus` | Rails モデル → hearing_extracts に統合 |
| `enable_layer_structure` | トグル機能 → PBM は常時有効 |
| `layer_classifications` / `is_socratic_filtering` (messages) | → pbm_step / meta_json に置換 |
