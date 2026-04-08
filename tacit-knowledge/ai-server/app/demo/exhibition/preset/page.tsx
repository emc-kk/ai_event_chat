"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { nanoid } from "nanoid";
import { Mic, MicOff, RotateCcw, Send } from "lucide-react";
import { useVoice3Layer } from "../../hooks/use-voice-3layer";

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

// ゴルフ・初心者・場面1 のSVG図（試験表示用）
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
    <marker id="arr-b1" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#FFFFFF"/>
    </marker>
    <marker id="arr-dot-b1" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#90EE90"/>
    </marker>
  </defs>
  <rect x="0" y="0" width="720" height="48" fill="#1E3A5F"/>
  <text x="360" y="18" text-anchor="middle" fill="#A8C0D8" font-size="11">場面 1</text>
  <text x="360" y="38" text-anchor="middle" fill="#FFFFFF" font-size="15" font-weight="bold">ティーショットの選択｜パー4・330ヤード・右に池</text>
  <rect x="0" y="48" width="720" height="215" fill="url(#sky-b1)"/>
  <ellipse cx="110" cy="95" rx="72" ry="25" fill="rgba(255,255,255,0.75)"/>
  <ellipse cx="150" cy="82" rx="50" ry="20" fill="rgba(255,255,255,0.80)"/>
  <ellipse cx="80" cy="108" rx="40" ry="17" fill="rgba(255,255,255,0.65)"/>
  <ellipse cx="590" cy="100" rx="65" ry="24" fill="rgba(255,255,255,0.62)"/>
  <ellipse cx="630" cy="88" rx="44" ry="18" fill="rgba(255,255,255,0.68)"/>
  <rect x="0" y="258" width="720" height="182" fill="url(#rough-b1)"/>
  <path d="M 140,440 L 580,440 L 475,262 L 245,262 Z" fill="url(#fw-b1)"/>
  <line x1="270" y1="440" x2="308" y2="262" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
  <line x1="360" y1="440" x2="360" y2="262" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
  <line x1="450" y1="440" x2="412" y2="262" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
  <rect x="0" y="256" width="720" height="6" fill="#1E4820" opacity="0.7"/>
  <ellipse cx="345" cy="252" rx="60" ry="20" fill="url(#green-b1)" filter="url(#shadow-b1)"/>
  <ellipse cx="338" cy="247" rx="36" ry="11" fill="#2AA050" opacity="0.38"/>
  <line x1="348" y1="252" x2="348" y2="205" stroke="#C0C0C0" stroke-width="2.5"/>
  <polygon points="348,205 378,212 348,219" fill="#CC2200"/>
  <ellipse cx="352" cy="255" rx="8" ry="3" fill="rgba(0,0,0,0.25)"/>
  <ellipse cx="468" cy="330" rx="120" ry="68" fill="url(#pond-b1)" opacity="0.92"/>
  <ellipse cx="456" cy="320" rx="90" ry="48" fill="#5AA8E0" opacity="0.30"/>
  <ellipse cx="432" cy="309" rx="30" ry="8" fill="rgba(255,255,255,0.22)" transform="rotate(-15,432,309)"/>
  <ellipse cx="478" cy="350" rx="20" ry="5" fill="rgba(255,255,255,0.18)" transform="rotate(10,478,350)"/>
  <rect x="396" y="288" width="136" height="40" rx="7" fill="rgba(0,20,80,0.72)"/>
  <text x="464" y="304" text-anchor="middle" fill="#5EC8FF" font-size="13" font-weight="bold">池（右）OB注意</text>
  <text x="464" y="321" text-anchor="middle" fill="#AAD8FF" font-size="11">ウォーターハザード</text>
  <rect x="158" y="293" width="140" height="38" rx="7" fill="rgba(0,60,20,0.72)"/>
  <text x="228" y="309" text-anchor="middle" fill="#80FF90" font-size="13" font-weight="bold">左サイドが安全</text>
  <text x="228" y="325" text-anchor="middle" fill="#AAFFB8" font-size="11">フェアウェイ広め</text>
  <line x1="360" y1="424" x2="320" y2="262" stroke="#90EE90" stroke-width="2.5" stroke-dasharray="10,6" marker-end="url(#arr-dot-b1)" opacity="0.85"/>
  <rect x="308" y="358" width="105" height="48" rx="9" fill="#1E3A5F" filter="url(#shadow-b1)"/>
  <text x="360" y="376" text-anchor="middle" fill="#A8C0D8" font-size="11">距離</text>
  <text x="360" y="398" text-anchor="middle" fill="#FFFFFF" font-size="22" font-weight="bold">330Y</text>
  <rect x="295" y="425" width="130" height="15" rx="4" fill="rgba(255,255,255,0.12)"/>
  <text x="360" y="437" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-size="10">ティーボックス</text>
  <circle cx="360" cy="407" r="14" fill="#1A2E4A"/>
  <path d="M 346,420 Q 360,428 374,420 L 377,440 Q 360,445 343,440 Z" fill="#1A2E4A"/>
  <line x1="374" y1="421" x2="416" y2="388" stroke="#4A4A4A" stroke-width="3.5"/>
  <circle cx="416" cy="388" r="5" fill="#6A6A6A"/>
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
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-72">
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
          const showDiagramFor =
            enrichedTopic.includes("ゴルフ") &&
            enrichedTopic.includes("初心者（スコア100以上）");
          return filtered.map((message, index) => {
            const text = getMessageText(
              message as Parameters<typeof getMessageText>[0]
            );
            if (!text) return null;
            const isFirstAssistant =
              message.role === "assistant" && index === firstAssistantIndex;
            return (
              <div key={message.id}>
                {isFirstAssistant && showDiagramFor && (
                  <div
                    className="w-full mb-2 rounded-xl overflow-hidden"
                    style={{ maxHeight: "500px" }}
                    dangerouslySetInnerHTML={{ __html: GOLF_BEGINNER_SCENE1_SVG }}
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
