"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { nanoid } from "nanoid";
import { Mic, MicOff, RotateCcw, Send } from "lucide-react";
import { useVoice3Layer } from "../../hooks/use-voice-3layer";
import { getSceneSvgFromMap } from "./scene-svgs";

// =====================================================
// データ定義
// =====================================================

const PRESET_TOPICS = [
  {
    id: "golf",
    icon: "⛳",
    label: "ゴルフ",
    topic: "ゴルフのコース攻略と上達の判断",
    description: "スコアが伸びる人と伸びない人の判断の違いをAIが引き出します",
    color: "bg-green-700",
    hoverColor: "hover:bg-green-800",
  },
  {
    id: "wine",
    icon: "🍷",
    label: "ワイン",
    topic: "ワイン選びの判断基準",
    description: "料理に合うワインを選ぶ暗黙の判断基準をAIが引き出します",
    color: "bg-red-700",
    hoverColor: "hover:bg-red-800",
  },
  {
    id: "fishing",
    icon: "🎣",
    label: "釣り",
    topic: "釣りのポイント選びと判断",
    description: "釣れる場所・タイミングを判断する暗黙知をAIが引き出します",
    color: "bg-blue-700",
    hoverColor: "hover:bg-blue-800",
  },
  {
    id: "entertainment",
    icon: "🍽️",
    label: "接待会食",
    topic: "接待会食の店選びと段取りの判断",
    description: "相手に喜ばれる会食を実現する暗黙の判断基準をAIが引き出します",
    color: "bg-amber-700",
    hoverColor: "hover:bg-amber-800",
  },
];

type Topic = (typeof PRESET_TOPICS)[0];

interface Profile {
  step1Label: string;
  step2Label: string;
}

const TOPIC_PROFILE: Record<
  string,
  {
    step1: { question: string; buttons: { id: string; label: string }[] };
    step2: { question: string; buttons: { id: string; label: string }[] };
  }
> = {
  golf: {
    step1: {
      question: "ゴルフ歴を教えてください",
      buttons: [
        { id: "lt3", label: "3年未満" },
        { id: "3to10", label: "3〜10年" },
        { id: "10to20", label: "10〜20年" },
        { id: "gt20", label: "20年以上" },
      ],
    },
    step2: {
      question: "おおよそのスコアレベルを教えてください",
      buttons: [
        { id: "beginner", label: "初心者（スコア100以上）" },
        { id: "intermediate", label: "中級者（スコア85〜100）" },
        { id: "advanced", label: "上級者（スコア85以下）" },
      ],
    },
  },
  wine: {
    step1: {
      question: "ワイン歴を教えてください",
      buttons: [
        { id: "lt3", label: "3年未満" },
        { id: "3to10", label: "3〜10年" },
        { id: "10to20", label: "10〜20年" },
        { id: "gt20", label: "20年以上" },
      ],
    },
    step2: {
      question: "ワインとの関わり方を教えてください",
      buttons: [
        { id: "casual", label: "たまに飲む程度" },
        { id: "monthly", label: "月に数回自分で選ぶ" },
        { id: "business", label: "接待等でよく選ぶ" },
        { id: "serious", label: "本格的に学んでいる" },
      ],
    },
  },
  fishing: {
    step1: {
      question: "釣り歴を教えてください",
      buttons: [
        { id: "lt3", label: "3年未満" },
        { id: "3to10", label: "3〜10年" },
        { id: "10to20", label: "10〜20年" },
        { id: "gt20", label: "20年以上" },
      ],
    },
    step2: {
      question: "釣りのスタイルを教えてください",
      buttons: [
        { id: "casual", label: "たまにやる程度（海釣り・川釣り）" },
        { id: "monthly", label: "月に数回楽しむ" },
        { id: "serious", label: "本格的にやっている（ルアー・フライ・磯など）" },
      ],
    },
  },
  entertainment: {
    step1: {
      question: "接待・会食の経験年数を教えてください",
      buttons: [
        { id: "lt3", label: "3年未満" },
        { id: "3to10", label: "3〜10年" },
        { id: "10to20", label: "10〜20年" },
        { id: "gt20", label: "20年以上" },
      ],
    },
    step2: {
      question: "接待・会食の頻度を教えてください",
      buttons: [
        { id: "rare", label: "年に数回程度" },
        { id: "monthly", label: "月に1〜2回" },
        { id: "frequent", label: "月に3回以上（接待が日常業務の一部）" },
      ],
    },
  },
};

const INITIAL_MARKER = "__INITIAL_MESSAGE__";

// =====================================================
// ワイン選択肢データ（レベル × 場面）
// =====================================================
const WINE_CHOICES: Record<string, string[][]> = {
  "たまに飲む程度": [
    ["A. チリ産カベルネ・ソーヴィニヨン（赤）— 1,500円", "B. イタリア産キャンティ（赤）— 2,500円", "C. フランス産シャブリ（白）— 3,000円", "D. スペイン産カヴァ（スパークリング）— 2,000円"],
    ["A. 赤ワイン", "B. 白ワイン"],
    ["A. フランス産ボルドー（赤）— 4,500円", "B. NZ産ソーヴィニヨン・ブラン（白）— 3,500円", "C. イタリア産バローロ（赤）— 5,000円", "D. シャンパーニュ（泡）— 5,000円"],
  ],
  "月に数回自分で選ぶ": [
    ["A. シャブリ（白）— 魚介に合わせる", "B. ブルゴーニュ・ピノノワール（赤）— 軽めの赤で無難に", "C. シャンパーニュ（泡）— 華やかさで場を演出", "D. ソムリエにコースに合わせて相談する"],
    ["A. 価格帯で絞って直感で選ぶ", "B. 品種を手がかりに選ぶ", "C. 産地を手がかりに選ぶ", "D. ソムリエに予算と料理を伝えて選んでもらう"],
    ["A. ブルゴーニュの村名格付け（赤）— 定番の上質さ", "B. シャンパーニュ ブラン・ド・ブラン（泡）— 特別感", "C. バローロ（赤）— 「ワインの王」", "D. 相手の生まれ年ヴィンテージを探す"],
  ],
  "接待等でよく選ぶ": [
    ["A. ボルドー格付けシャトーの当たり年", "B. ブルゴーニュの一級畑", "C. ソムリエと相談し白→赤の流れで2本", "D. 先方の好みを探る一言を添えてから決める"],
    ["A. ボルドー — 力強さと構造を楽しむ", "B. ブルゴーニュ — 繊細さとエレガンスを楽しむ", "C. 料理との相性で決める", "D. 飲み頃（熟成状態）で判断する"],
    ["A. ボルドー左岸の格付けシャトー（カベルネ主体）", "B. ブルゴーニュのグラン・クリュ（ピノ・ノワール）", "C. バローロまたはバルバレスコ（ネッビオーロ）", "D. ローヌのエルミタージュ（シラー主体）"],
  ],
  "本格的に学んでいる": [
    ["A. まず外観（色調・透明度・粘性）を確認", "B. まず香りを取る（第一アロマ）", "C. まずグラスを回して香りを開かせる", "D. 産地や品種の情報を確認してから味わう"],
    ["A. ヴィンテージ重視 — 当たり年の力はスタイルを超える", "B. 生産者重視 — 造り手の哲学が品質を決める", "C. 両方見るが、最終的にはヴィンテージ", "D. 両方見るが、最終的には生産者"],
    ["A. 産地によって選び方の軸は大きく変わる", "B. 基本的に同じで産地はあまり関係ない", "C. 旧世界と新世界で軸を分けている", "D. 産地より品種やスタイルを重視"],
  ],
};

// ゴルフ・初心者・場面1 のSVG図
const GOLF_BEGINNER_SCENE1_SVG = `<svg width="100%" height="500" viewBox="0 0 720 440" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" font-family="'Noto Sans JP',Arial,sans-serif">
  <defs>
    <linearGradient id="sky-b1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5B9EC9"/>
      <stop offset="55%" stop-color="#A8CEDF"/>
      <stop offset="100%" stop-color="#D6ECF6"/>
    </linearGradient>
    <linearGradient id="fw-b1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3A8040"/>
      <stop offset="100%" stop-color="#256030"/>
    </linearGradient>
    <linearGradient id="rough-b1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2A5A20"/>
      <stop offset="100%" stop-color="#1E4218"/>
    </linearGradient>
    <linearGradient id="pond-b1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4A90D9"/>
      <stop offset="50%" stop-color="#2E6FB0"/>
      <stop offset="100%" stop-color="#1A4F8A"/>
    </linearGradient>
    <linearGradient id="green-b1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1E8040"/>
      <stop offset="100%" stop-color="#156030"/>
    </linearGradient>
    <filter id="shadow-b1">
      <feDropShadow dx="1" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.28)"/>
    </filter>
    <marker id="arr-dot-b1" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#90EE90"/>
    </marker>
  </defs>
  <rect x="0" y="0" width="720" height="215" fill="url(#sky-b1)"/>
  <ellipse cx="110" cy="55" rx="72" ry="25" fill="rgba(255,255,255,0.75)"/>
  <ellipse cx="150" cy="42" rx="50" ry="20" fill="rgba(255,255,255,0.80)"/>
  <ellipse cx="80" cy="68" rx="40" ry="17" fill="rgba(255,255,255,0.65)"/>
  <ellipse cx="590" cy="60" rx="65" ry="24" fill="rgba(255,255,255,0.62)"/>
  <ellipse cx="630" cy="48" rx="44" ry="18" fill="rgba(255,255,255,0.68)"/>
  <rect x="0" y="210" width="720" height="230" fill="url(#rough-b1)"/>
  <path d="M 140,440 L 580,440 L 475,215 L 245,215 Z" fill="url(#fw-b1)"/>
  <line x1="270" y1="440" x2="308" y2="215" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
  <line x1="360" y1="440" x2="360" y2="215" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
  <line x1="450" y1="440" x2="412" y2="215" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
  <rect x="0" y="208" width="720" height="6" fill="#1E4820" opacity="0.7"/>
  <!-- グリーン -->
  <ellipse cx="345" cy="205" rx="60" ry="20" fill="url(#green-b1)" filter="url(#shadow-b1)"/>
  <ellipse cx="338" cy="200" rx="36" ry="11" fill="#2AA050" opacity="0.38"/>
  <!-- ピン -->
  <line x1="348" y1="205" x2="348" y2="158" stroke="#C0C0C0" stroke-width="2.5"/>
  <polygon points="348,158 378,165 348,172" fill="#CC2200"/>
  <ellipse cx="352" cy="208" rx="8" ry="3" fill="rgba(0,0,0,0.25)"/>
  <!-- 池 -->
  <ellipse cx="468" cy="300" rx="110" ry="60" fill="url(#pond-b1)" opacity="0.92"/>
  <ellipse cx="456" cy="290" rx="80" ry="42" fill="#5AA8E0" opacity="0.30"/>
  <ellipse cx="432" cy="279" rx="30" ry="8" fill="rgba(255,255,255,0.22)" transform="rotate(-15,432,279)"/>
  <!-- 距離矢印 -->
  <line x1="360" y1="390" x2="340" y2="218" stroke="#90EE90" stroke-width="2.5" stroke-dasharray="10,6" marker-end="url(#arr-dot-b1)" opacity="0.85"/>
  <!-- ゴルファー -->
  <circle cx="360" cy="375" r="14" fill="#1A2E4A"/>
  <path d="M 346,388 Q 360,396 374,388 L 377,408 Q 360,413 343,408 Z" fill="#1A2E4A"/>
  <line x1="374" y1="389" x2="416" y2="356" stroke="#4A4A4A" stroke-width="3.5"/>
  <circle cx="416" cy="356" r="5" fill="#6A6A6A"/>
  <!-- コース情報パネル（左上） -->
  <rect x="40" y="10" width="250" height="165" rx="10" ry="10" fill="white" opacity="0.9" filter="url(#shadow-b1)"/>
  <text x="165" y="37" text-anchor="middle" fill="#1a6b3a" font-size="18" font-weight="bold">コース情報</text>
  <line x1="50" y1="47" x2="280" y2="47" stroke="#dddddd" stroke-width="1"/>
  <text x="58" y="74" fill="#555" font-size="15">⛳ パー</text>
  <text x="278" y="74" text-anchor="end" fill="#333" font-size="19" font-weight="bold">4</text>
  <text x="58" y="102" fill="#555" font-size="15">📏 距離</text>
  <text x="278" y="102" text-anchor="end" fill="#e63946" font-size="19" font-weight="bold">330Y</text>
  <text x="58" y="130" fill="#555" font-size="15">💧 池</text>
  <text x="278" y="130" text-anchor="end" fill="#2E6FB0" font-size="16" font-weight="bold">右サイド</text>
  <text x="58" y="158" fill="#555" font-size="15">🏌 ドライバー</text>
  <text x="278" y="158" text-anchor="end" fill="#2e8b57" font-size="16" font-weight="bold">池越え可能</text>
</svg>`;

// ゴルフ・初心者・場面2 のSVG図
const GOLF_BEGINNER_SCENE2_SVG = `<svg width="100%" height="500" viewBox="0 0 720 440" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" font-family="'Noto Sans JP', Arial, sans-serif">
  <defs>
    <marker id="arrowhead2" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#e63946"/>
    </marker>
    <radialGradient id="fairwayGrad2" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#7ec850"/>
      <stop offset="100%" stop-color="#5aab30"/>
    </radialGradient>
    <radialGradient id="greenGrad2" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#2e8b57"/>
      <stop offset="100%" stop-color="#1a6b3a"/>
    </radialGradient>
    <radialGradient id="bunkerGrad2" cx="40%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#e8d5a0"/>
      <stop offset="100%" stop-color="#c9b070"/>
    </radialGradient>
    <filter id="panelShadow2" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#00000022"/>
    </filter>
    <filter id="greenShadow2">
      <feDropShadow dx="3" dy="4" stdDeviation="6" flood-color="#00000044"/>
    </filter>
  </defs>
  <rect x="0" y="0" width="720" height="440" fill="url(#fairwayGrad2)"/>
  <g opacity="0.12" stroke="#ffffff" stroke-width="18">
    <line x1="60"  y1="0" x2="60"  y2="440"/>
    <line x1="140" y1="0" x2="140" y2="440"/>
    <line x1="220" y1="0" x2="220" y2="440"/>
    <line x1="300" y1="0" x2="300" y2="440"/>
    <line x1="380" y1="0" x2="380" y2="440"/>
    <line x1="460" y1="0" x2="460" y2="440"/>
    <line x1="540" y1="0" x2="540" y2="440"/>
    <line x1="620" y1="0" x2="620" y2="440"/>
    <line x1="700" y1="0" x2="700" y2="440"/>
  </g>
  <!-- コース情報パネル（左上） -->
  <rect x="40" y="10" width="230" height="140" rx="10" ry="10" fill="white" opacity="0.9" filter="url(#panelShadow2)"/>
  <text x="155" y="37" text-anchor="middle" fill="#1a6b3a" font-size="18" font-weight="bold">コース情報</text>
  <line x1="50" y1="47" x2="260" y2="47" stroke="#dddddd" stroke-width="1"/>
  <text x="58" y="74" fill="#555" font-size="15">📍 ピンまで</text>
  <text x="258" y="74" text-anchor="end" fill="#e63946" font-size="19" font-weight="bold">15Y</text>
  <text x="58" y="102" fill="#555" font-size="15">🏔 アゴ</text>
  <text x="258" y="102" text-anchor="end" fill="#2e8b57" font-size="16" font-weight="bold">低め</text>
  <text x="58" y="130" fill="#555" font-size="15">🏖 砂の状態</text>
  <text x="258" y="130" text-anchor="end" fill="#b89840" font-size="16" font-weight="bold">やや硬め</text>
  <!-- グリーン（中央寄り） -->
  <ellipse cx="430" cy="220" rx="175" ry="140" fill="url(#greenGrad2)" filter="url(#greenShadow2)"/>
  <ellipse cx="430" cy="220" rx="175" ry="140" fill="none" stroke="#a8e6cf" stroke-width="2.5" opacity="0.6"/>
  <text x="500" y="340" text-anchor="middle" fill="white" font-size="14" opacity="0.7" font-weight="bold">グリーン</text>
  <!-- バンカー（中央寄り） -->
  <ellipse cx="260" cy="280" rx="95" ry="68" fill="#8b7340" opacity="0.35"/>
  <ellipse cx="257" cy="276" rx="95" ry="68" fill="url(#bunkerGrad2)"/>
  <ellipse cx="257" cy="276" rx="95" ry="68" fill="none" stroke="#b89840" stroke-width="2" stroke-dasharray="6,3" opacity="0.8"/>
  <g fill="#b8963a" opacity="0.4">
    <circle cx="225" cy="262" r="3"/><circle cx="250" cy="252" r="2"/>
    <circle cx="275" cy="268" r="3"/><circle cx="240" cy="284" r="2"/>
    <circle cx="265" cy="296" r="3"/><circle cx="290" cy="260" r="2"/>
    <circle cx="218" cy="290" r="2"/><circle cx="298" cy="284" r="3"/>
    <circle cx="238" cy="302" r="2"/><circle cx="272" cy="308" r="2"/>
  </g>
  <text x="257" y="330" text-anchor="middle" fill="#6b4e1a" font-size="13" font-weight="bold">バンカー</text>
  <!-- ボール -->
  <circle cx="250" cy="272" r="11" fill="#00000033"/>
  <circle cx="248" cy="269" r="11" fill="white" stroke="#cccccc" stroke-width="1.5"/>
  <circle cx="244" cy="265" r="2.5" fill="#eeeeee"/>
  <circle cx="252" cy="265" r="2.5" fill="#eeeeee"/>
  <circle cx="248" cy="271" r="2.5" fill="#eeeeee"/>
  <text x="215" cy="256" x="215" y="256" text-anchor="middle" fill="#333" font-size="12" font-weight="bold">ボール</text>
  <line x1="225" y1="258" x2="238" y2="265" stroke="#555" stroke-width="1" opacity="0.7"/>
  <!-- ピン -->
  <line x1="410" y1="140" x2="410" y2="210" stroke="#888888" stroke-width="2.5"/>
  <polygon points="410,140 410,163 432,152" fill="#e63946"/>
  <circle cx="410" cy="210" r="5" fill="#cccccc" stroke="#999" stroke-width="1"/>
  <ellipse cx="410" cy="212" rx="8" ry="4" fill="#1a4a2a" stroke="#0d3320" stroke-width="1"/>
  <text x="438" y="158" text-anchor="start" fill="white" font-size="13" font-weight="bold">ピン</text>
  <!-- 距離矢印 -->
  <line x1="260" y1="260" x2="398" y2="210" stroke="#e63946" stroke-width="2.2" stroke-dasharray="8,4" marker-end="url(#arrowhead2)"/>
  <rect x="305" y="218" width="64" height="28" rx="6" ry="6" fill="white" opacity="0.9" filter="url(#panelShadow2)"/>
  <text x="337" y="237" text-anchor="middle" fill="#e63946" font-size="17" font-weight="bold">15Y</text>
</svg>`;

function getMessageText(message: {
  parts?: { type: string; text?: string }[];
}): string {
  if (!message.parts) return "";
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("");
}

// 簡易 Markdown → React 要素（**, ##, ###, ---, - リスト）
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  const renderInline = (line: string): React.ReactNode => {
    // **bold** を <strong> に変換
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/^---+$/)) {
      elements.push(<hr key={key++} className="border-gray-300 my-2" />);
    } else if (line.startsWith("## ")) {
      elements.push(
        <p key={key++} className="font-bold text-base mt-2">
          {renderInline(line.slice(3))}
        </p>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <p key={key++} className="font-semibold mt-2">
          {renderInline(line.slice(4))}
        </p>
      );
    } else if (line.startsWith("- ")) {
      elements.push(
        <p key={key++} className="pl-3 before:content-['•'] before:mr-2 before:text-gray-400">
          {renderInline(line.slice(2))}
        </p>
      );
    } else if (line === "") {
      elements.push(<div key={key++} className="h-1" />);
    } else {
      elements.push(<p key={key++}>{renderInline(line)}</p>);
    }
  }

  return <div className="space-y-0.5">{elements}</div>;
}

// =====================================================
// フェーズ1: トピック選択
// =====================================================
function TopicSelection({ onSelect }: { onSelect: (topic: Topic) => void }) {
  return (
    <div className="min-h-full bg-white flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            暗黙知、体験しませんか？
          </h1>
          <p className="text-lg text-gray-600">
            あなたの「判断力」をAIが引き出します
          </p>
          <p className="text-base text-gray-500 mt-2">
            テーマを1つ選んでください
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {PRESET_TOPICS.map((topic) => (
            <button
              key={topic.id}
              onClick={() => onSelect(topic)}
              className={`
                flex flex-col items-center justify-center gap-3
                p-8 rounded-2xl text-white
                ${topic.color} ${topic.hoverColor}
                transition-all duration-150
                active:scale-95 shadow-md hover:shadow-lg
                min-h-[160px]
              `}
            >
              <span className="text-5xl">{topic.icon}</span>
              <span className="text-2xl font-bold">{topic.label}</span>
              <span className="text-sm text-white/80 text-center leading-tight">
                {topic.description}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// フェーズ2: プロフィール確認（2問・選択式）
// =====================================================
function ProfilePhase({
  topic,
  onComplete,
  onBack,
}: {
  topic: Topic;
  onComplete: (profile: Profile) => void;
  onBack: () => void;
}) {
  const profileDef = TOPIC_PROFILE[topic.id];
  const [step, setStep] = useState<1 | 2>(1);
  const [step1Label, setStep1Label] = useState("");

  const handleStep1 = (label: string) => {
    setStep1Label(label);
    setStep(2);
  };

  const handleStep2 = (label: string) => {
    onComplete({ step1Label, step2Label: label });
  };

  const current = step === 1 ? profileDef.step1 : profileDef.step2;
  const progressPercent = step === 1 ? 33 : 66;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <header className="bg-[#1E3A5F] px-5 py-3.5 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-xl font-bold text-white tracking-wide">
              暗黙知診断
            </span>
            <span className="text-[11px] font-semibold text-[#1E3A5F] bg-white/90 px-2.5 py-0.5 rounded-full">
              {topic.label}編
            </span>
          </div>
          <p className="text-[11px] text-white/55 mt-0.5">
            あなたが無意識に使っている「判断基準」を言語化する
          </p>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          最初に戻る
        </button>
      </header>

      {/* Progress bar */}
      <div className="shrink-0 bg-white border-b border-gray-100 px-5 py-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium tracking-wide text-gray-500">
            STEP {step} / 2　あなたについて
          </span>
        </div>
        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#1E3A5F] rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Question + choice buttons */}
      <div className="flex-1 flex flex-col px-5 py-6 gap-4">
        {/* AI question bubble */}
        <div className="flex justify-start">
          <div className="max-w-[82%] px-4 py-3 rounded-2xl rounded-bl-sm bg-gray-100 text-gray-800 text-base leading-relaxed">
            {current.question}
          </div>
        </div>

        {/* Step1 answer (shown when on step2) */}
        {step === 2 && (
          <div className="flex justify-end">
            <div className="max-w-[82%] px-4 py-3 rounded-2xl rounded-br-sm bg-[#1E3A5F] text-white text-base">
              {step1Label}
            </div>
          </div>
        )}

        {/* Choice buttons */}
        <div className="flex flex-col gap-3 mt-2">
          {current.buttons.map((btn) => (
            <button
              key={btn.id}
              onClick={() =>
                step === 1 ? handleStep1(btn.label) : handleStep2(btn.label)
              }
              className="w-full py-4 px-5 rounded-2xl border-2 border-gray-200 bg-white text-gray-800 text-base font-medium text-left hover:border-[#1E3A5F] hover:bg-[#1E3A5F]/5 active:scale-[0.98] transition-all"
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// フェーズ4: 完了画面
// =====================================================
function CompletionScreen({
  topic,
  onReset,
}: {
  topic: Topic;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col h-full bg-white">
      <header className="bg-[#1E3A5F] px-5 py-3.5 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-xl font-bold text-white tracking-wide">
            暗黙知診断
          </span>
          <span className="text-[11px] font-semibold text-[#1E3A5F] bg-white/90 px-2.5 py-0.5 rounded-full">
            {topic.label}編
          </span>
        </div>
        <p className="text-[11px] text-white/55 mt-0.5">
          あなたが無意識に使っている「判断基準」を言語化する
        </p>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-lg text-center">
          <div className="text-6xl mb-6">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            ヒアリング完了です！
          </h2>
          <div className="bg-[#F8F9FB] rounded-2xl p-6 mb-8 border border-gray-200">
            <p className="text-lg text-gray-700 leading-relaxed">
              もっと詳しく知りたい方は
              <br />
              <span className="font-semibold text-[#1E3A5F]">
                スタッフにお声がけください
              </span>
            </p>
            <p className="text-sm text-gray-500 mt-3">
              SkillRelayは、あなたの暗黙知を組織全体で共有・継承できるプラットフォームです
            </p>
          </div>
          <button
            onClick={onReset}
            className="flex items-center gap-2 mx-auto px-6 py-3 rounded-xl bg-[#1E3A5F] text-white text-base font-medium hover:bg-[#162d4a] active:scale-95 transition-all"
          >
            <RotateCcw className="h-4 w-4" />
            最初に戻る
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// フェーズ3: チャット（ヒアリング）
// =====================================================
function ChatPhase({
  selectedTopic,
  profile,
  sessionId,
  onReset,
}: {
  selectedTopic: Topic;
  profile: Profile;
  sessionId: string;
  onReset: () => void;
}) {
  const [input, setInput] = useState("");
  const autoStartedRef = useRef(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // プロフィールをトピック文字列に追記してAIに文脈を渡す（API変更なし）
  const enrichedTopic = `${selectedTopic.topic}（ユーザープロフィール: ${profile.step1Label} / ${profile.step2Label}）`;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/demo/exhibition/hearing",
        body: {
          topic: enrichedTopic,
          sessionId,
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId]
  );

  const { messages, sendMessage, status, error } = useChat({
    id: `exhibition-preset-${sessionId}`,
    transport,
  });

  // 初回のみ自動スタート
  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    sendMessage({ text: INITIAL_MARKER });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const userAnswerCount = messages.filter(
    (m) =>
      m.role === "user" &&
      !m.parts?.some((p) => p.type === "text" && p.text === INITIAL_MARKER)
  ).length;

  // まとめメッセージが実際に届いたら完了フラグを立てる
  const hasSummary = messages.some(
    (m) =>
      m.role === "assistant" &&
      getMessageText(m as Parameters<typeof getMessageText>[0]).includes(
        "あなたの判断OS"
      )
  );

  useEffect(() => {
    if (hasSummary && status === "ready") {
      setShowCompletion(true);
    }
  }, [hasSummary, status]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  // 音声トランスクリプト → テキストエリアに追記
  const handleTranscript = useCallback(
    (transcript: string) => {
      if (!transcript.trim() || showCompletion) return;
      setInput(transcript);
    },
    [showCompletion]
  );

  const voice = useVoice3Layer({
    onTranscript: handleTranscript,
    silenceTimeout: 1200,
    volumeThreshold: 45,
  });

  const handleTextSubmit = () => {
    if (!input.trim() || status === "streaming" || status === "submitted")
      return;
    if (voice.isConnected) voice.disconnect();
    const text = input;
    setInput("");
    sendMessage({ text });
  };

  const toggleVoice = async () => {
    if (voice.isConnected) {
      voice.disconnect();
    } else {
      await voice.connect();
    }
  };

  const currentScene = Math.min(Math.floor(userAnswerCount / 3) + 1, 3);
  const progressPercent = Math.min((userAnswerCount / 9) * 100, 100);
  const isVoiceActive =
    voice.phase === "listening" || voice.phase === "processing";

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <header className="bg-[#1E3A5F] px-5 py-3.5 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-xl font-bold text-white tracking-wide">
              暗黙知診断
            </span>
            <span className="text-[11px] font-semibold text-[#1E3A5F] bg-white/90 px-2.5 py-0.5 rounded-full">
              {selectedTopic.label}編
            </span>
          </div>
          <p className="text-[11px] text-white/55 mt-0.5">
            あなたが無意識に使っている「判断基準」を言語化する
          </p>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          最初に戻る
        </button>
      </header>

      {/* Progress bar */}
      <div className="shrink-0 bg-white border-b border-gray-100 px-5 py-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium tracking-wide text-gray-500">
            STEP 3 / 3　ヒアリング
          </span>
          <span className="text-[11px] text-gray-400">
            場面 {currentScene}/3
          </span>
        </div>
        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#1E3A5F] rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Chat messages */}
      <div className={`flex-1 overflow-y-auto px-4 py-4 space-y-3 ${enrichedTopic.includes("ワイン") ? "pb-[488px]" : "pb-72"}`}>
        {(() => {
          const filtered = messages.filter(
            (m) =>
              !m.parts?.some(
                (p) => p.type === "text" && p.text === INITIAL_MARKER
              )
          );
          const firstAssistantIndex = filtered.findIndex(
            (m) => m.role === "assistant"
          );
          // 場面ごとのSVGマップ（ゴルフ初心者の場面1,2はインライン定義を優先）
          const INLINE_SVG_MAP: Record<string, string> = {
            "golf_初心者（スコア100以上）_0": GOLF_BEGINNER_SCENE1_SVG,
            "golf_初心者（スコア100以上）_1": GOLF_BEGINNER_SCENE2_SVG,
          };

          // assistantメッセージの番号から場面SVGを取得
          // 場面質問は assistantIndex 0, 3, 6 (= answeredCount 0, 3, 6 → phase 0)
          const getSceneSvg = (assistantIndex: number): string | null => {
            // 場面質問は0番目、3番目、6番目のassistantメッセージ
            if (assistantIndex % 3 !== 0) return null;
            const sceneIndex = Math.floor(assistantIndex / 3);

            // まずインライン定義をチェック
            const topicId = enrichedTopic.includes("ゴルフ") ? "golf"
              : enrichedTopic.includes("ワイン") ? "wine"
              : enrichedTopic.includes("釣り") ? "fishing"
              : enrichedTopic.includes("接待") ? "entertainment" : null;
            if (!topicId) return null;

            const levelMatch = enrichedTopic.match(/\/ (.+)）$/);
            const level = levelMatch ? levelMatch[1] : null;
            if (!level) return null;

            const inlineKey = `${topicId}_${level}_${sceneIndex}`;
            if (INLINE_SVG_MAP[inlineKey]) return INLINE_SVG_MAP[inlineKey];

            // 外部マップから取得
            return getSceneSvgFromMap(enrichedTopic, sceneIndex);
          };

          let assistantCount = 0;
          return filtered.map((message, index) => {
            const text = getMessageText(
              message as Parameters<typeof getMessageText>[0]
            );
            if (!text) return null;
            const isAssistant = message.role === "assistant";
            const currentAssistantIndex = isAssistant ? assistantCount : -1;
            if (isAssistant) assistantCount++;
            const sceneSvg = isAssistant ? getSceneSvg(currentAssistantIndex) : null;
            return (
              <div key={message.id}>
                {sceneSvg && (
                  <div
                    className="w-full mb-2 rounded-xl overflow-hidden"
                    style={{ maxHeight: "500px" }}
                    dangerouslySetInnerHTML={{ __html: sceneSvg }}
                  />
                )}
                <div
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[82%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      message.role === "user"
                        ? "bg-[#1E3A5F] text-white rounded-br-sm"
                        : "bg-gray-100 text-gray-800 rounded-bl-sm"
                    }`}
                  >
                    {message.role === "assistant"
                      ? renderMarkdown(text)
                      : text}
                  </div>
                </div>
              </div>
            );
          });
        })()}

        {(status === "submitted" || status === "streaming") && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1 items-center">
                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mx-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            <p className="font-medium">エラーが発生しました</p>
            <p className="mt-1 text-xs opacity-80">
              {error.message || "リクエストの処理中にエラーが発生しました。"}
            </p>
          </div>
        )}

        {/* 完了後: 固定SkillRelayテキスト */}
        {showCompletion && (
          <div className="flex justify-start mx-2 mt-2">
            <div className="max-w-[82%] px-4 py-3 rounded-2xl bg-gray-100 text-gray-800 rounded-bl-sm text-sm leading-relaxed">
              SkillRelayは、こうした言語化されにくい知恵を組織全体で共有・継承できるようにします。
            </div>
          </div>
        )}

        {/* 完了後CTA — 入力欄の代わりにチャット末尾に表示 */}
        {showCompletion && (
          <div className="mx-2 mt-4 mb-2 rounded-2xl bg-[#1E3A5F] text-white p-6 text-center space-y-4">
            <p className="text-lg font-bold">
              もっと詳しく知りたい方はスタッフにお声掛けください。
            </p>
            <button
              onClick={onReset}
              className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl bg-white text-[#1E3A5F] text-sm font-semibold hover:bg-gray-100 active:scale-95 transition-all"
            >
              <RotateCcw className="h-4 w-4" />
              最初に戻る
            </button>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input area — 完了後は非表示・画面下部に固定 */}
      {!showCompletion && (
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-4 pt-3 pb-4 space-y-2 z-10">
        {/* 選択肢ボタン（ワイン: WINE_CHOICES から、その他: テキスト解析） */}
        {(() => {
          const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
          if (!lastAssistant) return null;
          const lastText = getMessageText(lastAssistant as Parameters<typeof getMessageText>[0]);
          if (!lastText) return null;

          let choiceLines: string[] = [];

          // ワインの場合: WINE_CHOICES データから選択肢を取得（場面質問時のみ）
          if (enrichedTopic.includes("ワイン")) {
            const phase = userAnswerCount % 3;
            const sceneIdx = Math.floor(userAnswerCount / 3);
            if (phase === 0 && sceneIdx < 3) {
              const levelMatch = enrichedTopic.match(/\/ (.+)）$/);
              const level = levelMatch ? levelMatch[1] : null;
              if (level && WINE_CHOICES[level]) {
                choiceLines = WINE_CHOICES[level][sceneIdx] ?? [];
              }
            }
          } else {
            // その他のトピック: テキスト内 🍷 選択肢 から抽出
            if (lastText.includes("🍷 選択肢")) {
              choiceLines = lastText.split("\n").filter((l) => /^[A-D]\.\s/.test(l.trim())).map((l) => l.trim());
            }
          }

          if (choiceLines.length === 0) return null;
          return (
            <div className="grid grid-cols-2 gap-2 mb-1">
              {choiceLines.map((label) => (
                <button
                  key={label}
                  onClick={() => {
                    if (voice.isConnected) voice.disconnect();
                    setInput("");
                    sendMessage({ text: label });
                  }}
                  disabled={status === "streaming" || status === "submitted"}
                  className="px-3 py-3 rounded-xl bg-gray-100 text-gray-800 text-sm font-medium text-left border-2 border-gray-200 hover:border-[#1E3A5F] hover:bg-gray-50 active:scale-[0.97] transition-all disabled:opacity-50"
                >
                  {label}
                </button>
              ))}
            </div>
          );
        })()}

        {voice.error && (
          <p className="text-xs text-red-500 text-center">{voice.error}</p>
        )}

        {/* 1. 音声ボタン（横幅いっぱい） */}
        <button
          onClick={toggleVoice}
          disabled={status === "streaming" || status === "submitted"}
          className={`
            w-full flex items-center justify-center gap-3
            py-4 rounded-2xl text-base font-semibold
            transition-all active:scale-[0.98]
            disabled:opacity-50 disabled:cursor-not-allowed
            ${
              voice.phase === "listening"
                ? "bg-green-500 text-white shadow-lg shadow-green-200"
                : voice.phase === "connecting"
                  ? "bg-gray-300 text-gray-600"
                  : voice.phase === "processing"
                    ? "bg-yellow-400 text-yellow-900"
                    : "bg-[#1E3A5F] text-white shadow-md hover:bg-[#162d4a]"
            }
          `}
        >
          {voice.phase === "processing" ? (
            <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : voice.phase === "listening" ? (
            <MicOff className="h-5 w-5" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
          <span>
            {voice.phase === "connecting"
              ? "接続中..."
              : voice.phase === "listening"
                ? "聞き取り中（タップで停止）"
                : voice.phase === "processing"
                  ? "変換中..."
                  : "音声で答える（タップで開始）"}
          </span>
        </button>

        {/* 2. テキストエリア（音声結果も反映） */}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="回答がここに表示されます。直接入力することもできます..."
          rows={3}
          disabled={status === "streaming" || status === "submitted"}
          className="w-full resize-none rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-0 focus:border-[#1E3A5F]/60 disabled:opacity-60 transition-colors"
        />

        {/* 3. 送信ボタン（横幅いっぱい） */}
        <button
          onClick={handleTextSubmit}
          disabled={
            !input.trim() ||
            status === "streaming" ||
            status === "submitted"
          }
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-[#1E3A5F] text-white text-base font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#162d4a] active:scale-[0.98] transition-all shadow-md"
        >
          <Send className="h-5 w-5" />
          送信する
        </button>
      </div>
      )}
    </div>
  );
}

// =====================================================
// メインページ
// =====================================================
export default function ExhibitionPresetPage() {
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionId, setSessionId] = useState(
    () => `exhibition-preset-${nanoid()}`
  );

  const handleReset = async () => {
    await fetch(`/api/demo/exhibition/hearing?sessionId=${sessionId}`, {
      method: "DELETE",
    }).catch(() => {});
    setSessionId(`exhibition-preset-${nanoid()}`);
    setSelectedTopic(null);
    setProfile(null);
  };

  if (!selectedTopic) {
    return <TopicSelection onSelect={setSelectedTopic} />;
  }

  if (!profile) {
    return (
      <ProfilePhase
        topic={selectedTopic}
        onComplete={setProfile}
        onBack={handleReset}
      />
    );
  }

  return (
    <ChatPhase
      key={sessionId}
      selectedTopic={selectedTopic}
      profile={profile}
      sessionId={sessionId}
      onReset={handleReset}
    />
  );
}
