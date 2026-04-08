"use client";

import { useState } from "react";
import { DemoRadarChart } from "../../components/radar-chart";
import teamData from "@/data/demo/daiwa-team-profiles.json";
import { Users, TrendingUp, AlertTriangle } from "lucide-react";

const BIAS_LABELS: Record<string, string> = {
  overconfidence: "過信",
  anchoring: "アンカリング",
  confirmation: "確証",
  authority: "権威",
  recency: "近時",
  optimism: "楽観",
  sunk_cost: "サンクコスト",
  groupthink: "集団思考",
};

export default function TeamPage() {
  const [highlightMember, setHighlightMember] = useState<string | null>(null);

  const radarMembers = teamData.members.map((m) => ({
    name: m.name,
    profile: m.profile,
  }));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
            <Users className="h-4 w-4 text-gray-600" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
            チーム判断プロファイル
          </h1>
        </div>
        <p className="text-xs text-gray-500 ml-11">
          {teamData.team_name} — {teamData.members.length}名 |
          総セッション数: {teamData.total_sessions} |
          データ信頼度: {teamData.data_confidence}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radar Chart (2/3 width) */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">
              6軸レーダー比較
            </h2>
            <button
              onClick={() => setHighlightMember(null)}
              className={`text-xs px-3 py-1 rounded-full transition-colors ${
                !highlightMember
                  ? "bg-gray-200 text-gray-800"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              全員表示
            </button>
          </div>
          <DemoRadarChart
            members={radarMembers}
            teamAverage={teamData.team_average}
            highlightMember={highlightMember}
            height={420}
          />
        </div>

        {/* Member list (1/3 width) */}
        <div className="bg-white rounded-lg border border-gray-200/80 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-3">メンバー一覧</h2>
          <div className="space-y-3">
            {teamData.members.map((member) => (
              <button
                key={member.id}
                onClick={() =>
                  setHighlightMember(
                    highlightMember === member.name ? null : member.name
                  )
                }
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  highlightMember === member.name
                    ? "border-indigo-300 bg-indigo-50"
                    : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-gray-900">
                      {member.name}
                    </p>
                    <p className="text-xs text-gray-500">{member.role}</p>
                  </div>
                  <span className="text-[10px] text-gray-400">
                    {member.years_experience}年
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-gray-400">
                    {member.total_sessions}セッション
                  </span>
                  {member.bias_tendency.primary && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        member.bias_tendency.frequency_score > 0.4
                          ? "bg-red-100 text-red-700"
                          : member.bias_tendency.frequency_score > 0.2
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {BIAS_LABELS[member.bias_tendency.primary] ||
                        member.bias_tendency.primary}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Team Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="bg-white rounded-lg border border-gray-200/80 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <h3 className="font-medium text-sm text-gray-800">チームの強み</h3>
          </div>
          <p className="text-sm text-gray-600">
            業界理解度（平均74%）とデータ依存度（平均73%）が高く、
            データに基づく堅実な判断ができるチーム構成です。
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200/80 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <h3 className="font-medium text-sm text-gray-800">
              チームの課題
            </h3>
          </div>
          <p className="text-sm text-gray-600">
            不確実性耐性（平均48%）と独立性（平均54%）が低めです。
            曖昧な状況での判断力強化と、独立した意見形成の促進が課題です。
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200/80 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-blue-500" />
            <h3 className="font-medium text-sm text-gray-800">
              補完関係
            </h3>
          </div>
          <p className="text-sm text-gray-600">
            田中（独立性88%）と鈴木（データ依存度92%）の組み合わせが最も効果的。
            佐藤のペア審査には鈴木を推奨。
          </p>
        </div>
      </div>
    </div>
  );
}
