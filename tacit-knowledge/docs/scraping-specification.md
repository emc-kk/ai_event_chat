# スクレイピング仕様書 / Scraping Specification

> SkillRelay プロジェクトにおけるスクレイピングシステムの設計・実装パターン・ベストプラクティスを包括的に文書化。
> Data Acquisition Pipeline (Fuji Electric) と Target List Builder (taiziii_infra) の両方の知見を集約。

---

## 1. 概要

### 1.1 2つのスクレイピングシステム

| | Data Acquisition Pipeline | Target List Builder |
|---|---|---|
| **用途** | エネルギー市場データの定期取得 | 営業ターゲット企業の電話番号・ISO認証取得 |
| **対象** | JEPX, pps-net, JPX 等 | 4,712社の企業HP + 検索エンジン |
| **アーキテクチャ** | 分散ワーカー (SQS + EC2 Spot) | CLIバッチ (ローカル実行) |
| **実績** | 68,000+ レコード/日 | 電話番号 99.96% / ISO 100% |
| **リポジトリ** | [emc-kk/skillrelay-scraper](https://github.com/emc-kk/skillrelay-scraper) (エージェント) / skillrelay/data_acquisition/ (coordinator) | taiziii_infra/scripts/target-list-builder/ |

### 1.2 使い分け

- **定期的なデータ取得** → Data Acquisition Pipeline (Scheduler + SQS + Worker)
- **一括バッチ処理** → Target List Builder パターン (CLI + 3-tier fallback)
- **新規スクレイパー追加** → Data Acquisition の `BaseScraper` を継承

---

## 2. Data Acquisition Pipeline アーキテクチャ

### 2.1 システム構成

**Mode A: SQS Pull (Spot Instance 専用)**
```
Scheduler (cron)
    ↓ SQS Task Queue
Worker (EC2 Spot Instance)
    ├── CsvScraper   — CSV ダウンロード (JEPX 等)
    ├── WebScraper   — HTML テーブル抽出 (pps-net 等)
    ├── PdfScraper   — PDF テーブル抽出 (JPX カーボン等)
    └── ApiScraper   — REST API (JSON)
    ↓ SQS Result Queue (100レコード/バッチ)
Result Consumer → PostgreSQL (data_acquisition_records)
```

**Mode B: SSH Push (他アカウントEC2利用)**
```
EventBridge (60s) → Lambda Coordinator (skillrelayアカウント)
    ├── SSM Parameter Store → アカウント認証情報 + ディスカバリルール
    ├── EC2 API → インスタンス自動検出 (Spot ID変更に対応)
    ├── SSH → check_resources.py (CPU/MEM確認、本来の処理に影響させない)
    └── SSH → echo task.json | run_task.py → 結果JSON
    ↓ PostgreSQL 直接書き込み
data_acquisition_records / data_acquisition_tasks
```

**リポジトリ分離:**
- スクレイパーエージェント (run_task.py, worker/scraper/): [emc-kk/skillrelay-scraper](https://github.com/emc-kk/skillrelay-scraper)
- Lambda Coordinator / CloudFormation: skillrelay/data_acquisition/coordinator/
- 各インスタンスは `git pull` でコード更新

### 2.2 EC2 Spot Instance ライフサイクル

```
ASG Launch → user_data.sh
    ├── S3 から worker_boot.tar.gz をダウンロード
    ├── pip install -r requirements.txt
    ├── SSM Parameter Store から DB パスワード取得
    ├── server.py 起動 (Scheduler + Result Consumer + Health Monitor)
    └── worker_main.py 起動 (SQS ポーリング + スクレイピング)
```

- Spot Termination 検知: `/tmp/SPOT_TERMINATING` フラグファイル
- Graceful shutdown: SIGTERM/SIGINT ハンドリング

### 2.3 スクレイパータイプ

| Type | Class | 用途 | バックエンド |
|------|-------|------|------------|
| `csv_download` | `CsvScraper` | JEPX スポット/先渡市場 | requests (POST/GET) |
| `web_scrape` | `WebScraper` | pps-net, OCCTO, METI | requests / Playwright / Selenium |
| `pdf_download` | `PdfScraper` | JPX カーボン日次レポート | requests + pdfplumber |
| `api` | `ApiScraper` | REST API エンドポイント | requests |

### 2.4 ジョブ定義構造 (data_acquisition_jobs テーブル)

```json
{
  "source": {
    "type": "csv_download",
    "url": "https://www.jepx.jp/_download.php",
    "method": "post",
    "form_data": {"dir": "spot_summary", "file": "spot_summary_2025.csv"},
    "encoding": "shift_jis",
    "referer": "https://www.jepx.jp/"
  },
  "extraction": {
    "columns": [
      {"source": "受渡日", "name": "delivery_date", "type": "text"},
      {"source": "システムプライス", "name": "system_price", "type": "number"}
    ]
  },
  "schedule": {"cron": "0 23,11 * * *"},
  "retry": {"max_attempts": 3, "backoff_seconds": 60}
}
```

---

## 3. Column Mapping アルゴリズム

### 3.1 概要

ソース (CSV/HTML/PDF) のヘッダーとジョブ定義のカラム名をマッチングする。
`data_acquisition/worker/scraper/utils.py` の `build_column_map()` に統一実装。

### 3.2 マッチング順序

```
1. 完全一致: header == source_name
2. 部分一致: source_name in header (一方向のみ)
3. フォールバック: マッチ0件 → 全非空ヘッダーを使用
4. 定義なし: カラム定義がない場合 → 全ヘッダーを text 型で使用
```

### 3.3 重要な注意点

- **一方向マッチのみ**: `source_name in header` は許可するが、`header in source_name` は**禁止**
  - 理由: 空文字列 `""` がすべてにマッチする。`年度` が `昨年度比` にマッチする等の誤動作防止
- **空ヘッダーガード**: `header and` を先行条件にし、空ヘッダーをスキップ

### 3.4 実装 (utils.py)

```python
def build_column_map(raw_headers, columns):
    col_map = {}
    if columns:
        for col_def in columns:
            source_name = col_def["source"]
            for idx, header in enumerate(raw_headers):
                # ガード: 空ヘッダーをスキップ
                # マッチ: 完全一致 or source_name がヘッダーに含まれる (一方向のみ)
                if header and (header == source_name or source_name in header):
                    col_map[idx] = (col_def["name"], col_def.get("type", "text"))
                    break
        # フォールバック: 0件マッチ時
        if not col_map:
            for idx, header in enumerate(raw_headers):
                if header:
                    col_map[idx] = (header, "text")
    else:
        for idx, header in enumerate(raw_headers):
            if header:
                col_map[idx] = (header, "text")
    return col_map
```

### 3.5 Value Casting

```python
def cast_value(raw, field_type):
    if not raw:
        return None
    if field_type == "number":
        # カンマ、半角スペース、全角スペースを除去
        cleaned = raw.replace(",", "").replace(" ", "").replace("\u3000", "")
        try:
            return float(cleaned) if "." in cleaned else int(cleaned)
        except (ValueError, TypeError):
            return raw  # 数値変換不可の場合は元の文字列を返す
    return raw
```

---

## 4. Target List Builder アーキテクチャ

### 4.1 5-Phase Pipeline

```
Phase 1: データ読み込み (chiiki_kenin.py)
    ↓ 4,712社の企業基本情報
Phase 2: GビズINFO API エンリッチ (gbiz.py) [オプション]
    ↓ 従業員数、売上高、設立年 等
Phase 3: SkillRelay適合スコアリング (scoring.py)
    ↓ 0-100 スコア
Phase 4: 電話番号 + ISO認証スクレイピング (phone_scraper.py)
    ↓ 3-tier fallback
Phase 5: テレアポトーク生成 (talk_generator.py) [オプション]
    ↓ Claude Haiku で3行トーク
最終CSV出力
```

### 4.2 3-Tier Fallback パターン

**最も重要な設計パターン。あらゆるスクレイピングに応用可能。**

```
全対象企業
    ↓
Tier 1: curl_cffi (Chrome TLS fingerprint 偽装)
  ├── Chrome 131 の TLS fingerprint (JA3/JA4) を偽装
  ├── WAF の TLS 指紋検出をバイパス
  ├── 並行20接続、15秒タイムアウト、500社バッチ
  └── 成功率: ~70% (大半のサイトはこれで取得可能)
    ↓ 電話番号が取れなかった企業のみ
Tier 2: Playwright + stealth (ヘッドレスブラウザ)
  ├── Chromium で実際にページをレンダリング
  ├── playwright-stealth で bot 検出シグナルを隠蔽
  ├── JavaScript描画サイト (SPA等) に対応
  ├── 並行5ページ、20秒タイムアウト、100社バッチ
  └── 成功率: ~5% 追加
    ↓ 電話番号が取れなかった企業のみ
Tier 3: DuckDuckGo HTML 検索
  ├── 「企業名 都道府県 電話番号」で検索
  ├── 電話帳サイト・企業情報サイトの検索結果から抽出
  ├── 並行5リクエスト、1.5秒ディレイ、200社バッチ
  └── 成功率: ~25% 追加 (最終 99.96% 到達)
```

**応用のポイント:**
- 各Tierの並行数・バッチサイズ・タイムアウトは独立して調整可能
- 「失敗した対象のみ次のTierに渡す」ことで無駄なリクエストを削減
- 各バッチ完了後に中間保存 → 中断しても再開可能

---

## 5. DuckDuckGo ベストプラクティス

### 5.1 HTML版が最強

```python
import requests

def ddg_search(query: str) -> str:
    """DDG HTML版で検索 (ChromeDriver不要)"""
    r = requests.post(
        "https://html.duckduckgo.com/html/",
        data={"q": query},
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) "
                          "Chrome/145.0.0.0 Safari/537.36",
        },
        timeout=15,
    )
    r.encoding = "utf-8"
    return r.text
```

### 5.2 検索エンジン比較 (2026-03 時点)

| エンジン | ブロック耐性 | 速度 | 推奨度 |
|----------|-------------|------|--------|
| **DDG HTML版** (`html.duckduckgo.com/html/`) | ブロック0回 (3,000+クエリ) | 高速 | ★★★ |
| DDG Chrome版 (undetected-chromedriver) | ブロック0回 | 遅い | ★★ |
| Google | ~20クエリでCAPTCHA | — | ★ |
| iタウンページ | WAFブロック | — | ✗ |

### 5.3 クエリバリエーション戦略

同じ検索エンジンでも、クエリを変えるだけでヒット率が大幅に上がる。

**電話番号:**
```python
PHONE_QUERIES = [
    "{company} {prefecture} 電話番号",  # 基本 (ヒット率 ~75%)
    "{company} 代表電話",               # 代表番号に特化
    "{company} TEL 会社概要",           # 会社概要ページ狙い
    "{company} お問い合わせ 電話",       # 問い合わせページ狙い
]
```

**ISO認証:**
```python
ISO_QUERIES = [
    "{company} ISO認証",                # 基本
    "{company} ISO9001 ISO14001",       # 具体的な規格番号
    "{company} 品質方針 環境方針",       # 方針ページ狙い
]
```

### 5.4 ブロック検知とバックオフ

```python
def is_blocked(html: str) -> bool:
    return (not html
            or "blocked" in html.lower()
            or len(html) < 500)

# メインループ内
if is_blocked(result):
    block_count += 1
    time.sleep(random.uniform(10, 20))  # バックオフ
```

---

## 6. 電話番号抽出アルゴリズム

### 6.1 正規表現パターン (4種)

```python
import re

PHONE_PATTERNS = [
    # 固定電話 (ハイフン付き): 0X-XXXX-XXXX
    re.compile(r"(?<!\d)(0\d{1,4}[-‐‑–—ー]\d{1,4}[-‐‑–—ー]\d{3,4})(?!\d)"),
    # フリーダイヤル: 0120-XXX-XXX
    re.compile(r"(?<!\d)(0120[-‐‑–—ー]\d{2,3}[-‐‑–—ー]\d{3,4})(?!\d)"),
    # フリーコール: 0800-XXX-XXXX
    re.compile(r"(?<!\d)(0800[-‐‑–—ー]\d{3,4}[-‐‑–—ー]\d{4})(?!\d)"),
    # ハイフンなし (10-11桁): 0XXXXXXXXX
    re.compile(r"(?<!\d)(0\d{9,10})(?!\d)"),
]
```

### 6.2 全角→半角変換

```python
def normalize_phone(raw: str) -> str:
    table = str.maketrans(
        "０１２３４５６７８９ー−‐‑–—",
        "0123456789------"
    )
    normalized = raw.translate(table)
    normalized = re.sub(r"[-]+", "-", normalized)
    return normalized.strip("-")
```

### 6.3 バリデーション

```python
EXCLUDE_PATTERNS = [
    re.compile(r"^0[05]\d{8}$"),   # 携帯 (050)
    re.compile(r"^000"),            # 無効
    re.compile(r"^0120\d{6}$"),    # フリーダイヤル (ハイフンなし)
]

def is_valid_phone(phone: str) -> bool:
    digits = re.sub(r"\D", "", phone)
    if len(digits) < 9 or len(digits) > 11:
        return False
    for pat in EXCLUDE_PATTERNS:
        if pat.match(digits):
            return False
    return True
```

### 6.4 抽出優先順位

1. **`tel:` リンク** — HTML の `href="tel:..."` は最も信頼性が高い
2. **ラベル付き番号** — 「TEL」「代表電話」「本社」の近くにある番号
3. **固定電話** — 0120/0800 より固定電話を優先 (テレアポ用途)
4. **FAX除外** — 周辺100文字のコンテキスト解析で「FAX」近接番号を除外

### 6.5 サブページ巡回

トップページで見つからない場合、以下のパスを順に試す:
```python
CONTACT_PATHS = [
    "/company/", "/about/", "/contact/", "/access/",
    "/company.html", "/about.html", "/corporate/", "/info/",
]
```

---

## 7. ISO認証抽出アルゴリズム

### 7.1 パターンマッチング

```python
ISO_PATTERN = re.compile(
    r"ISO\s*(\d{4,5})"
    r"|ISMS"
    r"|IATF\s*16949"
    r"|JIS\s*Q\s*(\d{4,5})"
    r"|OHSAS\s*18001",
    re.IGNORECASE,
)

KNOWN_ISO = {
    "9001": "ISO9001",     # 品質マネジメント
    "14001": "ISO14001",   # 環境マネジメント
    "27001": "ISO27001",   # 情報セキュリティ
    "45001": "ISO45001",   # 労働安全衛生
    "22000": "ISO22000",   # 食品安全
    "13485": "ISO13485",   # 医療機器
    "50001": "ISO50001",   # エネルギーマネジメント
    "16949": "IATF16949",  # 自動車品質
    "9100": "JISQ9100",    # 航空宇宙
    "15189": "ISO15189",   # 臨床検査
    "17025": "ISO17025",   # 試験所認定
    "22301": "ISO22301",   # 事業継続
    "39001": "ISO39001",   # 道路交通安全
}
```

### 7.2 特殊マッピング

- `ISMS` → `ISO27001`
- `OHSAS 18001` → `ISO45001` (旧規格)
- `JIS Q XXXXX` → 対応するISO規格

### 7.3 ISO専用巡回パス

```python
ISO_PATHS = [
    "/quality/", "/quality.html", "/iso/",
    "/certification/", "/policy/",
    "/environment/", "/csr/", "/safety/",
]
```

### 7.4 リンク追跡

HTMLページのリンクからISO関連ページを自動発見:
```python
ISO_LINK_KEYWORDS = re.compile(
    r"iso|品質|環境|認証|マネジメント|方針|isms",
    re.IGNORECASE,
)
```

---

## 8. Progress/Resume パターン

### 8.1 設計原則

- **JSON ファイルで処理済みインデックスを管理**
- **N件ごとに中間保存** (推奨: 10件)
- **中断→再開で重複処理なし**

### 8.2 実装パターン

```python
import json

PROGRESS_FILE = "output/_progress.json"
SAVE_INTERVAL = 10

def load_progress() -> set[int]:
    try:
        with open(PROGRESS_FILE) as f:
            return set(json.load(f))
    except (FileNotFoundError, json.JSONDecodeError):
        return set()

def save_progress(done: set[int]):
    with open(PROGRESS_FILE, "w") as f:
        json.dump(sorted(done), f)

# メインループ
done = load_progress()
for i, company in enumerate(companies):
    if i in done:
        continue
    # ... 処理 ...
    done.add(i)
    if len(done) % SAVE_INTERVAL == 0:
        save_progress(done)
        save_results(results)
```

### 8.3 Data Acquisition Pipeline の場合

- SQS の Visibility Timeout でリトライを管理
- DLQ (Dead Letter Queue) で永続的失敗を分離
- バッチ処理 (100レコード/SQSメッセージ) で効率化

---

## 9. レートリミット戦略

### 9.1 DuckDuckGo

| パラメータ | 値 | 説明 |
|-----------|-----|------|
| リクエスト間隔 | 1.5-5秒 | `random.uniform()` でランダム化 |
| ブロック検知時 | 10-20秒 バックオフ | ブロック回数に応じて増加 |
| 累計3,000+クエリ | ブロック0回 | HTML版の実績 (2026-03) |

### 9.2 GビズINFO API

| パラメータ | 値 | 説明 |
|-----------|-----|------|
| 基本間隔 | 1.0秒/リクエスト | 6,000req/10min 制限 |
| 長時間停止 | 5,000req → 30秒休止 | 累計カウンタ |
| 429レスポンス | 60秒待機→リトライ | HTTP 429 (Too Many Requests) |

### 9.3 企業HP直接アクセス

| パラメータ | 値 | 説明 |
|-----------|-----|------|
| 同一ドメイン | 2秒間隔 | robots.txt の Crawl-delay 準拠 |
| 並行リクエスト | 20 (Tier1) / 5 (Tier2,3) | asyncio.Semaphore で制御 |

---

## 10. Encoding 処理

### 10.1 日本語サイトの文字コード問題

- **JEPX**: Shift-JIS (ジョブ定義で `encoding: "shift_jis"` を指定)
- **政府系 (METI, OCCTO)**: UTF-8 + BOM
- **requests のデフォルト**: Content-Type ヘッダーから推定 → `iso-8859-1` になることが多い

### 10.2 処理フロー (utils.fix_encoding)

```
1. explicit_encoding 指定あり?
   ├── Yes → content.decode(encoding) を試行
   │   ├── 成功 → デコード済みテキストを返す
   │   └── 失敗 → apparent_encoding にフォールバック
   └── No → 次へ
2. response.encoding が iso-8859-1 or ascii?
   ├── Yes → apparent_encoding に修正
   └── No → そのまま
3. response.text を返す
```

### 10.3 BOM 処理

```python
# UTF-8 BOM (\ufeff) の除去
if content.startswith("\ufeff"):
    content = content[1:]
```

### 10.4 Referer ヘッダーの重要性

**JEPX CSV ダウンロードで必須**。Referer なしだと 0 バイトレスポンスが返る。

```python
# URL ドメインから自動生成
from urllib.parse import urlparse
parsed = urlparse(url)
referer = f"{parsed.scheme}://{parsed.netloc}/"
```

---

## 11. 共通ユーティリティ リファレンス

### 11.1 Data Acquisition: `data_acquisition/worker/scraper/utils.py`

| 関数 | 用途 | 利用元 |
|------|------|--------|
| `cast_value(raw, field_type)` | 型変換 (number→int/float) | CSV, Web, PDF |
| `build_column_map(headers, columns)` | ヘッダー→カラムマッピング | CSV, Web, PDF |
| `extract_records(rows, col_map)` | 行リスト→レコード変換 | CSV, Web, PDF |
| `make_headers(accept, referer)` | HTTP ヘッダー生成 | CSV, Web, PDF |
| `auto_referer(url)` | Referer 自動生成 | CSV |
| `fix_encoding(response, encoding)` | エンコーディング修正 | CSV, Web, PDF |
| `DEFAULT_USER_AGENT` | 共通 User-Agent 文字列 | 全スクレイパー |

### 11.2 スクレイパーの責務分離

リファクタリング後、各スクレイパーは**固有ロジックのみ**を保持:

| スクレイパー | 固有ロジック |
|------------|------------|
| **CsvScraper** | POST/GET ダウンロード, BOM 除去, CSV パーサー |
| **WebScraper** | Selenium/Playwright 制御, CSS セレクタ抽出, HTML テーブル→ヘッダー変換 |
| **PdfScraper** | pdfplumber テーブル抽出, PDF リンク発見, ページ範囲 |
| **ApiScraper** | Bearer/API Key 認証, data_path 辿り |

---

## 12. エラーハンドリング

### 12.1 HTTP エラー

- `response.raise_for_status()` で 4xx/5xx を即座に検出
- SQS Visibility Timeout でリトライ (Data Acquisition)
- DLQ で永続的失敗を分離

### 12.2 パースエラー

- テーブル未発見 → 警告ログ + 空 yield
- カラムマッチ 0件 → 全カラムフォールバック
- 数値変換失敗 → 元の文字列を返す

### 12.3 Selenium エラー

- ChromeDriver バージョン不一致 → requests へ自動フォールバック
- ページロードタイムアウト → requests へ自動フォールバック

---

## 13. 運用実績 (2026-03)

### 13.1 Data Acquisition Pipeline (Fuji Electric)

| ジョブ | レコード数 | スケジュール |
|--------|-----------|------------|
| JEPX スポット (2025年度) | 33,024 | 毎日 8:00/20:00 JST |
| JEPX スポット (2024年度) | 35,040 | 月曜 8:00 JST |
| JEPX 先渡市場 | 500 | 毎日 8:00/20:00 JST |
| 非化石証書 価格推移 | 53 | 毎月1日 8:00 JST |
| J-クレジット | 34 | 月曜 8:00 JST |
| 再エネ賦課金 | 30 | 毎月1日 8:00 JST |
| カーボンクレジット | 2 | 平日 20:00 JST |

### 13.2 Target List Builder (taiziii_infra)

| ステップ | 手法 | 電話番号カバレッジ |
|----------|------|-------------------|
| Phase 4 (main.py) | curl_cffi + Playwright + DDG | 68.9% |
| DDG Chrome版 | undetected-chromedriver | 92.0% |
| DDGリトライ | 代替クエリ3種 | 96.5% |
| HP直接スクレイピング | requests + BeautifulSoup | 96.7% |
| **DDG HTML版** | **requests 直接** | **99.96%** |

### 13.3 コスト

| 処理 | コスト | 備考 |
|------|--------|------|
| Data Acquisition EC2 Spot | ~$0.30/日 | t3.medium |
| HPスクレイピング | 無料 | ネットワーク通信のみ |
| DDG検索 | 無料 | API不要 |
| トーク生成 (Claude Haiku) | ~$0.30/300社 | `--no-talk` でスキップ可 |
