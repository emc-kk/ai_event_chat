"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Repeat2 } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface CarbonComparisonInsightProps {
  carbonCreditRecords: any[];
  jcreditRecords: any[];
}

export default function CarbonComparisonInsight({
  carbonCreditRecords,
  jcreditRecords,
}: CarbonComparisonInsightProps) {
  const result = useMemo(() => {
    if (!carbonCreditRecords.length || !jcreditRecords.length) return null;

    // 取引所: 最新日のカテゴリ別終値
    const latestDate = [...carbonCreditRecords]
      .sort((a, b) => b.trade_date.localeCompare(a.trade_date))[0]?.trade_date;

    const exchange: Record<string, number> = {};
    for (const r of carbonCreditRecords) {
      if (r.trade_date === latestDate) {
        if (r.trade_category.includes("省エネ")) exchange["energy_saving"] = r.close_price;
        else if (r.trade_category.includes("再エネ")) exchange["re_electricity"] = r.close_price;
        else if (r.trade_category.includes("森林")) exchange["forest"] = r.close_price;
      }
    }

    // J-クレジット: 最新期間
    const latestJCredit = [...jcreditRecords]
      .sort((a, b) => b.period.localeCompare(a.period))[0];

    if (!latestJCredit) return null;

    const categories = [
      {
        category: "省エネ",
        exchange: exchange["energy_saving"] ?? 0,
        jcredit: latestJCredit.energy_saving_price ?? 0,
      },
      {
        category: "再エネ電力",
        exchange: exchange["re_electricity"] ?? 0,
        jcredit: latestJCredit.re_electricity_price ?? 0,
      },
      {
        category: "森林",
        exchange: exchange["forest"] ?? 0,
        jcredit: latestJCredit.forest_price ?? 0,
      },
    ];

    const chartData = categories.map((c) => ({
      ...c,
      diff: c.jcredit - c.exchange,
      diffPct: c.exchange > 0 ? +(((c.jcredit - c.exchange) / c.exchange) * 100).toFixed(1) : 0,
    }));

    // 最も差が大きいカテゴリ
    const maxDiff = chartData.reduce(
      (max, d) => (Math.abs(d.diffPct) > Math.abs(max.diffPct) ? d : max),
      chartData[0],
    );

    return { chartData, latestDate, latestPeriod: latestJCredit.period, maxDiff };
  }, [carbonCreditRecords, jcreditRecords]);

  if (!result) {
    return (
      <div className="bg-white rounded-lg border border-gray-200/80 border-l-4 border-l-cyan-400 p-5 shadow-sm">
        <p className="text-xs text-gray-400">データ不足</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200/80 border-l-4 border-l-cyan-400 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-cyan-50 text-cyan-500">
          <Repeat2 className="h-3.5 w-3.5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">カーボンクレジット市場比較</h3>
          <p className="text-[10px] text-gray-400">取引所 vs J-クレジット (円/t-CO2)</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={result.chartData} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="category"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
            width={50}
            tickFormatter={(v) => v.toLocaleString()}
          />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
            formatter={(value) => [`${Number(value).toLocaleString()} 円/t-CO2`]}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} iconType="square" />
          <Bar
            dataKey="exchange"
            name="取引所"
            fill="#06b6d4"
            radius={[3, 3, 0, 0]}
            maxBarSize={28}
          />
          <Bar
            dataKey="jcredit"
            name="J-クレジット"
            fill="#14b8a6"
            radius={[3, 3, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>

      <div className="bg-gray-50 rounded-md p-3 mt-3">
        <p className="text-[12px] text-gray-600 leading-relaxed">
          {result.maxDiff.category}カテゴリ: J-クレジット ({result.maxDiff.jcredit.toLocaleString()}円) は
          取引所 ({result.maxDiff.exchange.toLocaleString()}円) に対し{" "}
          <span className="font-semibold text-gray-900">
            {result.maxDiff.diffPct > 0 ? "+" : ""}{result.maxDiff.diffPct}%
          </span>
          。調達先の選択でコスト最適化の余地あり。
        </p>
      </div>
    </div>
  );
}
