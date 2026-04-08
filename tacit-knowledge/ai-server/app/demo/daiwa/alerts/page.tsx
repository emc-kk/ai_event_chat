"use client";

import { useState } from "react";
import { Timeline } from "../../components/timeline";
import alertsData from "@/data/demo/daiwa-alerts.json";
import {
  BellRing,
  AlertTriangle,
  AlertOctagon,
  Bell,
  CheckCircle,
  Shield,
  ChevronRight,
} from "lucide-react";

const LEVEL_STYLES: Record<
  string,
  { bg: string; border: string; icon: string; badge: string }
> = {
  L1: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: "text-blue-500",
    badge: "bg-blue-100 text-blue-700",
  },
  L2: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    icon: "text-orange-500",
    badge: "bg-orange-100 text-orange-700",
  },
  L3: {
    bg: "bg-red-50",
    border: "border-red-200",
    icon: "text-red-500",
    badge: "bg-red-100 text-red-700",
  },
};

export default function AlertsPage() {
  const [selectedAlertId, setSelectedAlertId] = useState(
    alertsData.active_alerts[0]?.id || null
  );

  const selectedAlert = alertsData.active_alerts.find(
    (a) => a.id === selectedAlertId
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
            <BellRing className="h-4 w-4 text-gray-600" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
            アラートダッシュボード
          </h1>
        </div>
        <p className="text-xs text-gray-500 ml-11">
          期間: {alertsData.alert_summary.period}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-lg border border-gray-200/80 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-[11px] font-medium text-gray-500">
              L1 Trend
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1.5">
            {alertsData.alert_summary.total_L1}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">バイアス傾向の検知</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200/80 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-[11px] font-medium text-gray-500">
              L2 Resistance
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1.5">
            {alertsData.alert_summary.total_L2}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">補正耐性の検知</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200/80 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertOctagon className="h-3.5 w-3.5 text-red-500" />
            <span className="text-[11px] font-medium text-gray-500">
              L3 Drift
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1.5">
            {alertsData.alert_summary.total_L3}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">判断基準の逸脱</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200/80 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-[11px] font-medium text-gray-500">
              解決済み
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1.5">
            {alertsData.resolved_alerts.length}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">介入により改善</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alert list */}
        <div className="bg-white rounded-lg border border-gray-200/80 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-3">
            アクティブアラート
          </h2>
          <div className="space-y-2">
            {alertsData.active_alerts.map((alert) => {
              const style = LEVEL_STYLES[alert.level] || LEVEL_STYLES.L1;
              const isSelected = selectedAlertId === alert.id;
              return (
                <button
                  key={alert.id}
                  onClick={() => setSelectedAlertId(alert.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    isSelected
                      ? `${style.bg} ${style.border}`
                      : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${style.badge}`}
                    >
                      {alert.level}
                    </span>
                    <span className="font-medium text-sm text-gray-900">
                      {alert.member_name}
                    </span>
                    <ChevronRight
                      className={`h-3.5 w-3.5 ml-auto transition-transform ${
                        isSelected ? "rotate-90 text-gray-600" : "text-gray-300"
                      }`}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    {alert.bias_label} — {alert.member_role}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Resolved alerts */}
          <h3 className="font-medium text-gray-600 text-sm mt-5 mb-2">
            解決済み
          </h3>
          <div className="space-y-2">
            {alertsData.resolved_alerts.map((alert) => (
              <div
                key={alert.id}
                className="p-3 rounded-lg border border-gray-100 bg-gray-50 opacity-60"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                    {alert.level}
                  </span>
                  <span className="text-sm text-gray-700 line-through">
                    {alert.member_name}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{alert.resolution}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Alert detail */}
        <div className="lg:col-span-2">
          {selectedAlert ? (
            <div className="space-y-4">
              {/* Alert detail card */}
              <div
                className={`rounded-lg border p-5 shadow-sm ${
                  LEVEL_STYLES[selectedAlert.level]?.bg || "bg-gray-50"
                } ${LEVEL_STYLES[selectedAlert.level]?.border || "border-gray-200"}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Shield
                    className={`h-5 w-5 ${
                      LEVEL_STYLES[selectedAlert.level]?.icon || "text-gray-500"
                    }`}
                  />
                  <div>
                    <h2 className="font-bold text-gray-900">
                      {selectedAlert.level_name} — {selectedAlert.bias_label}
                    </h2>
                    <p className="text-xs text-gray-500">
                      {selectedAlert.member_name} ({selectedAlert.member_role})
                      | 発行:{" "}
                      {new Date(selectedAlert.created_at).toLocaleDateString(
                        "ja-JP"
                      )}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-700">
                  {selectedAlert.description}
                </p>
              </div>

              {/* Recommended action */}
              <div className="bg-white rounded-lg border border-gray-200/80 p-5 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-2">
                  推奨アクション
                </h3>
                <p className="text-sm text-gray-700">
                  {selectedAlert.recommended_action}
                </p>
              </div>

              {/* Timeline */}
              {"timeline" in selectedAlert &&
                selectedAlert.timeline && (
                  <div className="bg-white rounded-lg border border-gray-200/80 p-5 shadow-sm">
                    <h3 className="font-semibold text-gray-800 mb-4">
                      エスカレーションタイムライン
                    </h3>
                    <Timeline events={selectedAlert.timeline} />
                  </div>
                )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 bg-white rounded-lg border border-gray-200/80">
              <p className="text-gray-400">
                左のリストからアラートを選択してください
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
