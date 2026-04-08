#!/usr/bin/env python3
"""
富士電機 DataAcquisition ジョブ定義シードスクリプト
P0〜P2: 全12ジョブを data_acquisition_jobs テーブルに登録（ON CONFLICT 対応）

注意: cronはUTC表記（Scheduler が UTC で評価するため）
  JST 08:00 = UTC 23:00 (前日)
  JST 20:00 = UTC 11:00

カラム名は実際のデータソースのヘッダーに基づく (2026-03-09確認済み)
"""

import json
import os
import sys
from datetime import datetime

import psycopg2


def get_connection():
    return psycopg2.connect(
        host=os.environ.get("POSTGRES_HOST", "localhost"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "postgres"),
        password=os.environ.get("POSTGRES_PASSWORD", ""),
        dbname=os.environ.get("POSTGRES_DB", "skillrelay_production"),
    )

COMPANY_ID = "01JQFUJIELECTRIC01"  # companies テーブルの富士電機株式会社のID

# 現在の年度を計算（4月始まり）
now = datetime.now()
current_fy = now.year if now.month >= 4 else now.year - 1
previous_fy = current_fy - 1

# ── P0: Must-have (5ジョブ) ──────────────────────────────────
# 実際のCSVヘッダー (2026-03-09確認):
#   受渡日,時刻コード,売り入札量(kWh),買い入札量(kWh),約定総量(kWh),
#   システムプライス(円/kWh),エリアプライス北海道(円/kWh),エリアプライス東北(円/kWh),
#   エリアプライス東京(円/kWh),エリアプライス中部(円/kWh),エリアプライス北陸(円/kWh),
#   エリアプライス関西(円/kWh),エリアプライス中国(円/kWh),エリアプライス四国(円/kWh),
#   エリアプライス九州(円/kWh), ...
JEPX_SPOT_COLUMNS = [
    {"source": "受渡日", "name": "delivery_date", "type": "text"},
    {"source": "時刻コード", "name": "time_code", "type": "number"},
    {"source": "システムプライス", "name": "system_price", "type": "number"},
    {"source": "エリアプライス北海道", "name": "hokkaido_price", "type": "number"},
    {"source": "エリアプライス東北", "name": "tohoku_price", "type": "number"},
    {"source": "エリアプライス東京", "name": "tokyo_price", "type": "number"},
    {"source": "エリアプライス中部", "name": "chubu_price", "type": "number"},
    {"source": "エリアプライス北陸", "name": "hokuriku_price", "type": "number"},
    {"source": "エリアプライス関西", "name": "kansai_price", "type": "number"},
    {"source": "エリアプライス中国", "name": "chugoku_price", "type": "number"},
    {"source": "エリアプライス四国", "name": "shikoku_price", "type": "number"},
    {"source": "エリアプライス九州", "name": "kyushu_price", "type": "number"},
]

P0_JOBS = [
    {
        "id": "fuji-jepx-spot-current",
        "name": f"JEPX スポット市場価格（{current_fy}年度）",
        "description": "JEPXスポット市場のシステムプライスおよびエリアプライスを日次取得",
        "job_definition": {
            "source": {
                "type": "csv_download",
                "url": "https://www.jepx.jp/_download.php",
                "method": "post",
                "form_data": {
                    "dir": "spot_summary",
                    "file": f"spot_summary_{current_fy}.csv",
                },
                "encoding": "shift_jis",
            },
            "extraction": {
                "columns": JEPX_SPOT_COLUMNS,
            },
            "schedule": {"cron": "0 23,11 * * *"},  # JST 8:00, 20:00
            "retry": {"max_attempts": 3, "backoff_seconds": 60},
        },
    },
    {
        "id": "fuji-jepx-spot-previous",
        "name": f"JEPX スポット市場価格（{previous_fy}年度）",
        "description": "JEPXスポット市場の前年度データを週次取得",
        "job_definition": {
            "source": {
                "type": "csv_download",
                "url": "https://www.jepx.jp/_download.php",
                "method": "post",
                "form_data": {
                    "dir": "spot_summary",
                    "file": f"spot_summary_{previous_fy}.csv",
                },
                "encoding": "shift_jis",
            },
            "extraction": {
                "columns": JEPX_SPOT_COLUMNS,
            },
            "schedule": {"cron": "0 23 * * 1"},  # JST 月曜 8:00
            "retry": {"max_attempts": 3, "backoff_seconds": 60},
        },
    },
    # 実際のHTMLテーブルヘッダー (JEPX nonfossil, requestsフォールバック時):
    #   取引, 約定日, 約定量, 約定価格, 約定最高価格, 約定最安価格, 入札会員数, 約定会員数, 売り入札総量, 買い入札総量
    # 注意: データはJS動的ロード。Selenium必須だが、fallback時はheaderのみ取得。
    {
        "id": "fuji-nonfossil-fit",
        "name": "非化石証書（FIT）オークション結果",
        "description": "FIT非化石証書のオークション約定結果をHTMLテーブルから取得",
        "job_definition": {
            "source": {
                "type": "web_scrape",
                "method": "selenium",
                "url": "https://www.jepx.jp/nonfossil/market-data/",
            },
            "extraction": {
                "mode": "html_table",
                "table_index": 0,
                "columns": [
                    {"source": "取引", "name": "round", "type": "text"},
                    {"source": "約定日", "name": "settlement_date", "type": "text"},
                    {"source": "約定量", "name": "volume_kwh", "type": "number"},
                    {"source": "約定価格", "name": "settlement_price", "type": "number"},
                    {"source": "約定最高価格", "name": "max_price", "type": "number"},
                    {"source": "約定最安価格", "name": "min_price", "type": "number"},
                ],
            },
            "schedule": {"cron": "0 23,11 * * *"},  # JST 8:00, 20:00
            "retry": {"max_attempts": 3, "backoff_seconds": 60},
        },
    },
    {
        "id": "fuji-nonfossil-nonfit",
        "name": "非化石証書（非FIT）オークション結果",
        "description": "非FIT非化石証書のオークション約定結果をHTMLテーブルから取得",
        "job_definition": {
            "source": {
                "type": "web_scrape",
                "method": "selenium",
                "url": "https://www.jepx.jp/nonfossil/market-data/",
            },
            "extraction": {
                "mode": "html_table",
                "table_index": 1,
                "columns": [
                    {"source": "取引", "name": "round", "type": "text"},
                    {"source": "約定日", "name": "settlement_date", "type": "text"},
                    {"source": "約定量", "name": "volume_kwh", "type": "number"},
                    {"source": "約定価格", "name": "settlement_price", "type": "number"},
                    {"source": "約定最高価格", "name": "max_price", "type": "number"},
                    {"source": "約定最安価格", "name": "min_price", "type": "number"},
                ],
            },
            "schedule": {"cron": "0 23,11 * * *"},  # JST 8:00, 20:00
            "retry": {"max_attempts": 3, "backoff_seconds": 60},
        },
    },
    # 実際のHTMLテーブルヘッダー (pps-net, table_index=2):
    #   年度, 買い取り単価, 昨年度比, 標準家庭の負担(300kWh/月)
    {
        "id": "fuji-renewable-surcharge",
        "name": "再エネ賦課金 年次推移",
        "description": "再生可能エネルギー発電促進賦課金の年度別推移をHTMLテーブルから取得",
        "job_definition": {
            "source": {
                "type": "web_scrape",
                "url": "https://pps-net.org/statistics/renewable",
            },
            "extraction": {
                "mode": "html_table",
                "table_index": 2,
                "columns": [
                    {"source": "年度", "name": "fiscal_year", "type": "text"},
                    {"source": "買い取り単価", "name": "surcharge_rate", "type": "number"},
                    {"source": "昨年度比", "name": "yoy_change", "type": "text"},
                    {"source": "標準家庭の負担", "name": "household_burden", "type": "number"},
                ],
            },
            "schedule": {"cron": "0 23 1 * *"},  # JST 毎月1日 8:00
            "retry": {"max_attempts": 3, "backoff_seconds": 60},
        },
    },
]

# ── P1: Important (4ジョブ) ──────────────────────────────────
# 実際のCSVヘッダー (JEPX forward, 2026-03-09確認):
#   商品種別,商品名,受渡開始日,受渡終了日,受渡時間,
#   取引最高値(円/kWh),取引最安値(円/kWh),取引平均値(円/kWh),約定件数,約定総量(MW)
P1_JOBS = [
    {
        "id": "fuji-jepx-forward",
        "name": "JEPX 先渡市場約定結果",
        "description": "先渡市場の約定単価・約定量を日次取得",
        "job_definition": {
            "source": {
                "type": "csv_download",
                "url": "https://www.jepx.jp/_download.php",
                "method": "post",
                "form_data": {
                    "dir": "forward",
                    "file": f"forward_{current_fy}.csv",
                },
                "encoding": "shift_jis",
            },
            "extraction": {
                "columns": [
                    {"source": "商品種別", "name": "product_type", "type": "text"},
                    {"source": "商品名", "name": "product_name", "type": "text"},
                    {"source": "受渡開始日", "name": "delivery_start", "type": "text"},
                    {"source": "受渡終了日", "name": "delivery_end", "type": "text"},
                    {"source": "取引平均値", "name": "settlement_price", "type": "number"},
                    {"source": "約定総量", "name": "settled_volume", "type": "number"},
                    {"source": "約定件数", "name": "settled_count", "type": "number"},
                ],
            },
            "schedule": {"cron": "0 23,11 * * *"},  # JST 8:00, 20:00
            "retry": {"max_attempts": 3, "backoff_seconds": 60},
        },
    },
    # 実際のHTMLテーブルヘッダー (pps-net/non-fossil):
    #   Table 3 (FIT, 27rows): (空), 約定処理日, 約定量(kWh), 約定加重平均価格(kWh/税抜), ...
    #   Table 4 (非FIT, 27rows): (空), 約定処理日, 約定量(kWh), 約定価格(kWh/税抜), ...
    # FITテーブルを取得
    {
        "id": "fuji-nonfossil-trends",
        "name": "非化石証書 価格推移（pps-net）",
        "description": "FIT非化石証書の時系列オークション価格・量をHTMLテーブルから取得",
        "job_definition": {
            "source": {
                "type": "web_scrape",
                "url": "https://pps-net.org/non-fossil",
            },
            "extraction": {
                "mode": "html_table",
                "table_index": 3,
                "columns": [
                    {"source": "約定処理日", "name": "settlement_date", "type": "text"},
                    {"source": "約定量", "name": "volume_kwh", "type": "number"},
                    {"source": "約定加重平均価格", "name": "avg_price", "type": "number"},
                    {"source": "約定最高価格", "name": "max_price", "type": "number"},
                    {"source": "約定最安価格", "name": "min_price", "type": "number"},
                ],
            },
            "schedule": {"cron": "0 23 1 * *"},  # JST 毎月1日 8:00
            "retry": {"max_attempts": 3, "backoff_seconds": 60},
        },
    },
    # 実際のPDFテーブルヘッダー (JPX carbon credit, 2026-03-09確認):
    #   制度名, 分類名, 方法論名, 銘柄コード, 始値, 高値, 安値, 終値, 売買高 等
    {
        "id": "fuji-carbon-credit",
        "name": "カーボン・クレジット市場 日次レポート",
        "description": "JPXカーボン・クレジット市場の日次約定結果をPDFから取得",
        "job_definition": {
            "source": {
                "type": "pdf_download",
                "url": "https://www.jpx.co.jp/equities/carbon-credit/daily/",
                "method": "link_discovery",
            },
            "extraction": {
                "mode": "link_then_table",
                "link_pattern": "\\.pdf$",
                "table_index": 0,
                "columns": [
                    {"source": "制度名", "name": "system_name", "type": "text"},
                    {"source": "分類名", "name": "category_name", "type": "text"},
                    {"source": "銘柄コード", "name": "ticker_code", "type": "text"},
                    {"source": "始値", "name": "open_price", "type": "number"},
                    {"source": "高値", "name": "high_price", "type": "number"},
                    {"source": "安値", "name": "low_price", "type": "number"},
                    {"source": "終値", "name": "close_price", "type": "number"},
                    {"source": "売買", "name": "volume", "type": "number"},
                ],
            },
            "schedule": {"cron": "0 11 * * 1-5"},  # JST 平日 20:00
            "retry": {"max_attempts": 3, "backoff_seconds": 120},
        },
    },
    # 実際のHTMLテーブルヘッダー (pps-net/j-credit, table_index=2, 18rows):
    #   日付, 省エネルギー, 再エネ（電力）, 再エネ（熱）, 再エネ（混合）, 森林, ...
    {
        "id": "fuji-jcredit-price",
        "name": "J-クレジット 価格推移",
        "description": "J-クレジットのカテゴリ別月次平均価格をHTMLテーブルから取得",
        "job_definition": {
            "source": {
                "type": "web_scrape",
                "url": "https://pps-net.org/j-credit",
            },
            "extraction": {
                "mode": "html_table",
                "table_index": 2,
                "columns": [
                    {"source": "日付", "name": "date", "type": "text"},
                    {"source": "省エネルギー", "name": "energy_saving_price", "type": "number"},
                    {"source": "再エネ（電力）", "name": "re_electricity_price", "type": "number"},
                    {"source": "森林", "name": "forest_price", "type": "number"},
                ],
            },
            "schedule": {"cron": "0 23 * * 1"},  # JST 月曜 8:00
            "retry": {"max_attempts": 3, "backoff_seconds": 60},
        },
    },
]

# ── P2: Nice-to-have (3ジョブ) ───────────────────────────────
# 注意: これらのURLは2026-03-09時点でアクセス不能（DNS/404）
# ステータスをinactiveに設定し、URLが修正可能になるまで無効化
P2_JOBS = [
    {
        "id": "fuji-electricity-rate",
        "name": "電気料金 平均単価",
        "description": "電力会社別・契約種別の平均電気料金をPDF/Excelから取得（URL要修正）",
        "status": "inactive",
        "job_definition": {
            "source": {
                "type": "pdf_download",
                "url": "https://www.emsc.meti.go.jp/info/public/",
                "method": "link_discovery",
            },
            "extraction": {
                "mode": "link_then_table",
                "link_pattern": "\\.(pdf|xlsx?)$",
                "table_index": 0,
                "columns": [
                    {"source": "電力会社", "name": "utility_company", "type": "text"},
                    {"source": "契約種別", "name": "contract_type", "type": "text"},
                    {"source": "平均単価", "name": "average_unit_price", "type": "number"},
                ],
            },
            "schedule": {"cron": "0 23 1 1,4,7,10 *"},  # JST 四半期初月1日 8:00
            "retry": {"max_attempts": 3, "backoff_seconds": 120},
        },
    },
    {
        "id": "fuji-grid-vacancy",
        "name": "系統空容量マッピング",
        "description": "送配電事業者別の系統空容量・接続可能容量（URL要修正: 404）",
        "status": "inactive",
        "job_definition": {
            "source": {
                "type": "web_scrape",
                "method": "selenium",
                "url": "https://www.tepco.co.jp/pg/consignment/system/pdf_new/map_jyuuryou.html",
            },
            "extraction": {
                "mode": "html_table",
                "table_index": 0,
                "columns": [
                    {"source": "変電所", "name": "substation", "type": "text"},
                    {"source": "送電線", "name": "transmission_line", "type": "text"},
                    {"source": "空容量", "name": "available_capacity_mw", "type": "number"},
                    {"source": "接続可能量", "name": "connectable_capacity_mw", "type": "number"},
                ],
            },
            "schedule": {"cron": "0 23 1 * *"},  # JST 毎月1日 8:00
            "retry": {"max_attempts": 3, "backoff_seconds": 120},
        },
    },
    {
        "id": "fuji-balancing-market",
        "name": "需給調整市場 約定結果",
        "description": "需給調整市場の商品別約定量・約定単価（URL要修正: 404）",
        "status": "inactive",
        "job_definition": {
            "source": {
                "type": "web_scrape",
                "method": "selenium",
                "url": "https://www.tdgc.jp/adjustment/",
            },
            "extraction": {
                "mode": "html_table",
                "table_index": 0,
                "columns": [
                    {"source": "商品", "name": "product_type", "type": "text"},
                    {"source": "約定日", "name": "settlement_date", "type": "text"},
                    {"source": "エリア", "name": "area", "type": "text"},
                    {"source": "約定量", "name": "settled_volume_kw", "type": "number"},
                    {"source": "約定単価", "name": "settlement_price", "type": "number"},
                ],
            },
            "schedule": {"cron": "0 23,11 * * *"},  # JST 8:00, 20:00
            "retry": {"max_attempts": 3, "backoff_seconds": 60},
        },
    },
]

JOBS = P0_JOBS + P1_JOBS + P2_JOBS


def seed():
    """ジョブ定義を DB に登録（冪等）。"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            for job in JOBS:
                status = job.get("status", "active")
                cur.execute(
                    """
                    INSERT INTO data_acquisition_jobs (id, company_id, name, description, job_definition, status, dispatch_target, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, 'ssh', NOW(), NOW())
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        description = EXCLUDED.description,
                        job_definition = EXCLUDED.job_definition,
                        status = EXCLUDED.status,
                        dispatch_target = 'ssh',
                        updated_at = NOW()
                    """,
                    (
                        job["id"],
                        COMPANY_ID,
                        job["name"],
                        job["description"],
                        json.dumps(job["job_definition"], ensure_ascii=False),
                        status,
                    ),
                )
                print(f"  Seeded: {job['id']} ({job['name']}) [{status}]")

            conn.commit()

    active = sum(1 for j in JOBS if j.get("status", "active") == "active")
    inactive = sum(1 for j in JOBS if j.get("status") == "inactive")
    print(f"\nDone. {len(JOBS)} jobs seeded for company '{COMPANY_ID}'.")
    print(f"  Active: {active}, Inactive: {inactive}")


if __name__ == "__main__":
    seed()
