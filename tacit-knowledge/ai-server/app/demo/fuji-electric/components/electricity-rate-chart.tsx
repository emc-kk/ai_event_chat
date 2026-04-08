"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface ElectricityRateRecord {
  utility_company: string;
  contract_type: string;
  average_unit_price: number;
}

interface ElectricityRateChartProps {
  data: ElectricityRateRecord[];
}

const COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#c084fc",
  "#818cf8", "#7c3aed", "#6d28d9", "#5b21b6",
  "#4f46e5", "#4338ca",
];

export default function ElectricityRateChart({ data }: ElectricityRateChartProps) {
  const chartData = data.map((r) => ({
    company: r.utility_company.replace("電力", "").replace("EP", "").replace("ミライズ", ""),
    price: r.average_unit_price,
  }));

  return (
    <div className="bg-white rounded-lg border border-gray-200/80 p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          電気料金 平均単価
        </h3>
        <p className="text-[11px] text-gray-400 mt-0.5">
          電力会社別 特別高圧 (円/kWh)
        </p>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
            domain={[0, "auto"]}
          />
          <YAxis
            type="category"
            dataKey="company"
            tick={{ fontSize: 9, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
            width={60}
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
          <Bar dataKey="price" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {chartData.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
