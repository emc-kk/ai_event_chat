"use client";

import Link from "next/link";
import {
  Mic,
  MessageCircleQuestion,
  Users,
  User,
  BellRing,
  ListChecks,
  ArrowRight,
  Clock,
  Zap,
  BarChart3,
} from "lucide-react";

interface DemoItem {
  num: number;
  href: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  time: string;
  tags: string[];
  accent: string;
}

interface DemoSection {
  label: string;
  subtitle: string;
  items: DemoItem[];
}

const DEMO_SECTIONS: DemoSection[] = [
  {
    label: "展示会デモ",
    subtitle: "来場者が自分で触れる暗黙知体験コンテンツ",
    items: [
      {
        num: 0.5,
        href: "/demo/exhibition/preset",
        title: "暗黙知体験（iPad用）",
        subtitle: "ゴルフ・ワイン・釣り・接待会食",
        description:
          "身近なテーマで暗黙知の引き出しを体験するiPad用コンテンツ。来場者が自分で触れる。",
        icon: ListChecks,
        time: "3-5分",
        accent: "border-l-green-500",
        tags: ["iPad", "プリセット", "フック"],
      },
    ],
  },
  {
    label: "大和エナジー・インフラ",
    subtitle: "インフラ投資判断の構造化プラットフォーム",
    items: [
      {
        num: 1,
        href: "/demo/daiwa/hearing",
        title: "ヒアリング",
        subtitle: "8ステップ判断プロセス",
        description:
          "インフラ投資案件に対して、8段階の構造化ヒアリングを実施。仮説検証型の反実仮想質問で暗黙知を引き出します。",
        icon: Mic,
        time: "10分",
        accent: "border-l-indigo-500",
        tags: ["8Step PBM", "反実仮想", "バイアス検出"],
      },
      {
        num: 2,
        href: "/demo/daiwa/qa",
        title: "Q&A",
        subtitle: "ナレッジ検索・回答",
        description:
          "ヒアリングで蓄積された知識に対してQ&Aを実行。新人教育やケーススタディの参照に活用できます。",
        icon: MessageCircleQuestion,
        time: "5分",
        accent: "border-l-emerald-500",
        tags: ["知識検索", "ハイブリッド検索", "出典付き"],
      },
      {
        num: 3,
        href: "/demo/daiwa/team",
        title: "チームビュー",
        subtitle: "レーダーチャート比較",
        description:
          "チーム全体の判断傾向を6軸レーダーで可視化。メンバー間の補完関係や偏りが一目瞭然です。",
        icon: Users,
        time: "5分",
        accent: "border-l-blue-500",
        tags: ["6軸プロファイル", "チーム比較", "判断傾向"],
      },
      {
        num: 4,
        href: "/demo/daiwa/individual",
        title: "個人ビュー",
        subtitle: "判断傾向分析",
        description:
          "個人の判断プロファイルの推移、バイアス検出履歴、コーチングポイントを詳細に表示します。",
        icon: User,
        time: "5分",
        accent: "border-l-violet-500",
        tags: ["個人プロファイル", "推移追跡", "コーチング"],
      },
      {
        num: 5,
        href: "/demo/daiwa/alerts",
        title: "アラート",
        subtitle: "L2 補正耐性の検知",
        description:
          "ソクラテス式補正に対する耐性を検知し、3段階のアラートで管理者にエスカレーションします。",
        icon: BellRing,
        time: "5分",
        accent: "border-l-rose-500",
        tags: ["3段階アラート", "補正耐性", "エスカレーション"],
      },
    ],
  },
  {
    label: "サントリー 梓の森工場",
    subtitle: "酒税法コンプライアンスの暗黙知構造化",
    items: [
      {
        num: 1,
        href: "/demo/suntory/topics",
        title: "トピック一覧",
        subtitle: "酒税法5軸・個別ヒアリング",
        description:
          "酒税法対応の5つの軸（樽庫巡回・度数測定・税務署対応・未納税移出・蒸留判断）ごとに、ヒアリングとQ&Aを実施。",
        icon: ListChecks,
        time: "15分",
        accent: "border-l-amber-500",
        tags: ["5軸トピック", "ヒアリング+Q&A", "暗黙知"],
      },
    ],
  },
  {
    label: "富士電機",
    subtitle: "エネルギー調達のデータ可視化プラットフォーム",
    items: [
      {
        num: 1,
        href: "/demo/fuji-electric",
        title: "エネルギー調達ダッシュボード",
        subtitle: "DataSource連携",
        description:
          "JEPXスポット市場価格、非化石証書オークション、再エネ賦課金の推移をリアルタイムで可視化。DataSourceインフラが自動収集したデータを表示。",
        icon: BarChart3,
        time: "リアルタイム",
        accent: "border-l-cyan-500",
        tags: ["JEPX", "非化石証書", "再エネ賦課金", "DataSource"],
      },
    ],
  },
];

export default function DemoHome() {
  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      {/* Hero */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-900">
            <Zap className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Demo
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          SkillRelay デモ
        </h1>
        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
          クライアント別のデモ機能を選択してください。
          各デモは独立して動作します。
        </p>
      </div>

      {DEMO_SECTIONS.map((section) => (
        <div key={section.label} className="mb-10">
          {/* Section header */}
          <div className="mb-4 flex items-baseline gap-3">
            <h2 className="text-base font-semibold text-gray-900">
              {section.label}
            </h2>
            <span className="text-xs text-gray-400">{section.subtitle}</span>
          </div>

          {/* Cards */}
          <div className="space-y-3">
            {section.items.map((demo) => {
              const Icon = demo.icon;
              return (
                <Link
                  key={demo.href}
                  href={demo.href}
                  className={`group flex items-start gap-4 p-4 bg-white rounded-lg border border-gray-200/80 border-l-[3px] ${demo.accent} hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:border-gray-300/80 transition-all`}
                >
                  {/* Icon */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-50 border border-gray-100 mt-0.5">
                    <Icon className="h-4 w-4 text-gray-500" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-100 h-4 w-4 rounded flex items-center justify-center leading-none">
                        {demo.num}
                      </span>
                      <h3 className="text-sm font-semibold text-gray-900">
                        {demo.title}
                      </h3>
                      <span className="text-[11px] text-gray-400">
                        {demo.subtitle}
                      </span>
                    </div>
                    <p className="text-[13px] text-gray-500 mt-1 leading-relaxed">
                      {demo.description}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2">
                      {demo.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex flex-col items-end gap-2 shrink-0 pt-0.5">
                    <div className="flex items-center gap-1 text-[11px] text-gray-400">
                      <Clock className="h-3 w-3" />
                      {demo.time}
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all mt-2" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
