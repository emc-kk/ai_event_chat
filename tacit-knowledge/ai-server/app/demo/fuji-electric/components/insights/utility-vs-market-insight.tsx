"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Scale } from "lucide-react";
import { computeMarketCost } from "./compute-market-cost";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface UtilityVsMarketInsightProps {
  electricityRateRecords: any[];
  jepxSpotRecords: any[];
  surchargeRecords: any[];
  nonfossilFitRecords: any[];
  nonfossilNonfitRecords: any[];
}

export default function UtilityVsMarketInsight({
  electricityRateRecords,
  jepxSpotRecords,
  surchargeRecords,
  nonfossilFitRecords,
  nonfossilNonfitRecords,
}: UtilityVsMarketInsightProps) {
  const result = useMemo(() => {
    if (!electricityRateRecords.length || !jepxSpotRecords.length) return null;

    const cost = computeMarketCost(
      jepxSpotRecords,
      surchargeRecords,
      nonfossilFitRecords,
      nonfossilNonfitRecords,
    );

    const chartData = electricityRateRecords
      .map((r: { utility_company: string; average_unit_price: number }) => ({
        company: r.utility_company
          .replace("電力", "")
          .replace("EP", "")
          .replace("ミライズ", ""),
        price: r.average_unit_price,
      }))
      .sort((a, b) => b.price - a.price);

    const avgUtilityPrice =
      electricityRateRecords.reduce(
        (s: number, r: { average_unit_price: number }) => s + r.average_unit_price,
        0,
      ) / electricityRateRecords.length;

    const savingsPct = +(
      ((avgUtilityPrice - cost.total) / avgUtilityPrice) * 100
    ).toFixed(0);

    return { chartData, marketCost: cost.total, avgUtilityPrice: +avgUtilityPrice.toFixed(1), savingsPct };
  }, [electricityRateRecords, jepxSpotRecords, surchargeRecords, nonfossilFitRecords, nonfossilNonfitRecords]);

  if (!result) {
    return (
      <div className="bg-white rounded-lg border border-gray-200/80 border-l-4 border-l-purple-400 p-5 shadow-sm">
        <p className="text-xs text-gray-400">データ不足</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200/80 border-l-4 border-l-purple-400 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-purple-50 text-purple-500">
          <Scale className="h-3.5 w-3.5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">電力会社 vs 市場調達</h3>
          <p className="text-[10px] text-gray-400">特別高圧 平均単価比較</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xl font-bold text-green-600">
            -{result.savingsPct}
            <span className="text-xs font-normal text-gray-400 ml-1">% コスト削減</span>
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={result.chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
            domain={[0, "auto"]}
            tickFormatter={(v) => `${v}`}
          />
          <YAxis
            type="category"
            dataKey="company"
            tick={{ fontSize: 9, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
            formatter={(value) => [`${Number(value).toFixed(1)} 円/kWh`, "平均単価"]}
          />
          <ReferenceLine
            x={result.marketCost}
            stroke="#ef4444"
            strokeDasharray="6 3"
            strokeWidth={2}
            label={{
              value: `市場 ${result.marketCost.toFixed(1)}`,
              position: "top",
              fontSize: 10,
              fill: "#ef4444",
              fontWeight: 600,
            }}
          />
          <Bar dataKey="price" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {result.chartData.map((d, i) => (
              <Cell
                key={i}
                fill={d.price > result.marketCost ? "#a78bfa" : "#22c55e"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="bg-gray-50 rounded-md p-3 mt-3">
        <p className="text-[12px] text-gray-600 leading-relaxed">
          市場調達（スポット+賦課金+非化石）は{" "}
          <span className="font-semibold text-gray-900">{result.marketCost.toFixed(1)} 円/kWh</span>。
          電力会社平均 {result.avgUtilityPrice} 円/kWh と比較して約{" "}
          <span className="font-semibold text-green-600">{result.savingsPct}%</span> 低コスト。
          全社で市場調達が優位。
        </p>
      </div>
    </div>
  );
}
