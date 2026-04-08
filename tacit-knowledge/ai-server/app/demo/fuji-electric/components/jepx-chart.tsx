"use client";

import { useState, useMemo } from "react";
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

interface JepxRecord {
  delivery_date: string;
  system_price: number;
  tokyo_price: number;
  kansai_price: number;
  chubu_price: number;
  hokkaido_price: number;
  tohoku_price: number;
  hokuriku_price: number;
  chugoku_price: number;
  shikoku_price: number;
  kyushu_price: number;
}

interface JepxChartProps {
  data: JepxRecord[];
}

const AREA_LINES = [
  { key: "tokyo_price", label: "東京", color: "#6366f1" },
  { key: "kansai_price", label: "関西", color: "#06b6d4" },
  { key: "chubu_price", label: "中部", color: "#8b5cf6" },
  { key: "hokkaido_price", label: "北海道", color: "#f43f5e" },
  { key: "tohoku_price", label: "東北", color: "#f97316" },
  { key: "hokuriku_price", label: "北陸", color: "#14b8a6" },
  { key: "chugoku_price", label: "中国", color: "#a855f7" },
  { key: "shikoku_price", label: "四国", color: "#eab308" },
  { key: "kyushu_price", label: "九州", color: "#22c55e" },
] as const;

const RANGES = [
  { label: "7日", days: 7 },
  { label: "30日", days: 30 },
  { label: "全期間", days: 0 },
] as const;

export default function JepxChart({ data }: JepxChartProps) {
  const [range, setRange] = useState(30);
  const [showAreas, setShowAreas] = useState(false);

  const filtered = useMemo(() => {
    if (!data.length) return [];
    const sorted = [...data].sort(
      (a, b) => a.delivery_date.localeCompare(b.delivery_date)
    );
    if (range === 0) return sorted;
    return sorted.slice(-range);
  }, [data, range]);

  const formatDate = (d: string) => {
    const parts = d.split("-");
    return `${parts[1]}/${parts[2]}`;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200/80 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            JEPX スポット市場価格
          </h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            システムプライス日平均 (円/kWh)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAreas(!showAreas)}
            className={`text-[11px] px-2 py-1 rounded border transition-all ${
              showAreas
                ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}
          >
            エリア別
          </button>
          <div className="flex rounded border border-gray-200 overflow-hidden">
            {RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => setRange(r.days)}
                className={`text-[11px] px-2.5 py-1 transition-all ${
                  range === r.days
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={filtered}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="delivery_date"
            tickFormatter={formatDate}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v) => `${v}`}
          />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
            labelFormatter={(d) => `${d}`}
            formatter={(value) => [
              `${Number(value).toFixed(2)} 円/kWh`,
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 10 }}
            iconSize={8}
            iconType="circle"
          />
          <Line
            type="monotone"
            dataKey="system_price"
            name="システムプライス"
            stroke="#1e293b"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
          {showAreas &&
            AREA_LINES.map((area) => (
              <Line
                key={area.key}
                type="monotone"
                dataKey={area.key}
                name={area.label}
                stroke={area.color}
                strokeWidth={1}
                dot={false}
                strokeOpacity={0.6}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
