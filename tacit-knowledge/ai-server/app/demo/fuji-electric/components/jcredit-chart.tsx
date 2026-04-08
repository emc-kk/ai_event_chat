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

interface JCreditRecord {
  period: string;
  energy_saving_price: number;
  re_electricity_price: number;
  forest_price: number;
}

interface JCreditChartProps {
  data: JCreditRecord[];
}

export default function JCreditChart({ data }: JCreditChartProps) {
  const sorted = [...data].sort((a, b) => a.period.localeCompare(b.period));

  return (
    <div className="bg-white rounded-lg border border-gray-200/80 p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          J-クレジット 価格推移
        </h3>
        <p className="text-[11px] text-gray-400 mt-0.5">
          カテゴリ別月次平均 (円/t-CO2)
        </p>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={sorted}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 9, fill: "#9ca3af" }}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={false}
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
          <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
          <Line
            type="monotone"
            dataKey="energy_saving_price"
            name="省エネ"
            stroke="#06b6d4"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="re_electricity_price"
            name="再エネ電力"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="forest_price"
            name="森林"
            stroke="#84cc16"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
