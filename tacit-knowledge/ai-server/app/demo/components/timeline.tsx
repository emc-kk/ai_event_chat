"use client";

import {
  AlertTriangle,
  MessageCircle,
  Bell,
  AlertOctagon,
  CheckCircle,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  "alert-triangle": AlertTriangle,
  "message-circle": MessageCircle,
  bell: Bell,
  "alert-octagon": AlertOctagon,
  "check-circle": CheckCircle,
};

const COLOR_MAP: Record<string, string> = {
  yellow: "bg-yellow-100 text-yellow-700 border-yellow-300",
  blue: "bg-blue-100 text-blue-700 border-blue-300",
  orange: "bg-orange-100 text-orange-700 border-orange-300",
  red: "bg-red-100 text-red-700 border-red-300",
  green: "bg-green-100 text-green-700 border-green-300",
  gray: "bg-gray-100 text-gray-700 border-gray-300",
};

const DOT_COLOR_MAP: Record<string, string> = {
  yellow: "bg-yellow-400",
  blue: "bg-blue-400",
  orange: "bg-orange-400",
  red: "bg-red-500",
  green: "bg-green-400",
  gray: "bg-gray-400",
};

export interface TimelineEvent {
  date: string;
  event_type: string;
  icon: string;
  color: string;
  title: string;
  description: string;
  hearing_name?: string;
  result?: string;
}

interface TimelineProps {
  events: TimelineEvent[];
}

export function Timeline({ events }: TimelineProps) {
  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />

      <div className="space-y-6">
        {events.map((event, i) => {
          const Icon = ICON_MAP[event.icon] || Bell;
          const colorClass = COLOR_MAP[event.color] || COLOR_MAP.gray;
          const dotColor = DOT_COLOR_MAP[event.color] || DOT_COLOR_MAP.gray;

          return (
            <div key={i} className="relative flex gap-4 pl-2">
              {/* Dot on the line */}
              <div
                className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white ${dotColor}`}
              >
                <Icon className="h-3.5 w-3.5 text-white" />
              </div>

              {/* Content */}
              <div
                className={`flex-1 rounded-lg border p-3 ${colorClass}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">{event.title}</span>
                  <span className="text-xs opacity-70">{event.date}</span>
                </div>
                <p className="text-sm opacity-90">{event.description}</p>
                {event.hearing_name && (
                  <p className="text-xs mt-1 opacity-60">
                    案件: {event.hearing_name}
                  </p>
                )}
                {event.result && (
                  <span
                    className={`inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full ${
                      event.result === "corrected"
                        ? "bg-green-200 text-green-800"
                        : event.result === "partially_corrected"
                          ? "bg-yellow-200 text-yellow-800"
                          : "bg-red-200 text-red-800"
                    }`}
                  >
                    {event.result === "corrected"
                      ? "補正済"
                      : event.result === "partially_corrected"
                        ? "一部補正"
                        : "未補正"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
