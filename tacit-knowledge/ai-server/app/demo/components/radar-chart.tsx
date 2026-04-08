"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const AXIS_LABELS: Record<string, string> = {
  risk_sensitivity: "リスク感度",
  data_dependency: "データ依存度",
  precedent_dependency: "前例依存度",
  independence: "独立性",
  uncertainty_tolerance: "不確実性耐性",
  industry_understanding: "業界理解度",
};

const AXIS_ORDER = [
  "risk_sensitivity",
  "data_dependency",
  "precedent_dependency",
  "independence",
  "uncertainty_tolerance",
  "industry_understanding",
];

const COLORS = [
  "#6366f1", // indigo
  "#f43f5e", // rose
  "#10b981", // emerald
  "#f59e0b", // amber
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ef4444", // red
];

export interface ProfileData {
  [key: string]: number;
}

export interface RadarMember {
  name: string;
  profile: ProfileData;
  color?: string;
  opacity?: number;
  strokeDasharray?: string;
}

interface DemoRadarChartProps {
  members: RadarMember[];
  teamAverage?: ProfileData;
  showTeamAverage?: boolean;
  height?: number;
  highlightMember?: string | null;
}

export function DemoRadarChart({
  members,
  teamAverage,
  showTeamAverage = true,
  height = 450,
  highlightMember,
}: DemoRadarChartProps) {
  const data = AXIS_ORDER.map((axis) => {
    const entry: Record<string, string | number> = {
      axis: AXIS_LABELS[axis],
    };
    members.forEach((m) => {
      entry[m.name] = Math.round((m.profile[axis] || 0) * 100);
    });
    if (teamAverage && showTeamAverage) {
      entry["チーム平均"] = Math.round((teamAverage[axis] || 0) * 100);
    }
    return entry;
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis
          dataKey="axis"
          tick={{ fontSize: 13, fill: "#374151" }}
        />
        <PolarRadiusAxis
          angle={30}
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickCount={6}
        />
        {members.map((m, i) => {
          const isHighlighted = !highlightMember || highlightMember === m.name;
          const color = m.color || COLORS[i % COLORS.length];
          return (
            <Radar
              key={m.name}
              name={m.name}
              dataKey={m.name}
              stroke={color}
              fill={color}
              fillOpacity={isHighlighted ? (m.opacity ?? 0.15) : 0.02}
              strokeOpacity={isHighlighted ? 1 : 0.15}
              strokeWidth={isHighlighted ? 2 : 1}
              strokeDasharray={m.strokeDasharray}
            />
          );
        })}
        {teamAverage && showTeamAverage && (
          <Radar
            name="チーム平均"
            dataKey="チーム平均"
            stroke="#9ca3af"
            fill="#9ca3af"
            fillOpacity={0.08}
            strokeWidth={2}
            strokeDasharray="5 5"
          />
        )}
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          iconType="line"
        />
        <Tooltip
          formatter={(value) => [`${value}%`, ""]}
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            fontSize: 12,
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
