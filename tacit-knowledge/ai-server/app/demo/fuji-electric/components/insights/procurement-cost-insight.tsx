"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Layers } from "lucide-react";
import { computeMarketCost } from "./compute-market-cost";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ProcurementCostInsightProps {
  jepxSpotRecords: any[];
  surchargeRecords: any[];
  nonfossilFitRecords: any[];
  nonfossilNonfitRecords: any[];
}

export default function ProcurementCostInsight({
  jepxSpotRecords,
  surchargeRecords,
  nonfossilFitRecords,
  nonfossilNonfitRecords,
}: ProcurementCostInsightProps) {
  const result = useMemo(() => {
    if (!jepxSpotRecords.length) return null;

    const cost = computeMarketCost(
      jepxSpotRecords,
      surchargeRecords,
      nonfossilFitRecords,
      nonfossilNonfitRecords,
    );

    const spotPct = cost.total > 0 ? ((cost.spotAvg / cost.total) * 100).toFixed(0) : "0";
    const surchargePct = cost.total > 0 ? ((cost.surcharge / cost.total) * 100).toFixed(0) : "0";
    const nonfossilPct = cost.total > 0 ? ((cost.nonfossilAvg / cost.total) * 100).toFixed(0) : "0";

    const chartData = [
      {
        label: "調達コスト",
        spot: cost.spotAvg,
        surcharge: cost.surcharge,
        nonfossil: cost.nonfossilAvg,
      },
    ];

    return { cost, spotPct, surchargePct, nonfossilPct, chartData };
  }, [jepxSpotRecords, surchargeRecords, nonfossilFitRecords, nonfossilNonfitRecords]);

  if (!result) {
    return (
      <div className="bg-white rounded-lg border border-gray-200/80 border-l-4 border-l-orange-400 p-5 shadow-sm">
        <p className="text-xs text-gray-400">データ不足</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200/80 border-l-4 border-l-orange-400 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-orange-50 text-orange-500">
          <Layers className="h-3.5 w-3.5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">調達コスト構成</h3>
          <p className="text-[10px] text-gray-400">JEPX + 賦課金 + 非化石証書</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xl font-bold text-gray-900">
            {result.cost.total.toFixed(2)}
            <span className="text-xs font-normal text-gray-400 ml-1">円/kWh</span>
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={60}>
        <BarChart data={result.chartData} layout="vertical" barSize={28}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" hide />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
            formatter={(value) => [`${Number(value).toFixed(2)} 円/kWh`]}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} iconType="square" />
          <Bar dataKey="spot" name="市場価格 (JEPX)" stackId="a" fill="#6366f1" radius={[4, 0, 0, 4]} />
          <Bar dataKey="surcharge" name="再エネ賦課金" stackId="a" fill="#f59e0b" />
          <Bar dataKey="nonfossil" name="非化石証書" stackId="a" fill="#10b981" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div className="bg-gray-50 rounded-md p-3 mt-3">
        <p className="text-[12px] text-gray-600 leading-relaxed">
          現在の推定調達コストは <span className="font-semibold text-gray-900">{result.cost.total.toFixed(2)} 円/kWh</span>。
          内訳: 市場価格 {result.cost.spotAvg.toFixed(2)}円 ({result.spotPct}%) / 賦課金 {result.cost.surcharge.toFixed(2)}円 ({result.surchargePct}%) / 非化石証書 {result.cost.nonfossilAvg.toFixed(2)}円 ({result.nonfossilPct}%)
        </p>
      </div>
    </div>
  );
}
