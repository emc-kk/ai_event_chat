# 社内辞書（Company Glossary）実装仕様書

## 概要

社内辞書は、AIが社内固有の用語を正しく理解して回答するための用語定義データ。人間の参照用ではなく、**AIの回答精度向上が主目的**。

- **スコープ:** 会社全体で共有（トピック横断）
- **内容:** 用語 → 定義のシンプルな辞書
- **権限:** admin/company_admin、または会社内でeditor以上の権限を持つユーザーが編集可能
- **UI:** サイドナビに独立メニュー

---

## データベーススキーマ

### company_glossary_terms テーブル

| カラム | 型 | 制約 | 説明 |
|-------|---|-----|------|
| id | string(26) | PK, ULID | 用語ID |
| company_id | string(26) | NOT NULL, FK→companies (CASCADE) | 所属会社 |
| term | string | NOT NULL | 用語（例：KPI報告書） |
| definition | text | NOT NULL | 定義 |
| created_by_id | string(26) | NOT NULL | 作成者ID |
| created_by_type | string | NOT NULL | 作成者タイプ（Admin/User） |
| updated_by_id | string(26) | | 更新者ID |
| updated_by_type | string | | 更新者タイプ |
| created_at | datetime | NOT NULL | |
| updated_at | datetime | NOT NULL | |

**インデックス:**
- `idx_glossary_company_term_unique` (company_id, term) UNIQUE
- `idx_glossary_company` (company_id)
- `idx_glossary_created_by` (created_by_type, created_by_id)

**マイグレーション:** `core/db/migrate/20260224100001_create_company_glossary_terms.rb`

---

## APIエンドポイント

| メソッド | パス | 説明 | 権限 |
|---------|------|------|------|
| GET | /api/glossary_terms | 用語一覧 | ログイン済み |
| POST | /api/glossary_terms | 用語作成 | editor以上 |
| PATCH | /api/glossary_terms/:id | 用語更新 | editor以上 |
| DELETE | /api/glossary_terms/:id | 用語削除 | editor以上 |
| GET | /api/glossary_terms/match?q=xxx | 用語マッチ（AI用） | ログイン済み |

### レスポンス形式

**一覧・作成・更新:**
```json
{
  "id": "01JXXX...",
  "term": "KPI報告書",
  "definition": "毎月末に提出する重要業績評価指標の報告書",
  "created_by_type": "Admin",
  "created_at": "2026-02-24T10:00:00Z",
  "updated_at": "2026-02-24T10:00:00Z"
}
```

**マッチ（AI用）:**
```json
[
  { "term": "KPI報告書", "definition": "毎月末に提出する..." }
]
```

---

## 権限チェック

### 判定ロジック（`user_can_edit_glossary?`）

```
ユーザーの辞書編集リクエスト
  │
  ├─ Admin（特権管理者・企業管理者）?
  │   → 常に許可
  │
  ├─ User（role=company_admin）?
  │   → 常に許可
  │
  └─ 一般User?
      │
      └─ Permission テーブルを検索
          WHERE company_id = current_company_id
          AND role IN (editor, owner)
          AND (
            (grantee_type = 'User' AND grantee_id = user.id)
            OR
            (grantee_type = 'UserGroup' AND grantee_id IN user.user_group_ids)
          )
          → EXISTS → 許可
          → NOT EXISTS → 拒否（閲覧のみ）
```

**ポイント:** 社内辞書はリソースベースの権限（Permissible concern）ではなく、会社内のどこかでeditor以上の権限を持っているかどうかで判定する。DS/トピックのように個別リソースに対する権限チェーンは不要。

### ロール別アクセス権限マトリクス

| 操作 | 特権管理者 | 企業管理者 | editor権限User | viewer権限User | 権限なしUser |
|------|-----------|-----------|---------------|---------------|------------|
| 用語一覧閲覧 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 用語作成 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 用語更新 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 用語削除 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 用語マッチ（AI用） | ✅ | ✅ | ✅ | ✅ | ✅ |
| サイドナビ表示 | ✅ | ✅ | ✅ | ❌ | ❌ |

---

## モデル詳細

### CompanyGlossaryTerm (`core/app/models/company_glossary_term.rb`)

- **PK生成:** UlidPk concern（ULID自動生成）
- **Association:** `belongs_to :company`, polymorphic `created_by` / `updated_by`
- **バリデーション:**
  - `term`: 必須、最大255文字、(company_id, term) ユニーク
  - `definition`: 必須
- **スコープ:**
  - `for_company(company_id)` — 会社で絞り込み
  - `ordered` — 用語名のアルファベット順
- **メソッド:**
  - `match_terms(company_id, text)` — テキスト内に含まれる用語を完全一致検索

### match_terms のロジック

```ruby
def self.match_terms(company_id, text)
  return [] if company_id.blank? || text.blank?
  # 1. 会社の全用語名を取得（BINARY→UTF-8エンコーディング修正付き）
  terms = for_company(company_id).pluck(:term).map { |t| t.force_encoding("UTF-8") }
  # 2. テキストに含まれる用語をフィルタ
  matched = terms.select { |t| text.force_encoding("UTF-8").include?(t) }
  return [] if matched.empty?
  # 3. マッチした用語のレコードを返す
  for_company(company_id).where(term: matched).ordered
end
```

**エンコーディング修正（PR #106）:** Docker環境のRuby 3.4 + PostgreSQLでは `pluck(:term)` がBINARY（ASCII-8BIT）エンコーディングの文字列を返す場合があり、UTF-8テキストとの比較で `Encoding::CompatibilityError` が発生する。`force_encoding("UTF-8")` で明示的に変換することで解決。

---

## コントローラー詳細

### Api::GlossaryTermsController (`core/app/controllers/api/glossary_terms_controller.rb`)

- **before_action:**
  - `set_glossary_term` — update/destroyで対象用語を取得
  - `require_editor` — create/update/destroyで`user_can_edit_glossary?`チェック
- **company_idスコープ:** 全アクションで `current_company_id` に絞り込み
- **polymorphic created_by/updated_by:** `current_user_type` ヘルパーで Admin/User を判定

### GlossaryTermsController (`core/app/controllers/glossary_terms_controller.rb`)

- **アクション:** indexのみ（ページ描画用）
- Reactコンポーネントのマウントポイントを返す

---

## フロントエンド構成

### Reactコンポーネントツリー

```
GlossaryApp (glossary-app.tsx) — 社内辞書メインコンテナ
├── 検索バー（クライアントサイドフィルタ）
├── 用語テーブル（term, definition, 操作ボタン）
└── GlossaryForm (glossary-form.tsx) — 追加/編集フォーム（カード形式）
```

### ERB→React データ属性

| 属性 | 型 | 説明 |
|------|-----|------|
| data-mounted | "true"/"false" | マウント状態管理 |
| data-can-edit | "true"/"false" | 編集権限（`user_can_edit_glossary?`） |

### APIクライアント (glossary-api-client.ts)

| メソッド | 説明 |
|---------|------|
| getGlossaryTerms() | 用語一覧取得 |
| createGlossaryTerm(term, definition) | 用語作成 |
| updateGlossaryTerm(id, term, definition) | 用語更新 |
| deleteGlossaryTerm(id) | 用語削除 |

---

## サイドナビ

データソース管理の下、ログアウトの上に「社内辞書」メニューを表示。

```
├── [Admin+CompanyAdmin] データソース管理
├── [editor以上] 社内辞書          ← 新規追加
└── ログアウト
```

表示条件: `user_can_edit_glossary?`（admin/company_admin、またはPermissionでeditor以上）

---

## AI注入フロー（将来実装）

```
ユーザーのクエリ
  ↓ クエリテキストに対して社内辞書を完全一致検索
    GET /api/glossary_terms/match?q={query_text}
  ↓ ヒットした用語・定義をシステムプロンプトに注入
    例: "以下の社内用語を理解した上で回答してください：
         - KPI報告書: 毎月末に提出する重要業績評価指標の報告書
         - ..."
  ↓ RAG検索 + LLM回答（用語の定義を踏まえた回答）
```

**適用対象（将来）:** 全てのAIチャット（ナレッジ検索、暗黙知チャットボット、マニュアル作成）

**実装予定箇所:**
- `ai-server/lib/services/database-service.ts` — `getGlossaryTerms(companyId, query)` 追加
- `ai-server/app/api/topic/route.ts` — RequestContextに辞書を追加
- `ai-server/lib/prompts/prompts.yml` — `{glossary_terms}` プレースホルダー追加

---

## 検証結果

### ローカル検証（localhost:3000）
| テスト項目 | 結果 |
|---|---|
| Create（用語追加） | OK |
| Read（一覧表示） | OK |
| Update（定義更新） | OK |
| Delete（用語削除） | OK |
| match API（マッチあり） | OK |
| match API（マッチなし → 空配列） | OK |
| match API（空テキスト → 空配列） | OK |
| match API（別会社 → 空配列） | OK |
| サイドナビ表示（企業管理者） | OK |

### 本番検証（skillrelay.ai）
| テスト項目 | 結果 |
|---|---|
| サイドナビ非表示（特権管理者、company_id=nil） | OK |
| サイドナビ表示（企業管理者、テスト会社） | OK |
| Create（用語追加） | OK |
| Read（一覧表示） | OK |
| Update（定義更新） | OK |
| Delete（用語削除） | OK |
| match API（マッチあり） | OK（エンコーディングエラーなし） |
| match API（マッチなし → 空配列） | OK |

---

## バグ修正履歴

| # | 問題 | 修正 | PR |
|---|------|------|-----|
| G1 | `match_terms` で `Encoding::CompatibilityError`（BINARY vs UTF-8） | `force_encoding("UTF-8")` を pluck 結果とテキストに適用 | #106 |
| G2 | 特権管理者で社内辞書ページにアクセスするとエラー | `require_company_context` before_action 追加、サイドバー条件に `current_company_id.present?` 追加 | #105 |
| G3 | `schema.rb` に `company_glossary_terms` テーブル定義が欠落 | マイグレーション後に `schema.rb` を再生成・コミット | #104 |
| G4 | ds-acl ブランチで `schema.rb` の外部キー制約が重複 | merge時に発生した重複 `add_foreign_key` 行を削除 | ds-acl直接コミット |

---

## 削除ライフサイクル

| イベント | 処理 |
|---------|------|
| 用語削除 | レコード削除のみ（ハードデリート）。次回のAI呼び出しから反映されなくなる |
| 会社削除 | FK ON DELETE CASCADE で全用語自動削除 |

---

## ファイル一覧

| カテゴリ | ファイルパス |
|---------|------------|
| マイグレーション | `core/db/migrate/20260224100001_create_company_glossary_terms.rb` |
| モデル | `core/app/models/company_glossary_term.rb` |
| APIコントローラ | `core/app/controllers/api/glossary_terms_controller.rb` |
| ページコントローラ | `core/app/controllers/glossary_terms_controller.rb` |
| ヘルパー | `core/app/helpers/sessions_helper.rb` (`user_can_edit_glossary?`) |
| ビュー | `core/app/views/glossary_terms/index.html.erb` |
| サイドナビ | `core/app/views/components/_sidebar.html.erb` |
| Reactマウント | `core/app/javascript/react-app.tsx` (`mountGlossaryApp`) |
| Reactコンポーネント | `core/app/javascript/src/components/glossary/glossary-app.tsx` |
| Reactコンポーネント | `core/app/javascript/src/components/glossary/glossary-form.tsx` |
| APIクライアント | `core/app/javascript/src/lib/glossary-api-client.ts` |
| ルーティング | `core/config/routes.rb` |
| ロケール | `core/config/locales/ja.yml` |
