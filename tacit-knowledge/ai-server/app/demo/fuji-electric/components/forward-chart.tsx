"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ForwardRecord {
  settlement_date: string;
  delivery_month: string;
  settlement_price: number;
  settled_volume: number;
}

interface ForwardChartProps {
  data: ForwardRecord[];
}

export default function ForwardChart({ data }: ForwardChartProps) {
  const sorted = [...data].sort((a, b) =>
    a.delivery_month.localeCompare(b.delivery_month)
  );

  // 受渡月でグループ化し平均約定価格を算出
  const grouped = sorted.reduce(
    (acc, r) => {
      if (!acc[r.delivery_month]) {
        acc[r.delivery_month] = { prices: [], volumes: [] };
      }
      acc[r.delivery_month].prices.push(r.settlement_price);
      acc[r.delivery_month].volumes.push(r.settled_volume);
      return acc;
    },
    {} as Record<string, { prices: number[]; volumes: number[] }>
  );

  const chartData = Object.entries(grouped).map(([month, { prices, volumes }]) => ({
    month: month.replace("2026-", ""),
    avg_price: +(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2),
    total_volume: volumes.reduce((a, b) => a + b, 0),
  }));

  return (
    <div className="bg-white rounded-lg border border-gray-200/80 p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          先渡市場 約定価格
        </h3>
        <p className="text-[11px] text-gray-400 mt-0.5">
          受渡月別 平均約定単価 (円/kWh)
        </p>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData}>
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
          />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
            formatter={(value) => [`${Number(value).toFixed(2)} 円/kWh`, "平均約定単価"]}
            labelFormatter={(label) => `${label}月渡し`}
          />
          <Bar
            dataKey="avg_price"
            fill="#8b5cf6"
            radius={[4, 4, 0, 0]}
            maxBarSize={30}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
