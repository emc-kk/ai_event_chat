"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  RefreshCw,
  Clock,
  TrendingUp,
  Leaf,
  Zap,
  AlertCircle,
  Lightbulb,
} from "lucide-react";
import JepxChart from "./components/jepx-chart";
import NonfossilChart from "./components/nonfossil-chart";
import SurchargeChart from "./components/surcharge-chart";
import ForwardChart from "./components/forward-chart";
import CarbonCreditChart from "./components/carbon-credit-chart";
import JCreditChart from "./components/jcredit-chart";
import ElectricityRateChart from "./components/electricity-rate-chart";
import BalancingChart from "./components/balancing-chart";
import ProcurementCostInsight from "./components/insights/procurement-cost-insight";
import ForwardPremiumInsight from "./components/insights/forward-premium-insight";
import CarbonComparisonInsight from "./components/insights/carbon-comparison-insight";
import UtilityVsMarketInsight from "./components/insights/utility-vs-market-insight";
import CsvDownloadButton from "./components/csv-download-button";
import sampleData from "@/data/demo/fuji-electric-sample.json";

interface SourceMeta {
  count: number;
  job_status: string;
  last_updated: string | null;
}

interface SourceData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  records: any[];
  meta: SourceMeta;
}

const SOURCES = [
  // P0
  { key: "jepx_spot", label: "JEPXスポット", icon: Zap, color: "indigo" },
  { key: "nonfossil_fit", label: "非化石証書(FIT)", icon: Leaf, color: "emerald" },
  { key: "nonfossil_nonfit", label: "非化石証書(非FIT)", icon: Leaf, color: "blue" },
  { key: "renewable_surcharge", label: "再エネ賦課金", icon: TrendingUp, color: "amber" },
  // P1
  { key: "jepx_forward", label: "先渡市場", icon: Zap, color: "violet" },
  { key: "carbon_credit", label: "カーボンクレジット", icon: Leaf, color: "cyan" },
  { key: "jcredit_price", label: "J-クレジット", icon: TrendingUp, color: "lime" },
  // P2
  { key: "electricity_rate", label: "電気料金", icon: Zap, color: "purple" },
  { key: "balancing_market", label: "需給調整市場", icon: TrendingUp, color: "rose" },
] as const;

export default function FujiElectricDashboard() {
  const [data, setData] = useState<Record<string, SourceData>>({});
  const [loading, setLoading] = useState(true);
  const [usingSample, setUsingSample] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const results: Record<string, SourceData> = {};
      let hasRealData = false;

      for (const source of SOURCES) {
        try {
          const res = await fetch(
            `/api/demo/fuji-electric/data?source=${source.key}&days=90`
          );
          if (res.ok) {
            const json = await res.json();
            if (json.records?.length > 0) {
              results[source.key] = json;
              hasRealData = true;
            }
          }
        } catch {
          // API route not available or DB not connected
        }
      }

      if (!hasRealData) {
        // サンプルデータにフォールバック
        setUsingSample(true);
        const fallback: Record<string, SourceData> = {};
        for (const source of SOURCES) {
          const sample = sampleData[source.key as keyof typeof sampleData];
          if (sample) {
            fallback[source.key] = {
              records: sample.records,
              meta: { count: sample.records.length, job_status: "sample", last_updated: sample.meta.last_updated },
            };
          }
        }
        setData(fallback);
      } else {
        setUsingSample(false);
        // 欠損ソースはサンプルで埋める
        for (const source of SOURCES) {
          if (!results[source.key]) {
            const sample = sampleData[source.key as keyof typeof sampleData];
            if (sample) {
              results[source.key] = {
                records: sample.records,
                meta: { count: sample.records.length, job_status: "sample", last_updated: sample.meta.last_updated },
              };
            }
          }
        }
        setData(results);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatTime = (ts: string | null) => {
    if (!ts) return "未取得";
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const jepxLatestPrice = data.jepx_spot?.records?.[data.jepx_spot.records.length - 1]?.system_price;
  const surchargeLatest = data.renewable_surcharge?.records?.[data.renewable_surcharge.records.length - 1]?.surcharge_rate;

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900">
            <BarChart3 className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">
              エネルギー調達ダッシュボード
            </h1>
            <p className="text-[11px] text-gray-400 mt-0.5">
              富士電機 / 電力調達データ定点観測
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {usingSample && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-amber-50 border border-amber-200 text-amber-600">
              <AlertCircle className="h-3 w-3" />
              サンプルデータ表示中
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
            />
            更新
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {SOURCES.map((source) => {
          const sd = data[source.key];
          const Icon = source.icon;
          const colorMap: Record<string, string> = {
            indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
            emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
            blue: "bg-blue-50 text-blue-600 border-blue-100",
            amber: "bg-amber-50 text-amber-600 border-amber-100",
            violet: "bg-violet-50 text-violet-600 border-violet-100",
            cyan: "bg-cyan-50 text-cyan-600 border-cyan-100",
            lime: "bg-lime-50 text-lime-600 border-lime-100",
            purple: "bg-purple-50 text-purple-600 border-purple-100",
            rose: "bg-rose-50 text-rose-600 border-rose-100",
          };
          return (
            <div
              key={source.key}
              className="bg-white rounded-lg border border-gray-200/80 p-4 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded ${colorMap[source.color]}`}
                >
                  <Icon className="h-3 w-3" />
                </div>
                <span className="text-[11px] font-medium text-gray-700">
                  {source.label}
                </span>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-lg font-bold text-gray-900">
                    {sd?.meta.count ?? "—"}
                    <span className="text-[10px] font-normal text-gray-400 ml-1">
                      件
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CsvDownloadButton sourceKey={source.key} label={source.label} />
                  <div className="flex items-center gap-1 text-[10px] text-gray-400">
                    <Clock className="h-3 w-3" />
                    {formatTime(sd?.meta.last_updated ?? null)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary KPI */}
      {(jepxLatestPrice || surchargeLatest) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {jepxLatestPrice && (
            <div className="bg-gradient-to-r from-indigo-50 to-white rounded-lg border border-indigo-100 p-4">
              <p className="text-[10px] text-indigo-500 font-medium uppercase tracking-wider">
                直近システムプライス
              </p>
              <p className="text-2xl font-bold text-indigo-700 mt-1">
                {jepxLatestPrice.toFixed(2)}
                <span className="text-sm font-normal ml-1">円/kWh</span>
              </p>
            </div>
          )}
          {surchargeLatest && (
            <div className="bg-gradient-to-r from-amber-50 to-white rounded-lg border border-amber-100 p-4">
              <p className="text-[10px] text-amber-500 font-medium uppercase tracking-wider">
                最新 再エネ賦課金
              </p>
              <p className="text-2xl font-bold text-amber-700 mt-1">
                {surchargeLatest.toFixed(2)}
                <span className="text-sm font-normal ml-1">円/kWh</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Insights Section */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-orange-400 to-pink-500">
            <Lightbulb className="h-3.5 w-3.5 text-white" />
          </div>
          <h2 className="text-sm font-bold text-gray-900">インサイト</h2>
          <span className="text-[10px] text-gray-400 ml-1">複数データソース横断分析</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <ProcurementCostInsight
            jepxSpotRecords={data.jepx_spot?.records ?? []}
            surchargeRecords={data.renewable_surcharge?.records ?? []}
            nonfossilFitRecords={data.nonfossil_fit?.records ?? []}
            nonfossilNonfitRecords={data.nonfossil_nonfit?.records ?? []}
          />
          <UtilityVsMarketInsight
            electricityRateRecords={data.electricity_rate?.records ?? []}
            jepxSpotRecords={data.jepx_spot?.records ?? []}
            surchargeRecords={data.renewable_surcharge?.records ?? []}
            nonfossilFitRecords={data.nonfossil_fit?.records ?? []}
            nonfossilNonfitRecords={data.nonfossil_nonfit?.records ?? []}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ForwardPremiumInsight
            jepxSpotRecords={data.jepx_spot?.records ?? []}
            forwardRecords={data.jepx_forward?.records ?? []}
          />
          <CarbonComparisonInsight
            carbonCreditRecords={data.carbon_credit?.records ?? []}
            jcreditRecords={data.jcredit_price?.records ?? []}
          />
        </div>
      </div>

      {/* JEPX Chart (full width) */}
      <div className="mb-6">
        <JepxChart data={data.jepx_spot?.records ?? []} />
      </div>

      {/* Non-fossil + Surcharge (2 column) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <NonfossilChart
          fitData={data.nonfossil_fit?.records ?? []}
          nonfitData={data.nonfossil_nonfit?.records ?? []}
        />
        <SurchargeChart data={data.renewable_surcharge?.records ?? []} />
      </div>

      {/* P1: Forward + Carbon Credit (2 column) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ForwardChart data={data.jepx_forward?.records ?? []} />
        <CarbonCreditChart data={data.carbon_credit?.records ?? []} />
      </div>

      {/* P1: J-Credit + P2: Electricity Rate (2 column) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <JCreditChart data={data.jcredit_price?.records ?? []} />
        <ElectricityRateChart data={data.electricity_rate?.records ?? []} />
      </div>

      {/* P2: Balancing Market (full width) */}
      <div className="mb-6">
        <BalancingChart data={data.balancing_market?.records ?? []} />
      </div>
    </div>
  );
}
