"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface SurchargeRecord {
  fiscal_year: string;
  surcharge_rate: number;
}

interface SurchargeChartProps {
  data: SurchargeRecord[];
}

export default function SurchargeChart({ data }: SurchargeChartProps) {
  const sorted = [...data].sort((a, b) =>
    a.fiscal_year.localeCompare(b.fiscal_year)
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200/80 p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          再エネ賦課金 年次推移
        </h3>
        <p className="text-[11px] text-gray-400 mt-0.5">
          年度別単価 (円/kWh)
        </p>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={sorted}>
          <defs>
            <linearGradient id="surchargeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="fiscal_year"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
            width={40}
            domain={[0, "auto"]}
          />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
            formatter={(value) => [`${Number(value).toFixed(2)} 円/kWh`, "賦課金単価"]}
            labelFormatter={(label) => `${label}年度`}
          />
          <Area
            type="monotone"
            dataKey="surcharge_rate"
            stroke="#f59e0b"
            strokeWidth={2}
            fill="url(#surchargeGradient)"
            dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#f59e0b" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
