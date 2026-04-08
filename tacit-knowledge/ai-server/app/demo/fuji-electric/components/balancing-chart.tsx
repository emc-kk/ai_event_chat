"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface BalancingRecord {
  settlement_date: string;
  product_type: string;
  area: string;
  settled_volume_kw: number;
  settlement_price: number;
}

interface BalancingChartProps {
  data: BalancingRecord[];
}

export default function BalancingChart({ data }: BalancingChartProps) {
  // 日付×エリアでマージ
  const merged = (() => {
    const map = new Map<string, { date: string; tokyo: number | null; kansai: number | null }>();

    for (const r of data) {
      const existing = map.get(r.settlement_date) || {
        date: r.settlement_date,
        tokyo: null,
        kansai: null,
      };
      if (r.area.includes("東京")) existing.tokyo = r.settlement_price;
      else if (r.area.includes("関西")) existing.kansai = r.settlement_price;
      map.set(r.settlement_date, existing);
    }

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  })();

  return (
    <div className="bg-white rounded-lg border border-gray-200/80 p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          需給調整市場 約定単価
        </h3>
        <p className="text-[11px] text-gray-400 mt-0.5">
          三次調整力② エリア別 (円/kW)
        </p>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={merged}>
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
            width={35}
          />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
            formatter={(value) => [`${Number(value).toFixed(1)} 円/kW`]}
            labelFormatter={(label) => String(label).replace("2026-", "")}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
          <Line
            type="monotone"
            dataKey="tokyo"
            name="東京"
            stroke="#ef4444"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="kansai"
            name="関西"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
