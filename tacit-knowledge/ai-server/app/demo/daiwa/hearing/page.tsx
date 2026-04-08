"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Loader } from "@/components/ai-elements/loader";
import { StepIndicator } from "../../components/step-indicator";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { nanoid } from "nanoid";
import { CopyIcon, RefreshCcwIcon, Mic } from "lucide-react";

const DEMO_STEPS = [
  { step: 0, name_jp: "スクリーニング", name_en: "Screen" },
  { step: 1, name_jp: "問題特定", name_en: "Identify" },
  { step: 2, name_jp: "情報収集", name_en: "Gather" },
  { step: 3, name_jp: "状況分析", name_en: "Analyze" },
  { step: 4, name_jp: "選択肢構築", name_en: "Develop" },
  { step: 5, name_jp: "選択肢評価", name_en: "Evaluate" },
  { step: 6, name_jp: "判断形成", name_en: "Decide" },
  { step: 7, name_jp: "モニタリング", name_en: "Monitor" },
];

const stripHearingMeta = (text: string): string => {
  return text.replace(/<!--HEARING_META[\s\S]*?-->/g, "").trim();
};

interface SuggestionItem {
  id?: string;
  question: string;
  answerCandidates?:
    | string[]
    | Array<{ answer_text: string; source_context: string }>;
}

export default function HearingDemoPage() {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [chatId] = useState(() => nanoid());
  const [autoStarted, setAutoStarted] = useState(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/demo/daiwa/hearing",
        headers: {
          "x-api-key": process.env.NEXT_PUBLIC_API_SECRET_KEY || "",
        },
      }),
    []
  );

  const { messages, sendMessage, status, regenerate, error } = useChat({
    id: chatId,
    transport,
  });

  // Auto-start hearing
  useEffect(() => {
    if (!autoStarted && messages.length === 0) {
      setAutoStarted(true);
      sendMessage({ text: "__INITIAL_MESSAGE__" });
    }
  }, [autoStarted, messages.length, sendMessage]);

  // Fetch suggestions after each response
  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await fetch(
        "/api/suggestions?source=generated&request_id=demo-daiwa-001",
        { headers: { "x-api-key": process.env.NEXT_PUBLIC_API_SECRET_KEY || "" } }
      );
      const data = await res.json();
      if (data.suggestions?.length > 0) {
        setSuggestions(data.suggestions);
      }
    } catch {
      // ignore
    }
  }, []);

  // Poll current step
  const fetchStep = useCallback(async () => {
    try {
      const res = await fetch("/api/demo/daiwa/hearing", {
        headers: { "x-api-key": process.env.NEXT_PUBLIC_API_SECRET_KEY || "" },
      });
      const data = await res.json();
      if (typeof data.step === "number") {
        setCurrentStep(data.step);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (status === "ready" && messages.length > 0) {
      fetchSuggestions();
      fetchStep();
    }
  }, [status, messages.length, fetchSuggestions, fetchStep]);

  const handleSubmit = (message: PromptInputMessage) => {
    if (!message.text) return;
    sendMessage({ text: message.text });
    setInput("");
    setSuggestions([]);
  };

  const handleSuggestionClick = (text: string) => {
    setInput(text);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Step indicator header */}
      <div className="bg-white border-b border-gray-200/80 px-5 py-2.5">
        <div className="flex items-center gap-3 mb-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100">
            <Mic className="h-3.5 w-3.5 text-gray-600" />
          </div>
          <span className="text-sm font-semibold text-gray-900">
            8ステップ ヒアリング
          </span>
          <span className="text-[11px] text-gray-400">
            北海道洋上風力発電プロジェクト
          </span>
        </div>
        <StepIndicator
          steps={DEMO_STEPS}
          currentStep={currentStep}
          completedSteps={Array.from({ length: currentStep }, (_, i) => i)}
        />
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-4">
        <Conversation className="flex-1">
          <ConversationContent>
            {messages
              .filter(
                (m) =>
                  !(
                    m.role === "user" &&
                    m.parts.some(
                      (p) =>
                        p.type === "text" && p.text === "__INITIAL_MESSAGE__"
                    )
                  )
              )
              .map((message) => (
                <div key={message.id}>
                  {message.parts.map((part, i) => {
                    switch (part.type) {
                      case "text":
                        return (
                          <Message
                            key={`${message.id}-${i}`}
                            from={message.role}
                          >
                            <MessageContent>
                              <MessageResponse>
                                {stripHearingMeta(part.text)}
                              </MessageResponse>
                            </MessageContent>
                            {message.role === "assistant" &&
                              message.id === messages.at(-1)?.id && (
                                <MessageActions>
                                  <MessageAction
                                    onClick={() => regenerate()}
                                    label="Retry"
                                  >
                                    <RefreshCcwIcon className="size-3" />
                                  </MessageAction>
                                  <MessageAction
                                    onClick={() =>
                                      navigator.clipboard.writeText(
                                        stripHearingMeta(part.text)
                                      )
                                    }
                                    label="Copy"
                                  >
                                    <CopyIcon className="size-3" />
                                  </MessageAction>
                                </MessageActions>
                              )}
                          </Message>
                        );
                      case "reasoning":
                        if (!part.text) return null;
                        return (
                          <Reasoning
                            key={`${message.id}-${i}`}
                            className="w-full"
                            isStreaming={
                              status === "streaming" &&
                              message.id === messages.at(-1)?.id
                            }
                          >
                            <ReasoningTrigger />
                            <ReasoningContent>{part.text}</ReasoningContent>
                          </Reasoning>
                        );
                      default:
                        if (part.type.startsWith("tool-")) {
                          const toolPart = part as any;
                          return (
                            <Tool key={`${message.id}-${i}`}>
                              <ToolHeader
                                type={part.type as `tool-${string}`}
                                state={toolPart.state}
                              />
                              <ToolContent>
                                <ToolInput input={toolPart.input} />
                                {(toolPart.state === "output-available" ||
                                  toolPart.state === "output-error") && (
                                  <ToolOutput
                                    output={toolPart.output}
                                    errorText={toolPart.errorText}
                                  />
                                )}
                              </ToolContent>
                            </Tool>
                          );
                        }
                        return null;
                    }
                  })}
                </div>
              ))}
            {status === "submitted" && <Loader />}
            {error && (
              <div className="mx-4 my-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                <p className="font-medium">
                  エラーが発生しました
                </p>
                <p className="mt-1 text-xs opacity-80">
                  {error.message || "リクエストの処理中にエラーが発生しました。"}
                </p>
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="py-2">
            <Suggestions>
              {suggestions.flatMap((s, sIdx) => {
                const candidates = s.answerCandidates || [];
                return candidates.map((candidate, cIdx) => {
                  const text =
                    typeof candidate === "string"
                      ? candidate
                      : candidate.answer_text;
                  return (
                    <Suggestion
                      key={`${s.id || sIdx}-${cIdx}`}
                      suggestion={text}
                      onClick={handleSuggestionClick}
                    />
                  );
                });
              })}
            </Suggestions>
          </div>
        )}

        {/* Input */}
        <PromptInput
          onSubmit={handleSubmit}
          className="mt-2"
          globalDrop={false}
          multiple={false}
        >
          <PromptInputHeader>
            <PromptInputAttachments>
              {(attachment) => <PromptInputAttachment data={attachment} />}
            </PromptInputAttachments>
          </PromptInputHeader>
          <PromptInputBody>
            <PromptInputTextarea
              onChange={(e) => setInput(e.target.value)}
              value={input}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools />
            <PromptInputSubmit disabled={!input && !status} status={status} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
