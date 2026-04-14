"use client";

import { startTransition, useEffect, useRef, useState } from "react";

import {
  healthResponseSchema,
  type ApiMessage,
  type ChatConversation,
  type ChatMessage,
  type ChatStore,
  type HealthResponse,
} from "@/lib/chat/types";
import { createChatStorage } from "@/lib/chat/storage";
import {
  createConversation,
  createMessage,
  formatConversationTime,
  generateConversationTitle,
  getConversationMessages,
  isUntitledConversation,
} from "@/lib/chat/utils";
import { MarkdownMessage } from "@/components/markdown-message";

const EMPTY_MESSAGES: ChatMessage[] = [];

function getProviderLabel(provider: string): string {
  if (provider === "mock") {
    return "模拟模式";
  }

  if (provider === "openai-compatible") {
    return "真实接口";
  }

  return provider;
}

function sortConversations(conversations: ChatConversation[]): ChatConversation[] {
  return [...conversations].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function updateConversationState(
  store: ChatStore,
  conversationId: string,
  nextMessages: ChatMessage[],
  timestamp: string,
  title?: string,
): ChatStore {
  return {
    ...store,
    activeConversationId: conversationId,
    conversations: sortConversations(
      store.conversations.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              updatedAt: timestamp,
              ...(title ? { title } : {}),
            }
          : conversation,
      ),
    ),
    messagesByConversation: {
      ...store.messagesByConversation,
      [conversationId]: nextMessages,
    },
  };
}

function updateMessageState(
  store: ChatStore,
  conversationId: string,
  messageId: string,
  patch: Partial<ChatMessage> & { error?: string | undefined },
  timestamp = new Date().toISOString(),
): ChatStore {
  const currentMessages = getConversationMessages(store, conversationId);
  const nextMessages = currentMessages.map((message) => {
    if (message.id !== messageId) {
      return message;
    }

    const nextMessage: ChatMessage = {
      ...message,
      ...patch,
    };

    if (!patch.error) {
      const withoutError = { ...nextMessage };
      delete withoutError.error;
      return withoutError;
    }

    return nextMessage;
  });

  return updateConversationState(store, conversationId, nextMessages, timestamp);
}

function toRequestMessages(messages: ChatMessage[], excludedMessageId?: string): ApiMessage[] {
  return messages
    .filter((message) => message.id !== excludedMessageId)
    .filter((message) => {
      if (!message.content.trim()) {
        return false;
      }

      if (message.role === "user") {
        return true;
      }

      return message.status === "done";
    })
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

function prepareInitialChatStore(store: ChatStore): ChatStore {
  const activeConversationId = store.activeConversationId;
  const activeMessages = activeConversationId
    ? getConversationMessages(store, activeConversationId)
    : EMPTY_MESSAGES;

  if (activeMessages.length === 0) {
    return store;
  }

  const existingDraft = sortConversations(store.conversations).find(
    (conversation) => getConversationMessages(store, conversation.id).length === 0,
  );

  if (existingDraft) {
    return {
      ...store,
      activeConversationId: existingDraft.id,
      conversations: sortConversations(store.conversations),
    };
  }

  const conversation = createConversation();

  return {
    ...store,
    activeConversationId: conversation.id,
    conversations: [conversation, ...sortConversations(store.conversations)],
    messagesByConversation: {
      ...store.messagesByConversation,
      [conversation.id]: [],
    },
  };
}

function EmptyConversation() {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col justify-center px-6 py-10 text-center">
      <span className="mb-4 inline-flex w-fit self-center rounded-full border border-white/80 bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-teal-700 shadow-sm">
        AI 对话框
      </span>
      <h2 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
        开始第一轮对话
      </h2>
      <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg">
        输入你的问题，助手会以流式方式逐步返回内容。后续切换模型提供方时，不需要重写前端界面。
      </p>
      <div className="mt-8 grid gap-3 text-left md:grid-cols-3">
        <div className="rounded-3xl border border-white/80 bg-white/80 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
          <p className="text-sm font-semibold text-slate-900">流式回复</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            助手的输出会逐段出现，而不是等待整段内容一次性返回。
          </p>
        </div>
        <div className="rounded-3xl border border-white/80 bg-white/80 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
          <p className="text-sm font-semibold text-slate-900">本地历史记录</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            会话会保存到浏览器本地存储中，刷新页面后依然可以恢复。
          </p>
        </div>
        <div className="rounded-3xl border border-white/80 bg-white/80 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
          <p className="text-sm font-semibold text-slate-900">可测试接口</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            可以用 `/api/test/chat` 和测试令牌 `demo-chat-key` 验证完整联调链路。
          </p>
        </div>
      </div>
    </div>
  );
}

export function ChatShell() {
  const [store, setStore] = useState<ChatStore | null>(null);
  const [composerValue, setComposerValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const nextStore = prepareInitialChatStore(createChatStorage(window.localStorage).load());
    setStore(nextStore);
  }, []);

  useEffect(() => {
    if (!store) {
      return;
    }

    createChatStorage(window.localStorage).save(store);
  }, [store]);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch("/api/health", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("健康检查接口返回了非 200 状态码。");
        }

        const parsed = healthResponseSchema.safeParse(await response.json());

        if (!parsed.success) {
          throw new Error("健康检查返回的数据结构不合法。");
        }

        setHealth(parsed.data);
        setHealthError(null);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setHealth(null);
        setHealthError(error instanceof Error ? error.message : "无法读取当前服务状态。");
      }
    })();

    return () => controller.abort();
  }, []);

  const activeConversationId = store?.activeConversationId ?? null;
  const activeConversation =
    store?.conversations.find((conversation) => conversation.id === activeConversationId) ?? null;
  const activeMessages =
    store && activeConversationId
      ? getConversationMessages(store, activeConversationId)
      : EMPTY_MESSAGES;
  const retryCandidate = activeMessages.at(-1);
  const canRetry =
    retryCandidate?.role === "assistant" && retryCandidate.status === "error" && !isStreaming;

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({
      behavior: activeMessages.length > 1 ? "smooth" : "auto",
      block: "end",
    });
  }, [activeConversationId, activeMessages]);

  async function streamAssistantReply({
    assistantMessageId,
    conversationId,
    requestMessages,
  }: {
    assistantMessageId: string;
    conversationId: string;
    requestMessages: ApiMessage[];
  }): Promise<void> {
    setIsStreaming(true);

    let aggregate = "";

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          messages: requestMessages,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
          payload && typeof payload.error === "string"
            ? payload.error
            : "聊天请求在开始流式返回前失败。";
        throw new Error(message);
      }

      if (!response.body) {
        throw new Error("流式响应体不可用。");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        aggregate += decoder.decode(value, { stream: true });

        setStore((current) => {
          if (!current) {
            return current;
          }

          return updateMessageState(current, conversationId, assistantMessageId, {
            content: aggregate,
            status: "streaming",
          });
        });
      }

      aggregate += decoder.decode();

      setStore((current) => {
        if (!current) {
          return current;
        }

        return updateMessageState(current, conversationId, assistantMessageId, {
          content: aggregate.trimEnd(),
          status: "done",
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "流式请求失败。";

      setStore((current) => {
        if (!current) {
          return current;
        }

        return updateMessageState(current, conversationId, assistantMessageId, {
          content: aggregate.trimEnd(),
          error: message,
          status: "error",
        });
      });
    } finally {
      setIsStreaming(false);
    }
  }

  async function handleSubmitPrompt(): Promise<void> {
    if (!store || !activeConversationId || !activeConversation || isStreaming) {
      return;
    }

    const trimmed = composerValue.trim();

    if (!trimmed) {
      return;
    }

    const timestamp = new Date().toISOString();
    const currentMessages = getConversationMessages(store, activeConversationId);
    const userMessage = createMessage({
      content: trimmed,
      conversationId: activeConversationId,
      role: "user",
      timestamp,
    });
    const assistantMessage = createMessage({
      content: "",
      conversationId: activeConversationId,
      role: "assistant",
      status: "streaming",
      timestamp,
    });
    const nextMessages = [...currentMessages, userMessage, assistantMessage];
    const nextTitle =
      isUntitledConversation(activeConversation) &&
      !currentMessages.some((message) => message.role === "user")
        ? generateConversationTitle(trimmed)
        : activeConversation.title;

    setComposerValue("");
    setStore(updateConversationState(store, activeConversationId, nextMessages, timestamp, nextTitle));

    await streamAssistantReply({
      assistantMessageId: assistantMessage.id,
      conversationId: activeConversationId,
      requestMessages: toRequestMessages(nextMessages, assistantMessage.id),
    });
  }

  async function handleRetry(): Promise<void> {
    if (!store || !activeConversationId || !retryCandidate || retryCandidate.status !== "error") {
      return;
    }

    const timestamp = new Date().toISOString();
    const currentMessages = getConversationMessages(store, activeConversationId);
    const updatedMessages = currentMessages.map((message) =>
      message.id === retryCandidate.id
        ? {
            ...message,
            content: "",
            status: "streaming" as const,
          }
        : message,
    );

    setStore(updateConversationState(store, activeConversationId, updatedMessages, timestamp));

    await streamAssistantReply({
      assistantMessageId: retryCandidate.id,
      conversationId: activeConversationId,
      requestMessages: toRequestMessages(updatedMessages, retryCandidate.id),
    });
  }

  function handleCreateConversation(): void {
    if (!store) {
      return;
    }

    const conversation = createConversation();

    startTransition(() => {
      setStore((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          activeConversationId: conversation.id,
          conversations: [conversation, ...current.conversations],
          messagesByConversation: {
            ...current.messagesByConversation,
            [conversation.id]: [],
          },
        };
      });
    });

    setComposerValue("");
    setMobileSidebarOpen(false);
    composerRef.current?.focus();
  }

  function handleSelectConversation(conversationId: string): void {
    if (!store) {
      return;
    }

    startTransition(() => {
      setStore((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          activeConversationId: conversationId,
        };
      });
    });

    setMobileSidebarOpen(false);
  }

  if (!store) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[var(--app-bg)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.16),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.08),_transparent_30%)]" />
        <div className="relative mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6">
          <div className="rounded-[2rem] border border-white/70 bg-white/80 px-6 py-4 text-sm font-medium text-slate-600 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur">
            正在加载聊天工作区...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--app-bg)] text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.18),_transparent_34%),radial-gradient(circle_at_80%_10%,_rgba(148,163,184,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(244,114,182,0.12),_transparent_30%)]" />
      <div className="pointer-events-none absolute left-6 top-8 h-40 w-40 rounded-full bg-teal-300/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-slate-400/15 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-[1600px] gap-4 px-4 py-4 md:px-6 md:py-6">
        <button
          aria-label="关闭侧边栏"
          className={`fixed inset-0 z-20 bg-slate-950/30 backdrop-blur-sm transition md:hidden ${
            mobileSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => setMobileSidebarOpen(false)}
          type="button"
        />

        <aside
          className={`fixed left-4 top-4 z-30 flex h-[calc(100vh-2rem)] w-[18.5rem] flex-col rounded-[2rem] border border-white/80 bg-white/72 p-4 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl transition md:static md:z-0 md:h-auto md:translate-x-0 ${
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-[120%]"
          }`}
        >
          <div className="mb-4 rounded-[1.6rem] bg-slate-950 px-4 py-4 text-white shadow-[0_18px_60px_rgba(15,23,42,0.24)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-300">
              中文模式
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">中文 AI 对话框</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              支持本地历史记录、流式输出和可切换的模型服务接口。
            </p>
          </div>

          <button
            className="inline-flex items-center justify-center rounded-full bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-300"
            data-testid="new-chat-button"
            disabled={isStreaming}
            onClick={handleCreateConversation}
            type="button"
          >
            新建对话
          </button>

          <div className="mt-5 flex-1 overflow-hidden">
            <div className="mb-3 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              <span>会话列表</span>
              <span>{store.conversations.length}</span>
            </div>
            <div className="flex h-full flex-col gap-2 overflow-y-auto pr-1">
              {store.conversations.map((conversation) => {
                const isActive = conversation.id === activeConversationId;
                const messages = getConversationMessages(store, conversation.id);
                const preview =
                  [...messages].reverse().find((message) => message.content.trim())?.content ?? "暂无消息";

                return (
                  <button
                    className={`rounded-[1.4rem] border px-4 py-3 text-left transition ${
                      isActive
                        ? "border-slate-950 bg-slate-950 text-white shadow-[0_20px_50px_rgba(15,23,42,0.24)]"
                        : "border-white/80 bg-white/70 text-slate-900 hover:border-teal-200 hover:bg-white"
                    }`}
                    data-testid={`conversation-item-${conversation.id}`}
                    key={conversation.id}
                    onClick={() => handleSelectConversation(conversation.id)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold">{conversation.title}</p>
                      <span
                        className={`shrink-0 text-[11px] uppercase tracking-[0.2em] ${
                          isActive ? "text-teal-200" : "text-slate-400"
                        }`}
                      >
                        {formatConversationTime(conversation.updatedAt)}
                      </span>
                    </div>
                    <p
                      className={`mt-2 line-clamp-2 text-sm leading-6 ${
                        isActive ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {preview}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">存储方式</p>
            <p className="mt-2 leading-6">当前会话历史保存在浏览器本地存储中。</p>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col rounded-[2.2rem] border border-white/80 bg-white/74 shadow-[0_30px_100px_rgba(15,23,42,0.1)] backdrop-blur-xl">
          <header className="flex items-center justify-between gap-4 border-b border-slate-200/70 px-4 py-4 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-xl text-slate-700 shadow-sm transition hover:border-teal-300 hover:text-teal-700 md:hidden"
                onClick={() => setMobileSidebarOpen(true)}
                type="button"
              >
                |||
              </button>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  当前会话
                </p>
                <h2 className="truncate text-xl font-semibold tracking-tight text-slate-950">
                  {activeConversation?.title ?? "未命名对话"}
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="rounded-full border border-white/80 bg-white/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                本地历史
              </span>
              {health ? (
                <span className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-teal-200">
                  {getProviderLabel(health.provider)} / {health.model}
                </span>
              ) : (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                  {healthError ? "服务状态不可用" : "正在检查服务状态"}
                </span>
              )}
            </div>
          </header>

          <section
            className="flex-1 overflow-y-auto px-4 py-6 md:px-6"
            data-testid="message-list"
          >
            {activeMessages.length === 0 ? (
              <EmptyConversation />
            ) : (
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
                {activeMessages.map((message, index) => {
                  const isAssistant = message.role === "assistant";
                  const isRetryTarget = canRetry && retryCandidate?.id === message.id;

                  return (
                    <article
                      className={`group rounded-[2rem] border px-5 py-4 shadow-[0_18px_50px_rgba(15,23,42,0.05)] ${
                        isAssistant
                          ? "border-white/80 bg-white/92"
                          : "ml-auto border-slate-950 bg-slate-950 text-white"
                      }`}
                      data-testid={`${message.role}-message`}
                      key={message.id}
                    >
                      <div className="mb-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-semibold ${
                              isAssistant
                                ? "bg-teal-100 text-teal-700"
                                : "bg-white/12 text-white"
                            }`}
                            >
                              {isAssistant ? "助" : "我"}
                            </span>
                          <div>
                            <p
                              className={`text-sm font-semibold ${
                                isAssistant ? "text-slate-900" : "text-white"
                              }`}
                            >
                              {isAssistant ? "助手" : "我"}
                            </p>
                            <p
                              className={`text-xs uppercase tracking-[0.2em] ${
                                isAssistant ? "text-slate-400" : "text-slate-300"
                              }`}
                            >
                              {formatConversationTime(message.createdAt)}
                            </p>
                          </div>
                        </div>

                        {message.status === "streaming" ? (
                          <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
                            生成中
                          </span>
                        ) : null}
                      </div>

                      <div
                        className={`text-[15px] leading-7 ${
                          isAssistant ? "text-slate-700" : "text-slate-100"
                        }`}
                      >
                        {message.content ? (
                          <MarkdownMessage content={message.content} />
                        ) : message.status === "streaming" ? (
                          <p className="text-sm text-slate-500">正在思考...</p>
                        ) : (
                          <p className="text-sm text-slate-500">暂无内容。</p>
                        )}
                      </div>

                      {message.status === "error" && message.error ? (
                        <div className="mt-4 rounded-[1.4rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                          <p className="font-semibold">请求失败</p>
                          <p className="mt-1 leading-6">{message.error}</p>
                          {isRetryTarget ? (
                            <button
                              className="mt-3 inline-flex items-center justify-center rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
                              onClick={() => void handleRetry()}
                              type="button"
                            >
                              重新生成回复
                            </button>
                          ) : null}
                        </div>
                      ) : null}

                      {index === activeMessages.length - 1 && message.status === "streaming" ? (
                        <div className="mt-4 flex gap-2">
                          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-teal-500" />
                          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-teal-400 [animation-delay:120ms]" />
                          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-teal-300 [animation-delay:240ms]" />
                        </div>
                      ) : null}
                    </article>
                  );
                })}
                <div ref={scrollAnchorRef} />
              </div>
            )}
          </section>

          <footer className="border-t border-slate-200/70 px-4 py-4 md:px-6">
            <div className="mx-auto max-w-4xl">
              <form
                className="rounded-[2rem] border border-white/80 bg-white/92 p-3 shadow-[0_18px_60px_rgba(15,23,42,0.07)]"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSubmitPrompt();
                }}
              >
                <label className="sr-only" htmlFor="chat-input">
                  聊天输入框
                </label>
                <textarea
                  className="min-h-32 w-full resize-none rounded-[1.5rem] border border-transparent bg-transparent px-4 py-4 text-base leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-200"
                  data-testid="chat-input"
                  id="chat-input"
                  onChange={(event) => setComposerValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSubmitPrompt();
                    }
                  }}
                  placeholder="请输入你的问题。回车发送，Shift + Enter 换行。"
                  ref={composerRef}
                  value={composerValue}
                />

                <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 px-2 pt-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-600">
                      {isStreaming ? "正在流式生成回复..." : "回车发送"}
                    </span>
                    <span className="rounded-full bg-teal-50 px-3 py-1.5 font-medium text-teal-700">
                      测试令牌：demo-chat-key
                    </span>
                    {canRetry ? (
                      <span className="rounded-full bg-rose-50 px-3 py-1.5 font-medium text-rose-700">
                        上一次回复失败，可重新生成。
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    {canRetry ? (
                      <button
                        className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isStreaming}
                        onClick={() => void handleRetry()}
                        type="button"
                      >
                        重试
                      </button>
                    ) : null}
                    <button
                      className="inline-flex min-w-32 items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      data-testid="send-button"
                      disabled={!composerValue.trim() || isStreaming}
                      type="submit"
                    >
                      {isStreaming ? "发送中..." : "发送消息"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
