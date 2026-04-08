"use client";

import { useState } from "react";
import { DemoRadarChart } from "../../components/radar-chart";
import teamData from "@/data/demo/daiwa-team-profiles.json";
import {
  User,
  TrendingDown,
  Lightbulb,
  Calendar,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const BIAS_LABELS: Record<string, string> = {
  overconfidence: "過信バイアス",
  anchoring: "アンカリング",
  confirmation: "確証バイアス",
  authority: "権威バイアス",
  recency: "近時バイアス",
  optimism: "楽観バイアス",
  sunk_cost: "サンクコスト",
  groupthink: "集団思考",
};

const RESULT_LABELS: Record<string, { label: string; color: string }> = {
  corrected: { label: "補正済", color: "bg-green-100 text-green-700" },
  partially_corrected: {
    label: "一部補正",
    color: "bg-yellow-100 text-yellow-700",
  },
  not_corrected: { label: "未補正", color: "bg-red-100 text-red-700" },
};

export default function IndividualPage() {
  const [selectedId, setSelectedId] = useState("member-003");
  const [showAllHistory, setShowAllHistory] = useState(false);

  const member = teamData.members.find((m) => m.id === selectedId)!;
  const memberAny = member as typeof teamData.members[2];
  const biasHistory = memberAny.bias_history ?? [];
  const coaching = memberAny.coaching_narrative ?? null;
  const interventions = memberAny.recommended_interventions ?? null;

  // Build radar data with historical overlay
  const radarMembers = [];

  // Add historical profiles if available
  if (member.profile_history && member.profile_history.length > 0) {
    const oldest = member.profile_history[0];
    radarMembers.push({
      name: `${oldest.month}`,
      profile: oldest.profile,
      color: "#d1d5db",
      opacity: 0.05,
      strokeDasharray: "5 5",
    });
  }

  // Current profile
  radarMembers.push({
    name: `${member.name}（現在）`,
    profile: member.profile,
    color: "#6366f1",
    opacity: 0.2,
  });

  const displayHistory = showAllHistory
    ? biasHistory
    : biasHistory.slice(0, 4);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header with member selector */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
            <User className="h-4 w-4 text-gray-600" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
            個人判断プロファイル
          </h1>
        </div>
        <div className="flex items-center gap-3 ml-11">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="text-sm border border-gray-200/80 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 shadow-sm"
          >
            {teamData.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — {m.role}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-500">
            経験: {member.years_experience}年 | {member.total_sessions}
            セッション | {member.specialization}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar with history overlay */}
        <div className="bg-white rounded-lg border border-gray-200/80 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-1">
            プロファイル推移
          </h2>
          <p className="text-xs text-gray-400 mb-3">
            点線: {member.profile_history?.[0]?.month || "過去"} → 実線: 現在
          </p>
          <DemoRadarChart
            members={radarMembers}
            showTeamAverage={false}
            height={380}
          />
        </div>

        {/* Coaching narrative */}
        <div className="space-y-4">
          {coaching && (
            <div className="bg-white rounded-lg border border-gray-200/80 border-l-[3px] border-l-violet-400 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="h-4 w-4 text-violet-500" />
                <h2 className="font-semibold text-gray-900 text-sm">
                  この人にはこの指導が必要
                </h2>
              </div>
              <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-line">
                {coaching}
              </p>
            </div>
          )}

          {interventions && interventions.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200/80 p-5 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-3">
                推奨介入
              </h2>
              <ul className="space-y-2">
                {interventions.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-lg border border-gray-200/80 p-4 shadow-sm">
              <p className="text-xs text-gray-500">主要バイアス</p>
              <p className="text-lg font-bold text-red-600 mt-1">
                {BIAS_LABELS[member.bias_tendency.primary] ||
                  member.bias_tendency.primary}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                頻度スコア: {Math.round(member.bias_tendency.frequency_score * 100)}%
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200/80 p-4 shadow-sm">
              <div className="flex items-center gap-1">
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                <p className="text-xs text-gray-500">独立性推移</p>
              </div>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {Math.round(
                  (member.profile_history?.[0]?.profile.independence || 0) * 100
                )}
                % →{" "}
                {Math.round(member.profile.independence * 100)}%
              </p>
              <p className="text-xs text-red-500 mt-0.5">3ヶ月で低下</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bias history table */}
      {biasHistory.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200/80 p-5 shadow-sm mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <h2 className="font-semibold text-gray-800">
                バイアス検出履歴
              </h2>
              <span className="text-xs text-gray-400">
                ({biasHistory.length}件)
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">
                    日付
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">
                    案件
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">
                    バイアス
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">
                    トリガー発言
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">
                    ソクラテス質問
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">
                    結果
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayHistory.map((entry, i) => {
                  const result = RESULT_LABELS[entry.result] || {
                    label: entry.result,
                    color: "bg-gray-100 text-gray-700",
                  };
                  return (
                    <tr
                      key={i}
                      className="border-b border-gray-50 hover:bg-gray-50"
                    >
                      <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">
                        {entry.date}
                      </td>
                      <td className="py-2.5 px-3 text-gray-700">
                        {entry.hearing_name}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                          {BIAS_LABELS[entry.bias_type] || entry.bias_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 max-w-xs truncate">
                        「{entry.trigger_text}」
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 max-w-xs truncate">
                        {entry.socratic_response}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${result.color}`}
                        >
                          {result.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {biasHistory.length > 4 && (
            <button
              onClick={() => setShowAllHistory(!showAllHistory)}
              className="flex items-center gap-1 mt-3 text-sm text-indigo-600 hover:text-indigo-700"
            >
              {showAllHistory ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  折りたたむ
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  すべて表示 ({biasHistory.length}件)
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
