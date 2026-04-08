"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Mic,
  MessageCircleQuestion,
  Users,
  User,
  BellRing,
  LayoutDashboard,
  ListChecks,
  Zap,
  ChevronRight,
  BarChart3,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  subtitle?: string;
  icon: React.ElementType;
  time?: string;
}

interface NavSection {
  label: string | null;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    label: null,
    items: [{ href: "/demo", label: "概要", icon: LayoutDashboard }],
  },
  {
    label: "大和エナジー・インフラ",
    items: [
      {
        href: "/demo/daiwa/hearing",
        label: "ヒアリング",
        subtitle: "8ステップ",
        icon: Mic,
        time: "10分",
      },
      {
        href: "/demo/daiwa/qa",
        label: "Q&A",
        subtitle: "知識検索",
        icon: MessageCircleQuestion,
        time: "5分",
      },
      {
        href: "/demo/daiwa/team",
        label: "チームビュー",
        subtitle: "レーダー比較",
        icon: Users,
        time: "5分",
      },
      {
        href: "/demo/daiwa/individual",
        label: "個人ビュー",
        subtitle: "判断傾向",
        icon: User,
        time: "5分",
      },
      {
        href: "/demo/daiwa/alerts",
        label: "アラート",
        subtitle: "補正耐性",
        icon: BellRing,
        time: "5分",
      },
    ],
  },
  {
    label: "サントリー 梓の森工場",
    items: [
      {
        href: "/demo/suntory/topics",
        label: "トピック一覧",
        subtitle: "酒税法5軸",
        icon: ListChecks,
        time: "15分",
      },
    ],
  },
  {
    label: "富士電機",
    items: [
      {
        href: "/demo/fuji-electric",
        label: "エネルギー調達",
        subtitle: "DataSource連携",
        icon: BarChart3,
        time: "リアルタイム",
      },
    ],
  },
];

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isFullscreen = pathname.startsWith("/demo/exhibition/preset");

  if (isFullscreen) {
    return (
      <div className="h-screen bg-white overflow-hidden">{children}</div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f8f9fb]">
      {/* Sidebar */}
      <nav className="w-60 bg-white border-r border-gray-200/80 flex flex-col shadow-[1px_0_3px_rgba(0,0,0,0.03)]">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-900 tracking-tight">
                SkillRelay
              </h1>
              <p className="text-[10px] text-gray-400 leading-none mt-0.5">
                JudgmentOS v3.0
              </p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <div className="flex-1 py-3 px-3 overflow-y-auto">
          {SECTIONS.map((section, sIdx) => (
            <div key={sIdx} className={sIdx > 0 ? "mt-5" : ""}>
              {section.label && (
                <p className="text-[10px] uppercase tracking-wider text-gray-400 px-2 pb-2 font-medium">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive =
                    item.href === "/demo"
                      ? pathname === "/demo"
                      : pathname.startsWith(item.href) &&
                        item.href !== "/demo";
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-all ${
                        isActive
                          ? "bg-gray-900 text-white shadow-sm"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <Icon
                        className={`h-3.5 w-3.5 shrink-0 ${
                          isActive ? "text-gray-300" : "text-gray-400"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{item.label}</span>
                        {item.subtitle && (
                          <p
                            className={`text-[10px] leading-tight mt-0.5 ${
                              isActive ? "text-gray-400" : "text-gray-400"
                            }`}
                          >
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                      {item.time && (
                        <span
                          className={`text-[10px] shrink-0 ${
                            isActive ? "text-gray-500" : "text-gray-300"
                          }`}
                        >
                          {item.time}
                        </span>
                      )}
                      {isActive && (
                        <ChevronRight className="h-3 w-3 shrink-0 text-gray-500" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-gray-400">
              taiziii Inc.
            </p>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 font-medium uppercase tracking-wide">
              Demo
            </span>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
