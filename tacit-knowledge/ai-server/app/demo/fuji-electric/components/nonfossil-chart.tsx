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

interface NonfossilRecord {
  fiscal_year: number;
  round: number;
  settlement_price: number;
  volume_gwh: number;
}

interface NonfossilChartProps {
  fitData: NonfossilRecord[];
  nonfitData: NonfossilRecord[];
}

export default function NonfossilChart({
  fitData,
  nonfitData,
}: NonfossilChartProps) {
  // 回ごとにFIT/非FITをマージ
  const merged = (() => {
    const map = new Map<
      string,
      { label: string; fit_price: number | null; nonfit_price: number | null }
    >();

    for (const r of fitData) {
      const key = `${r.fiscal_year}-${r.round}`;
      const label = `${r.fiscal_year}年 第${r.round}回`;
      const existing = map.get(key) || { label, fit_price: null, nonfit_price: null };
      existing.fit_price = r.settlement_price;
      map.set(key, existing);
    }
    for (const r of nonfitData) {
      const key = `${r.fiscal_year}-${r.round}`;
      const label = `${r.fiscal_year}年 第${r.round}回`;
      const existing = map.get(key) || { label, fit_price: null, nonfit_price: null };
      existing.nonfit_price = r.settlement_price;
      map.set(key, existing);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  })();

  return (
    <div className="bg-white rounded-lg border border-gray-200/80 p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          非化石証書 オークション約定価格
        </h3>
        <p className="text-[11px] text-gray-400 mt-0.5">
          FIT / 非FIT 約定単価推移 (円/kWh)
        </p>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={merged} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: "#9ca3af" }}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={false}
            angle={-30}
            textAnchor="end"
            height={50}
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
            formatter={(value) => [
              `${Number(value).toFixed(2)} 円/kWh`,
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 10 }}
            iconSize={8}
            iconType="square"
          />
          <Bar
            dataKey="fit_price"
            name="FIT"
            fill="#10b981"
            radius={[3, 3, 0, 0]}
            maxBarSize={20}
          />
          <Bar
            dataKey="nonfit_price"
            name="非FIT"
            fill="#3b82f6"
            radius={[3, 3, 0, 0]}
            maxBarSize={20}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
