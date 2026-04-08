"use client";

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

interface CarbonCreditRecord {
  trade_date: string;
  trade_category: string;
  close_price: number;
  volume: number;
}

interface CarbonCreditChartProps {
  data: CarbonCreditRecord[];
}

export default function CarbonCreditChart({ data }: CarbonCreditChartProps) {
  // 日付ごとにカテゴリ別価格をマージ
  const merged = (() => {
    const map = new Map<
      string,
      { date: string; energy_saving: number | null; re_electricity: number | null; forest: number | null }
    >();

    for (const r of data) {
      const existing = map.get(r.trade_date) || {
        date: r.trade_date,
        energy_saving: null,
        re_electricity: null,
        forest: null,
      };
      if (r.trade_category.includes("省エネ")) existing.energy_saving = r.close_price;
      else if (r.trade_category.includes("再エネ")) existing.re_electricity = r.close_price;
      else if (r.trade_category.includes("森林")) existing.forest = r.close_price;
      map.set(r.trade_date, existing);
    }

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  })();

  return (
    <div className="bg-white rounded-lg border border-gray-200/80 p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          カーボン・クレジット市場
        </h3>
        <p className="text-[11px] text-gray-400 mt-0.5">
          カテゴリ別終値 (円/t-CO2)
        </p>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={merged} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: "#9ca3af" }}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={false}
            tickFormatter={(v) => v.replace("2026-", "")}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
            width={50}
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
          <Bar dataKey="energy_saving" name="省エネ" fill="#06b6d4" radius={[3, 3, 0, 0]} maxBarSize={16} />
          <Bar dataKey="re_electricity" name="再エネ電力" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={16} />
          <Bar dataKey="forest" name="森林" fill="#84cc16" radius={[3, 3, 0, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
