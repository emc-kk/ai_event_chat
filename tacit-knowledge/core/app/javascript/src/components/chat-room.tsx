'use client';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  useStickToBottomContext,
} from './ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from './ai-elements/message';
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
} from './ai-elements/prompt-input';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { CopyIcon, GlobeIcon, RefreshCcwIcon } from 'lucide-react';
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from './ai-elements/tool';
import {
  Attachments,
  Attachment,
  AttachmentPreview,
  AttachmentInfo,
} from './ai-elements/attachments';
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from './ai-elements/sources';
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from './ai-elements/reasoning';
import { Loader } from './ai-elements/loader';
import { Suggestion, Suggestions } from './ai-elements/suggestion';
import { DefaultChatTransport, UIMessage } from 'ai';
import { getMessages } from '../lib/api-client';

const extractErrorMessage = (error: Error): string => {
  const message = error.message || '';

  // Try to parse as JSON (e.g. API returns { error, message })
  try {
    if (message.trim().startsWith('{')) {
      const parsed = JSON.parse(message) as { message?: string; error?: string };
      if (parsed.message) return parsed.message;
      if (parsed.error) {
        if (parsed.error === 'request_not_found') return 'リクエスト情報が見つかりません。管理者にご連絡ください。';
        if (parsed.error === 'database_error') return 'リクエスト情報の取得に失敗しました。管理者にご連絡ください。';
        return parsed.error;
      }
    }
  } catch {
    // fall through to regex fallbacks
  }

  // Fallback: extract "message" field with regex
  const messageMatch = message.match(/"message":\s*"((?:[^"\\]|\\.)*)"/);
  if (messageMatch && messageMatch[1]) {
    return messageMatch[1].replace(/\\"/g, '"');
  }
  const errorMatch = message.match(/"error":\s*"([^"]+)"/);
  if (errorMatch) {
    const code = errorMatch[1];
    if (code === 'request_not_found') return 'リクエスト情報が見つかりません。管理者にご連絡ください。';
    if (code === 'database_error') return 'リクエスト情報の取得に失敗しました。管理者にご連絡ください。';
    if (code === 'request_id_required') return 'リクエストIDが指定されていません。';
    return code;
  }

  // Check for common API error patterns
  if (message.includes('was provided without its required following item')) {
    return 'AIモデルとの通信中にエラーが発生しました。ページを再読み込みして、もう一度お試しください。';
  }
  if (message.includes('Request not found') || message.includes('request_not_found') || message.includes('リクエスト情報が見つかりません')) {
    return 'リクエスト情報が見つかりません。同一のデータベースを参照しているか、管理者にご連絡ください。';
  }
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'ヒアリングサーバーに接続できません。URL設定とネットワークを確認してください。';
  }

  // If message is very long (likely contains full JSON), return generic message
  if (message.length > 200) {
    return 'リクエストの処理中にエラーが発生しました。しばらく経ってから再度お試しください。';
  }

  return message || 'エラーが発生しました。';
};

/**
 * HEARING_META ブロックをメッセージテキストから除去する
 * サーバー側ではDB保存時に除去するが、ストリーミング中のチャンクには
 * META が含まれるため、クライアント側でも表示前に除去する
 */
const stripHearingMeta = (text: string): string => {
  return text.replace(/<!--HEARING_META[\s\S]*?-->/g, '').trim();
};

interface SuggestionItem {
  id?: string;
  question: string;
  answerCandidates?: string[];
  category?: string;
}

interface DbMessageFile {
  id: string;
  file_name: string;
  content_type: string;
  file_size: number | null;
  url: string;
}

interface DbMessage {
  id: string;
  content: string;
  type: 'user' | 'assistant';
  chat_type: string;
  created_at: string;
  updated_at: string;
  files?: DbMessageFile[];
}

const convertDbMessageToUIMessage = (dbMessage: DbMessage): UIMessage => {
  const parts: UIMessage['parts'] = [];

  if (dbMessage.files && dbMessage.files.length > 0) {
    for (const file of dbMessage.files) {
      parts.push({
        type: 'file',
        url: file.url,
        mediaType: file.content_type,
        filename: file.file_name,
      } as UIMessage['parts'][number]);
    }
  }

  if (dbMessage.content) {
    parts.push({ type: 'text', text: dbMessage.content });
  }

  return {
    id: dbMessage.id,
    role: dbMessage.type === 'user' ? 'user' : 'assistant',
    parts,
  };
};

// Helper component to expose scrollToBottom from inside StickToBottom context
const ScrollHelper = ({ scrollRef }: { scrollRef: React.MutableRefObject<(() => void) | null> }) => {
  const { scrollToBottom } = useStickToBottomContext();
  useEffect(() => {
    scrollRef.current = scrollToBottom;
  }, [scrollToBottom, scrollRef]);
  return null;
};

const fetchMessages = async (roomId: string): Promise<UIMessage[]> => {
  try {
    const data = await getMessages(roomId);
    return (data.messages || []).map(convertDbMessageToUIMessage);
  } catch (error) {
    console.error('Failed to fetch messages:', error);
    return [];
  }
};

const ChatRoom = ({
  roomId,
  requestId,
  chatType,
  topicId,
  isInputDisabled,
  url,
  apiKey,
  fileIds
}: {
  roomId: string,
  requestId: string,
  chatType: 'hearing' | 'topic' | undefined,
  topicId: string,
  isInputDisabled: boolean,
  url: string,
  apiKey?: string,
  fileIds?: string[]
}) => {
  const [input, setInput] = useState('');
  const [webSearch, setWebSearch] = useState(false);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [currentSuggestionId, setCurrentSuggestionId] = useState<string | undefined>(undefined);
  const scrollToBottomRef = useRef<(() => void) | null>(null);

  const loadMessages = useCallback(async () => {
    if (!roomId) {
      setIsLoadingMessages(false);
      return;
    }
    setIsLoadingMessages(true);
    const messages = await fetchMessages(roomId);
    setInitialMessages(messages);
    setIsLoadingMessages(false);
  }, [roomId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const { messages, sendMessage, status, regenerate, setMessages, error } = useChat({
    transport: new DefaultChatTransport({
      api: url,
      headers: {
        'x-api-key': apiKey || '',
      },
    }),
  });

  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages(initialMessages);
      // Ensure scroll to bottom after initial messages are rendered
      setTimeout(() => {
        scrollToBottomRef.current?.();
      }, 200);
    }
  }, [initialMessages, setMessages]);

  useEffect(() => {
    if (!isLoadingMessages && initialMessages.length === 0 && chatType === 'hearing' && url) {
      sendMessage(
        { text: '__INITIAL_MESSAGE__' },
        {
          body: {
            room_id: roomId,
            request_id: requestId,
            topic_id: topicId,
          },
        },
      );
    }
  }, [isLoadingMessages, initialMessages.length, chatType, url, roomId, requestId, topicId]);

  const fetchSuggestions = useCallback(async () => {
    if (!url) return;
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const baseUrl = new URL(url).origin;
      const res = await fetch(`${baseUrl}/api/suggestions?source=generated&request_id=${requestId}`, {
        headers: { 'x-api-key': apiKey || '' },
      });
      const data = await res.json();
      if (data.suggestions?.length > 0) {
        setSuggestions(data.suggestions);
        if (data.hearingSuggestionId) {
          setCurrentSuggestionId(data.hearingSuggestionId);
        } else {
          setCurrentSuggestionId(undefined);
        }
        setTimeout(() => {
          scrollToBottomRef.current?.();
        }, 100);
      } else {
        setSuggestions([]);
        setCurrentSuggestionId(undefined);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      setSuggestions([]);
      setCurrentSuggestionId(undefined);
    }
  }, [url, requestId]);

  useEffect(() => {
    if (chatType === 'hearing' && !isInputDisabled && status === 'ready' && messages.length > 0) {
      fetchSuggestions();
    }
  }, [chatType, isInputDisabled, status, messages.length, fetchSuggestions]);

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    setSuggestions([]);
  };

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);
    if (!(hasText || hasAttachments)) {
      return;
    }
    sendMessage(
      {
        text: message.text || (hasAttachments ? 'ファイルを送信しました' : ''),
        files: message.files
      },
      {
        body: {
          webSearch: webSearch,
          room_id: roomId,
          request_id: requestId,
          topic_id: topicId,
          hearing_suggestion_id: currentSuggestionId,
          ...(fileIds && fileIds.length > 0 ? { file_ids: fileIds } : {}),
        },
      },
    )
    setInput('');
    setSuggestions([]);
    setCurrentSuggestionId(undefined);
  };

  if (isLoadingMessages) {
    return (
      <div className="mx-auto p-6 relative size-full h-screen w-full flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="mx-auto p-6 relative size-full h-full w-full overflow-hidden">
      <div className="flex flex-col h-full min-h-0">
        <Conversation>
          <ScrollHelper scrollRef={scrollToBottomRef} />
          <ConversationContent className="conversation-content">
            {messages.filter((message) => {
              const textPart = message.parts.find((part) => part.type === 'text');
              return !(textPart && 'text' in textPart && textPart.text === '__INITIAL_MESSAGE__');
            }).map((message) => (
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
                              {stripHearingMeta(part.text)}
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
                                  navigator.clipboard.writeText(stripHearingMeta(part.text))
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
                          className="w-full reasoning"
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
        {suggestions.length > 0 && (
          <Suggestions className="suggestions mt-4" >
            {suggestions.flatMap((s, sIdx) => {
              const candidates = s.answerCandidates || [];
              return candidates.map((candidate, cIdx) => {
                const text = typeof candidate === 'string' ? candidate : (candidate as { answer_text: string }).answer_text;
                return (
                  <Suggestion
                    key={`suggestion-${sIdx}-${cIdx}`}
                    suggestion={text}
                    onClick={handleSuggestionClick}
                  />
                );
              });
            })}
          </Suggestions>
        )}
        {!isInputDisabled && (
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
                className="prompt-input-textarea"
              />
            </PromptInputBody>
            <PromptInputFooter className="prompt-input-footer">
              <PromptInputTools>
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger />
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments />
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>
                <PromptInputButton
                  variant={webSearch ? 'default' : 'ghost'}
                  onClick={() => setWebSearch(!webSearch)}
                >
                  <GlobeIcon size={16} />
                  <span>Search</span>
                </PromptInputButton>
              </PromptInputTools>
              <PromptInputSubmit className="prompt-input-submit" disabled={!input && !status} status={status} />
            </PromptInputFooter>
          </PromptInput>
        )}
      </div>
    </div>
  );
};
export { ChatRoom };
