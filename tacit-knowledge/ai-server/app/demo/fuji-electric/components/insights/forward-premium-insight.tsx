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
import { TrendingUp } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ForwardPremiumInsightProps {
  jepxSpotRecords: any[];
  forwardRecords: any[];
}

export default function ForwardPremiumInsight({
  jepxSpotRecords,
  forwardRecords,
}: ForwardPremiumInsightProps) {
  const result = useMemo(() => {
    if (!jepxSpotRecords.length || !forwardRecords.length) return null;

    // スポット直近30日平均
    const sorted = [...jepxSpotRecords].sort((a, b) =>
      a.delivery_date.localeCompare(b.delivery_date)
    );
    const recent = sorted.slice(-30);
    const spotAvg = recent.reduce((s, r) => s + r.system_price, 0) / recent.length;

    // 先渡: 受渡月別に平均約定価格
    const grouped: Record<string, number[]> = {};
    for (const r of forwardRecords) {
      if (!grouped[r.delivery_month]) grouped[r.delivery_month] = [];
      grouped[r.delivery_month].push(r.settlement_price);
    }

    const chartData = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, prices]) => {
        const fwdAvg = prices.reduce((s, p) => s + p, 0) / prices.length;
        const premiumPct = ((fwdAvg - spotAvg) / spotAvg) * 100;
        return {
          month: month.replace("2026-", "") + "月",
          forwardPrice: +fwdAvg.toFixed(2),
          premiumPct: +premiumPct.toFixed(1),
        };
      });

    const avgPremiumPct =
      chartData.reduce((s, d) => s + d.premiumPct, 0) / chartData.length;

    const maxMonth = chartData.reduce(
      (max, d) => (d.premiumPct > max.premiumPct ? d : max),
      chartData[0],
    );

    return { chartData, spotAvg: +spotAvg.toFixed(2), avgPremiumPct: +avgPremiumPct.toFixed(1), maxMonth };
  }, [jepxSpotRecords, forwardRecords]);

  if (!result) {
    return (
      <div className="bg-white rounded-lg border border-gray-200/80 border-l-4 border-l-violet-400 p-5 shadow-sm">
        <p className="text-xs text-gray-400">データ不足</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200/80 border-l-4 border-l-violet-400 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-violet-50 text-violet-500">
          <TrendingUp className="h-3.5 w-3.5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">先渡プレミアム</h3>
          <p className="text-[10px] text-gray-400">スポット比 受渡月別</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xl font-bold text-gray-900">
            {result.avgPremiumPct > 0 ? "+" : ""}{result.avgPremiumPct}
            <span className="text-xs font-normal text-gray-400 ml-1">% 平均</span>
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={result.chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
            formatter={(value, name) => {
              if (name === "premiumPct")
                return [`${Number(value) > 0 ? "+" : ""}${Number(value).toFixed(1)}%`, "プレミアム"];
              return [value];
            }}
            labelFormatter={(label) => `${label}渡し (スポット平均: ${result.spotAvg} 円/kWh)`}
          />
          <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
          <Bar dataKey="premiumPct" radius={[4, 4, 0, 0]} maxBarSize={36}>
            {result.chartData.map((d, i) => (
              <Cell
                key={i}
                fill={d.premiumPct >= 0 ? "#f97316" : "#22c55e"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="bg-gray-50 rounded-md p-3 mt-3">
        <p className="text-[12px] text-gray-600 leading-relaxed">
          先渡市場はスポット平均 ({result.spotAvg} 円/kWh) に対し平均{" "}
          <span className="font-semibold text-gray-900">
            {result.avgPremiumPct > 0 ? "+" : ""}{result.avgPremiumPct}%
          </span>{" "}
          のプレミアム。{result.maxMonth.month}渡しが最大 (+{result.maxMonth.premiumPct}%) で、夏季の需要増加見込みを反映。
        </p>
      </div>
    </div>
  );
}
