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
import { Loader } from "@/components/ai-elements/loader";
import { useState, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { nanoid } from "nanoid";
import {
  CopyIcon,
  RefreshCcwIcon,
  MessageCircleQuestion,
} from "lucide-react";

const SAMPLE_QUESTIONS = [
  "インフラ投資判断で最も重要な指標は何ですか？",
  "洋上風力の稼働率はどの程度を想定すべきですか？",
  "感度分析で最も重視すべき変数は何ですか？",
  "SPCスキームとは何ですか？",
];

export default function QaDemoPage() {
  const [input, setInput] = useState("");
  const [chatId] = useState(() => nanoid());

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/demo/daiwa/qa",
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

  const handleSubmit = (message: PromptInputMessage) => {
    if (!message.text) return;
    sendMessage({ text: message.text });
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200/80 px-5 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100">
            <MessageCircleQuestion className="h-3.5 w-3.5 text-gray-600" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-900">
              Q&A ナレッジ検索
            </h1>
            <p className="text-[11px] text-gray-400 leading-tight">
              北海道洋上風力発電プロジェクト — ヒアリング知識ベースから回答
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-4">
        <Conversation className="flex-1">
          <ConversationContent>
            {/* Show sample questions if no messages */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <p className="text-gray-400 text-sm">
                  ヒアリングで蓄積された知識に質問してください
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                  {SAMPLE_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        sendMessage({ text: q });
                      }}
                      className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id}>
                {message.parts.map((part, i) => {
                  if (part.type !== "text") return null;
                  return (
                    <Message
                      key={`${message.id}-${i}`}
                      from={message.role}
                    >
                      <MessageContent>
                        <MessageResponse>{part.text}</MessageResponse>
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
                                navigator.clipboard.writeText(part.text)
                              }
                              label="Copy"
                            >
                              <CopyIcon className="size-3" />
                            </MessageAction>
                          </MessageActions>
                        )}
                    </Message>
                  );
                })}
              </div>
            ))}
            {status === "submitted" && <Loader />}
            {error && (
              <div className="mx-4 my-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                <p className="font-medium">エラーが発生しました</p>
                <p className="mt-1 text-xs opacity-80">
                  {error.message ||
                    "リクエストの処理中にエラーが発生しました。"}
                </p>
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

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
