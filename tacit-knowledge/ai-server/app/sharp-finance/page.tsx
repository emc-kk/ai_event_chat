'use client';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputButton,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input';
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { nanoid } from 'nanoid';
import { useChat } from '@ai-sdk/react';
import { CopyIcon, GlobeIcon, RefreshCcwIcon, Trash2Icon, GitBranchIcon, MessageCircleQuestionIcon, CombineIcon } from 'lucide-react';
import {
  Attachments,
  Attachment,
  AttachmentPreview,
  AttachmentInfo,
} from '@/components/ai-elements/attachments';
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/sources';
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning';
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool';
import { Loader } from '@/components/ai-elements/loader';
import { DefaultChatTransport } from 'ai';

const extractErrorMessage = (error: Error): string => {
  const message = error.message || '';

  // Try to extract meaningful error from JSON-like structure
  const errorMatch = message.match(/"error":\s*"([^"]+)"/);
  if (errorMatch) {
    return errorMatch[1];
  }

  // Try to extract from "message" field
  const messageMatch = message.match(/"message":\s*"([^"]+)"/);
  if (messageMatch) {
    return messageMatch[1];
  }

  // Check for common API error patterns
  if (message.includes('was provided without its required following item')) {
    return 'AIモデルとの通信中にエラーが発生しました。ページを再読み込みして、もう一度お試しください。';
  }

  // If message is very long (likely contains full JSON), return generic message
  if (message.length > 200) {
    return 'リクエストの処理中にエラーが発生しました。しばらく経ってから再度お試しください。';
  }

  return message || 'エラーが発生しました。';
};

interface SuggestionItem {
  id?: string;
  question: string;
  answerCandidates?: string[] | Array<{ answer_text: string; source_context: string }>;
  category?: string;
  currentCheckId?: string;
}

type ChatMode = 'flow' | 'qa' | 'unified';

const ChatBotDemo = () => {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [roomId, setRoomId] = useState<string>(() => nanoid());
  const [currentCheckId, setCurrentCheckId] = useState<string>('step0-sub0-check0');
  const [mode, setMode] = useState<ChatMode>('unified');

  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/chat',
    headers: {
      'x-api-key': process.env.NEXT_PUBLIC_API_SECRET_KEY || '',
    },
    body: { room_id: roomId, current_check_id: currentCheckId, mode },
  }), [roomId, currentCheckId, mode]);

  const { messages, sendMessage, status, regenerate, error, setMessages } = useChat({
    id: roomId,
    transport,
  });

  const handleReset = () => {
    setRoomId(nanoid());
    setCurrentCheckId('step0-sub0-check0');
    setMessages([]);
    setSuggestions([]);
  };

  const handleModeSwitch = (newMode: ChatMode) => {
    if (newMode !== mode) {
      setMode(newMode);
      setRoomId(nanoid());
      setCurrentCheckId('step0-sub0-check0');
      setMessages([]);
      setSuggestions([]);
    }
  };

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await fetch('/api/suggestions?source=generated', {
        headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_SECRET_KEY || '' },
      });
      const data = await res.json();
      console.log('[fetchSuggestions] Generated response:', data);
      if (data.suggestions?.length > 0) {
        setSuggestions(data.suggestions);
        // Update currentCheckId from suggestions
        const checkId = data.suggestions[0]?.currentCheckId;
        if (checkId) {
          console.log('[fetchSuggestions] Updating currentCheckId to:', checkId);
          setCurrentCheckId(checkId);
        }
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    }
  }, []);

  useEffect(() => {
    if (status === 'ready' && messages.length > 0 && (mode === 'flow' || mode === 'unified')) {
      fetchSuggestions();
    }
  }, [status, messages.length, fetchSuggestions, mode]);

  const handleSuggestionClick = (question: string) => {
    setInput(question);
  };

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);
    if (!(hasText || hasAttachments)) {
      return;
    }
    console.log('[handleSubmit] Sending with currentCheckId:', currentCheckId);
    sendMessage(
      {
        text: message.text || 'Sent with attachments',
        files: message.files
      },
      {
        body: {
          current_check_id: currentCheckId,
        },
      },
    );
    setInput('');
    setSuggestions([]);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 relative size-full h-screen">
      <div className="flex flex-col h-full">
        <Conversation className="h-full">
          <ConversationContent>
            {messages.map((message) => (
              <div key={message.id}>
                {message.role === 'assistant' && message.parts.filter((part) => part.type === 'source-url').length > 0 && (
                  <Sources>
                    <SourcesTrigger
                      count={
                        message.parts.filter(
                          (part) => part.type === 'source-url',
                        ).length
                      }
                    />
                    {message.parts.filter((part) => part.type === 'source-url').map((part, i) => (
                      <SourcesContent key={`${message.id}-${i}`}>
                        <Source
                          key={`${message.id}-${i}`}
                          href={part.url}
                          title={part.url}
                        />
                      </SourcesContent>
                    ))}
                  </Sources>
                )}
                {message.parts.map((part, i) => {
                  switch (part.type) {
                    case 'text':
                      return (
                        <Message key={`${message.id}-${i}`} from={message.role}>
                          <MessageContent>
                            <MessageResponse>
                              {part.text}
                            </MessageResponse>
                          </MessageContent>
                          {message.role === 'assistant' && i === messages.length - 1 && (
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
                    case 'file':
                      return (
                        <Message key={`${message.id}-${i}`} from={message.role} className="mb-2">
                          <MessageContent>
                            <Attachments variant="inline">
                              <Attachment data={{ ...part, id: `${message.id}-${i}` }}>
                                <AttachmentPreview />
                                <AttachmentInfo />
                              </Attachment>
                            </Attachments>
                          </MessageContent>
                        </Message>
                      );
                    case 'reasoning':
                      // Skip if reasoning text is empty
                      if (!part.text) return null;
                      return (
                        <Reasoning
                          key={`${message.id}-${i}`}
                          className="w-full"
                          isStreaming={status === 'streaming' && i === message.parts.length - 1 && message.id === messages.at(-1)?.id}
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>{part.text}</ReasoningContent>
                        </Reasoning>
                      );
                    default:
                      // Handle tool parts (type: tool-${toolName})
                      if (part.type.startsWith('tool-')) {
                        const toolPart = part as any;
                        return (
                          <Tool key={`${message.id}-${i}`}>
                            <ToolHeader
                              type={part.type as `tool-${string}`}
                              state={toolPart.state}
                            />
                            <ToolContent>
                              <ToolInput input={toolPart.input} />
                              {(toolPart.state === 'output-available' || toolPart.state === 'output-error') && (
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
            {status === 'submitted' && <Loader />}
            {error && (
              <div className="mx-4 my-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                <p className="font-medium">エラーが発生しました</p>
                <p className="mt-1 text-xs opacity-80">{extractErrorMessage(error)}</p>
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {(mode === 'flow' || mode === 'unified') && suggestions.length > 0 && (
          <div className="py-2">
            <Suggestions>
              {suggestions.flatMap((s, sIdx) => {
                const candidates = s.answerCandidates || [];
                return candidates.map((candidate, cIdx) => {
                  const text = typeof candidate === 'string'
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

        <PromptInput
          onSubmit={handleSubmit}
          className="mt-4"
          globalDrop
          multiple
          accept="image/*,application/pdf"
          maxFileSize={50 * 1024 * 1024}
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
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
              <PromptInputButton
                variant="ghost"
                onClick={handleReset}
                disabled={messages.length === 0}
              >
                <Trash2Icon size={16} />
                <span>Reset</span>
              </PromptInputButton>
              <div className="flex gap-1 ml-2 border-l pl-2">
                <PromptInputButton
                  variant={mode === 'unified' ? 'default' : 'ghost'}
                  onClick={() => handleModeSwitch('unified')}
                >
                  <CombineIcon size={16} />
                  <span>Unified</span>
                </PromptInputButton>
                <PromptInputButton
                  variant={mode === 'flow' ? 'default' : 'ghost'}
                  onClick={() => handleModeSwitch('flow')}
                >
                  <GitBranchIcon size={16} />
                  <span>Flow</span>
                </PromptInputButton>
                <PromptInputButton
                  variant={mode === 'qa' ? 'default' : 'ghost'}
                  onClick={() => handleModeSwitch('qa')}
                >
                  <MessageCircleQuestionIcon size={16} />
                  <span>QA</span>
                </PromptInputButton>
              </div>
            </PromptInputTools>
            <PromptInputSubmit disabled={!input && !status} status={status} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
};
export default ChatBotDemo;
