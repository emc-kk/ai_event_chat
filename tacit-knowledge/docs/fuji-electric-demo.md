# 富士電機 エネルギー調達ダッシュボード

## 概要

電力・エネルギー市場の9つのデータソースを自動収集し、調達意思決定を支援するダッシュボードデモ。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│ Data Sources (外部サイト)                                    │
│  JEPX / 非化石証書 / 再エネ賦課金 / 先渡市場 / カーボン... │
└──────────────┬──────────────────────────────────────────────┘
               │ スクレイピング (CSV/HTML/Selenium/PDF)
┌──────────────▼──────────────────────────────────────────────┐
│ Data Acquisition Worker (EC2 Spot)                             │
│  csv_scraper.py / web_scraper.py / pdf_scraper.py            │
│  SQSからタスク受信 → スクレイピング → DB書き込み            │
└──────────────┬──────────────────────────────────────────────┘
               │ PostgreSQL
┌──────────────▼──────────────────────────────────────────────┐
│ AI Server (App Runner / Next.js)                             │
│  /demo/fuji-electric       ← ダッシュボードUI               │
│  /api/demo/fuji-electric/data  ← データAPI                  │
│  /api/demo/fuji-electric/csv   ← CSVダウンロードAPI          │
└─────────────────────────────────────────────────────────────┘
```

## データソース一覧

| # | ソース | Job ID | 取得方法 | 優先度 | スケジュール (JST) |
|---|--------|--------|----------|--------|-------------------|
| 1 | JEPXスポット市場 (当年度) | `fuji-jepx-spot-current` | CSV POST | P0 | 毎日 8:00/20:00 |
| 2 | JEPXスポット市場 (前年度) | `fuji-jepx-spot-previous` | CSV POST | P0 | 毎週月曜 8:00 |
| 3 | 非化石証書 (FIT) | `fuji-nonfossil-fit` | HTML table | P0 | 毎日 8:00/20:00 |
| 4 | 非化石証書 (非FIT) | `fuji-nonfossil-nonfit` | HTML table | P0 | 毎日 8:00/20:00 |
| 5 | 再エネ賦課金 | `fuji-renewable-surcharge` | HTML table | P0 | 毎月1日 8:00 |
| 6 | JEPX先渡市場 | `fuji-jepx-forward` | CSV POST | P1 | 毎日 8:00/20:00 |
| 7 | カーボンクレジット | `fuji-carbon-credit` | PDF (link discovery) | P1 | 平日 20:00 |
| 8 | J-クレジット | `fuji-jcredit-price` | HTML table (Selenium) | P1 | 毎週月曜 8:00 |
| 9 | 電気料金 | `fuji-electricity-rate` | PDF (link discovery) | P2 | 四半期 (1,4,7,10月) |
| 10 | 需給調整市場 | `fuji-balancing-market` | HTML table | P2 | 毎日 8:00/20:00 |

## ダッシュボード機能

### インサイト (横断分析)

| インサイト | 組合せソース | 内容 |
|-----------|-------------|------|
| 調達コスト構成 | JEPX + 賦課金 + 非化石 | Stacked Bar: 市場調達コストの内訳 (スポット/賦課金/非化石%) |
| 電力会社 vs 市場 | 電気料金 + (JEPX+賦課金+非化石) | 横Bar + ReferenceLine: 市場調達 vs 電力会社単価 |
| 先渡プレミアム | JEPX スポット vs 先渡 | Bar: 月別プレミアム% (コンタンゴ/バックワーデーション) |
| カーボン市場比較 | カーボンクレジット vs J-クレジット | Grouped Bar: カテゴリ別の市場間価格差 |

### 個別チャート (8種)

JEPXスポット / 非化石証書 / 再エネ賦課金 / 先渡市場 / カーボンクレジット / J-クレジット / 電気料金 / 需給調整市場

### CSVダウンロード

各データソースのステータスカードからCSVダウンロード可能。BOM付きUTF-8でExcel対応。

## ファイル構成

```
ai-server/
├── app/demo/fuji-electric/
│   ├── page.tsx                          # メインダッシュボード
│   ├── components/
│   │   ├── jepx-chart.tsx                # JEPXスポットチャート
│   │   ├── nonfossil-chart.tsx           # 非化石証書チャート
│   │   ├── surcharge-chart.tsx           # 再エネ賦課金チャート
│   │   ├── forward-chart.tsx             # 先渡市場チャート
│   │   ├── carbon-credit-chart.tsx       # カーボンクレジットチャート
│   │   ├── jcredit-chart.tsx             # J-クレジットチャート
│   │   ├── electricity-rate-chart.tsx    # 電気料金チャート
│   │   ├── balancing-chart.tsx           # 需給調整市場チャート
│   │   ├── csv-download-button.tsx       # CSVダウンロードボタン
│   │   └── insights/
│   │       ├── compute-market-cost.ts    # 市場調達コスト算出 (共通)
│   │       ├── procurement-cost-insight.tsx
│   │       ├── utility-vs-market-insight.tsx
│   │       ├── forward-premium-insight.tsx
│   │       └── carbon-comparison-insight.tsx
│   └── ...
├── app/api/demo/fuji-electric/
│   ├── data/route.ts                     # データ取得API
│   └── csv/route.ts                      # CSVダウンロードAPI
└── data/demo/fuji-electric-sample.json   # サンプルデータ (フォールバック)

data_acquisition/
├── worker/scraper/
│   ├── csv_scraper.py      # CSV POST ダウンロード (Shift-JIS対応)
│   ├── web_scraper.py      # HTML table + Selenium (undetected-chromedriver)
│   ├── pdf_scraper.py      # PDF テーブル抽出 (pdfplumber)
│   └── __init__.py         # スクレイパーファクトリ
├── instruction_server/
│   ├── scheduler.py        # Cronスケジューラ (UTC評価, 5分dedup)
│   ├── db.py               # DB接続
│   └── config.py           # 環境変数設定
├── scripts/
│   ├── seed_fuji_electric_jobs.py  # 12ジョブシード
│   ├── user_data.sh        # EC2 Spot起動スクリプト
│   └── spot_interrupt_handler.sh   # Spot中断ハンドラ
└── requirements.txt
```

## AWS インフラ

| リソース | サービス | 用途 |
|---------|---------|------|
| Data Acquisition Task Queue | SQS | Scheduler → Worker タスク配信 |
| Data Acquisition Result Queue | SQS | Worker → Instruction Server 結果通知 |
| Data Acquisition DLQ | SQS | 失敗タスク退避 |
| Data Acquisition Bucket | S3 | ブートスクリプト + 生データ保存 (90日TTL) |
| Spot Worker ASG | EC2 Auto Scaling | スクレイピング実行 (c5.large Spot) |
| CloudFormation | 13-data-acquisition.yml | 上記全リソースのIaC定義 |

## デプロイ

### 自動デプロイ (GitHub Actions)

`data_acquisition/` 配下の変更が `main` にマージされると自動的に:

1. Worker コードを `worker_boot.tar.gz` にパッケージ → S3 アップロード
2. シードスクリプト実行 (ON CONFLICT で冪等)
3. 稼働中の Spot Worker をローリング更新

### 手動操作

```bash
# Spot Worker 起動 (ASG DesiredCapacity を 1 に)
aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name skillrelay-production-data-acquisition-spot-asg \
  --desired-capacity 1

# Spot Worker 停止
aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name skillrelay-production-data-acquisition-spot-asg \
  --desired-capacity 0

# シード手動実行
cd data_acquisition
POSTGRES_HOST=... POSTGRES_PASSWORD=... python scripts/seed_fuji_electric_jobs.py
```

## 新しいデモを追加する場合

1. `data_acquisition/scripts/seed_<client>_jobs.py` を作成 (ジョブ定義)
2. `ai-server/app/demo/<client>/` にダッシュボードUI作成
3. `ai-server/app/api/demo/<client>/data/route.ts` にデータAPI作成
4. `ai-server/data/demo/<client>-sample.json` にサンプルデータ作成
5. GitHub Actions のシードステップに新スクリプトを追加
6. `main` にマージ → 自動デプロイ
