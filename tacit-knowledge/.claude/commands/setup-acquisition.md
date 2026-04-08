# データ取得ジョブセットアップウィザード

このスキルは対話形式で新しい企業のデータ取得ジョブを設定します。
質問に答えるだけでYAML定義・シードスクリプト・ダッシュボードが自動生成されます。

---

## 実行手順

以下のフェーズを順番に実行してください。各フェーズで `AskUserQuestion` を使って対話的にユーザーから情報を収集してください。

### Phase 1: 企業情報

`AskUserQuestion` で以下を聞いてください:

1. **企業名** (日本語): 例「富士電機株式会社」
2. **ディレクトリ名** (英語ケバブケース): 例「fuji-electric」 — `data_acquisition/jobs/` 配下のフォルダ名になります
3. **企業ID** (ULID形式26文字): 例「01JQFUJIELECTRIC01」 — `companies` テーブルのIDです。未定なら自動生成します
4. **企業の説明**: 例「エネルギー・環境事業のデータ取得対象企業」

### Phase 2: データソース定義 (ジョブ単位で繰り返し)

1つのデータソースごとに以下を聞いてください。複数ソースがある場合は繰り返します:

1. **ジョブ名** (日本語): 例「JEPX スポット市場価格」
2. **説明**: 何のデータを取得するか
3. **データ取得方法** — 選択肢:
   - `web_scrape` — HTMLテーブルをSeleniumでスクレイピング
   - `csv_download` — CSVファイルをダウンロード
   - `pdf_download` — PDFファイルをダウンロード・パース
   - `api` — REST APIからJSON取得
4. **データソースURL**: 取得先のURL
5. **取得頻度** — 選択肢:
   - 日次 (毎日8:00 JST) → cron: `0 23 * * *`
   - 日次2回 (8:00/20:00 JST) → cron: `0 23,11 * * *`
   - 平日のみ (20:00 JST) → cron: `0 11 * * 1-5`
   - 週次 (月曜 8:00 JST) → cron: `0 23 * * 1`
   - 月次 (毎月1日 8:00 JST) → cron: `0 23 1 * *`
   - 四半期 (1,4,7,10月 8:00 JST) → cron: `0 23 1 1,4,7,10 *`
   - カスタム (ユーザーがcronを入力)

6. **取得方法に応じた追加質問**:

   `web_scrape` の場合:
   - Seleniumが必要か？ (JavaScriptで動的にロードされるページ)
   - テーブルのインデックス (0始まり、ページ内の何番目のテーブルか)

   `csv_download` の場合:
   - HTTPメソッド (GET / POST)
   - POST form_data (dir, file等)
   - ファイルエンコーディング (utf-8 / shift_jis)
   - 動的ファイル名? (`{current_fy}` 等のプレースホルダー)

   `pdf_download` の場合:
   - リンク発見方式か直接URLか
   - リンクパターン (正規表現)
   - PDFテーブルのインデックス

7. **抽出カラム定義**: 各カラムについて:
   - `source`: 元データのヘッダー名 (日本語)
   - `name`: DB保存時のカラム名 (英語snake_case)
   - `type`: `text` or `number`

   ユーザーが知らない場合は、URLを確認して推定してください。

8. **もう1つデータソースを追加しますか？** → はい/いいえ

### Phase 3: ダッシュボード設計

各データソースのダッシュボード表示について聞いてください:

1. **ダッシュボードタイトル** (日本語): 例「エネルギー調達ダッシュボード」
2. **サブタイトル**: 例「富士電機 / 電力調達データ定点観測」

3. **各データソースの表示設定**:
   - **表示名** (短縮名): ステータスカードに表示する名前。例「JEPXスポット」
   - **アイコン種別**: `Zap` (電力) / `Leaf` (環境) / `TrendingUp` (トレンド) / `Database` (データ) / `Globe` (海外) / `Building` (企業)
   - **テーマカラー**: indigo / emerald / blue / amber / violet / cyan / lime / purple / rose / orange / teal / pink
   - **優先度**: P0 (メイン) / P1 (重要) / P2 (補助)

4. **各データソースのグラフ設定**:
   - **グラフ種別**:
     - `LineChart` — 時系列の推移 (価格変動、トレンド)
     - `BarChart` — カテゴリ比較 (地域別、商品別)
     - `AreaChart` — 累積/推移 (グラデーション付きトレンド)
     - `ComposedChart` — 棒+線の複合
     - `PieChart` — 構成比
   - **レイアウト**: `full` (横幅100%) / `half` (2カラムの片側)
   - **X軸のデータキー**: どのカラムをX軸にするか
   - **Y軸のデータキー**: どのカラム(複数可)をY軸にするか
   - **Y軸ラベル**: 単位 (例: 円/kWh, MW, トン)

5. **KPIカード** (オプション):
   - 表示したい指標名: 例「直近システムプライス」
   - 取得元のデータソースキーとカラム: 例 `jepx_spot.system_price`
   - 単位: 例「円/kWh」
   - テーマカラー: indigo / amber / emerald 等

6. **アラート条件** (オプション):
   - どのカラムがどの値を超えたら警告するか
   - 例: `system_price > 20` → 「高値警戒」

### Phase 4: ファイル生成

収集した情報を元に以下のファイルを生成してください:

#### 4a. companies.yml 更新

`data_acquisition/jobs/companies.yml` に新しい企業エントリを追加します。
既存エントリは変更しないでください。

```yaml
companies:
  existing-company:
    id: "..."
    # ...
  {new-directory-name}:
    id: "{company-id}"
    name: "{company-name}"
    description: "{description}"
```

#### 4b. ジョブ定義YAML

`data_acquisition/jobs/{directory-name}/` 配下に、データソースのカテゴリごとにYAMLファイルを作成します。

命名規則:
- 関連するジョブをカテゴリでまとめる (例: `energy-market.yml`, `carbon-credit.yml`)
- 1ファイル内に複数ジョブを定義可能

フォーマット (既存の富士電機の例に準拠):
```yaml
# {カテゴリ名のコメント}

jobs:
  - id: {company-slug}-{data-source-slug}
    name: "{ジョブ名}"
    description: "{説明}"
    status: active
    source:
      type: {web_scrape|csv_download|pdf_download|api}
      # 取得方法固有のフィールド...
    extraction:
      # mode, table_index, columns 等...
    schedule:
      cron: "{cron式}"
    retry:
      max_attempts: 3
      backoff_seconds: 60
```

#### 4c. シードスクリプト

`data_acquisition/scripts/seed_{directory_name_underscored}_jobs.py` を作成します。
`seed_fuji_electric_jobs.py` のパターンに準拠してください:

- COMPANY_ID定数
- ジョブ定義をPython dictで定義
- `get_connection()` で DB接続
- `INSERT ... ON CONFLICT DO UPDATE` で冪等にシード
- P0/P1/P2 の優先度グループ分け

#### 4d. ダッシュボードページ

`ai-server/app/demo/{directory-name}/page.tsx` を作成します。
`ai-server/app/demo/fuji-electric/page.tsx` のパターンに準拠:

- `"use client"` 宣言
- SOURCES定数 (key, label, icon, color)
- fetchData関数 (APIフォールバック付き)
- ステータスカード (grid表示)
- KPIカード (オプション)
- グラフコンポーネント (priority順)
- API route: `/api/demo/{directory-name}/data`

#### 4e. グラフコンポーネント

`ai-server/app/demo/{directory-name}/components/` 配下に各グラフのTSXファイルを作成:

- `{source-slug}-chart.tsx`
- Rechartsベース
- 統一スタイル:
  - height: 260px (half) / 320px (full)
  - CartesianGrid: strokeDasharray="3 3", stroke="#f0f0f0"
  - Tooltip: fontSize 11, white bg, 1px border, 8px radius
  - YAxis: fontSize 10, gray-900
  - 色はテーマカラーに合わせたHEX

#### 4f. API Route

`ai-server/app/api/demo/{directory-name}/data/route.ts` を作成:

- GET handler
- `source` クエリパラメータでデータソースを切り替え
- `days` パラメータでデータ範囲指定
- DB接続してdata_acquisition_recordsから取得
- レスポンス: `{ records: [], meta: { count, job_status, last_updated } }`

#### 4g. deploy.yml 更新

`.github/workflows/deploy.yml` のseedスクリプト実行ステップに新しいシードスクリプトを追加:

```yaml
- name: Run Data Acquisition seed scripts
  run: |
    # ...既存のseed実行...
    python scripts/seed_{new_company}_jobs.py
```

### Phase 5: 確認・コミット

生成したファイル一覧を表示し、ユーザーに確認を求めてください:

1. 生成ファイル一覧を表示
2. 「コミットしますか？」と確認
3. コミットする場合:
   - ブランチ名: `feature/datasource-{directory-name}`
   - コミットメッセージ: `feat: {企業名}のデータ取得ジョブ + ダッシュボードを追加`

---

## 参考: 既存パターン

### ディレクトリ構成
```
data_acquisition/jobs/
  companies.yml
  fuji-electric/
    energy-market.yml
    jepx-spot.yml
    carbon-credit.yml
    nonfossil.yml
    inactive.yml

ai-server/app/demo/
  fuji-electric/
    page.tsx
    components/
      jepx-chart.tsx
      nonfossil-chart.tsx
      surcharge-chart.tsx
      forward-chart.tsx
      carbon-credit-chart.tsx
      jcredit-chart.tsx
      electricity-rate-chart.tsx
      balancing-chart.tsx
      csv-download-button.tsx
      insights/
        procurement-cost-insight.tsx
        forward-premium-insight.tsx
        carbon-comparison-insight.tsx
        utility-vs-market-insight.tsx
    compute-market-cost.ts

data_acquisition/scripts/
  seed_fuji_electric_jobs.py
```

### cron式 参考 (UTC → JST変換)
- JST 8:00 = UTC 23:00 → `0 23 * * *`
- JST 20:00 = UTC 11:00 → `0 11 * * *`
- JST 8:00 + 20:00 = `0 23,11 * * *`
- 平日のみ = `* * * * 1-5`

### Rechartsカラーパレット
```
indigo: #6366f1  emerald: #10b981  blue: #3b82f6
amber: #f59e0b  violet: #8b5cf6  cyan: #06b6d4
lime: #84cc16   purple: #a855f7  rose: #f43f5e
orange: #f97316  teal: #14b8a6   pink: #ec4899
```

### テーマカラー → Tailwindクラスマッピング
```
{color}: "bg-{color}-50 text-{color}-600 border-{color}-100"
```

### グラフ統一スタイル
```tsx
<CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
<XAxis dataKey="..." tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
<YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={40} />
<Tooltip contentStyle={{ fontSize: 11, background: "white", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }} />
```
