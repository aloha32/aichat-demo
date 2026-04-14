import OpenAI from "openai";

import { DEFAULT_SYSTEM_PROMPT, type ApiMessage } from "@/lib/chat/types";
import type { ProviderMode, ServerConfig } from "@/lib/server/env";

const mockFailureOnceCache = new Set<string>();

export interface ChatProviderInput {
  messages: ApiMessage[];
  model?: string;
  signal?: AbortSignal;
  systemPrompt?: string;
}

export interface ChatProvider {
  mode: ProviderMode;
  streamChat(input: ChatProviderInput): AsyncIterable<string>;
}

function splitIntoChunks(content: string, size = 18): string[] {
  const chunks: string[] = [];

  for (let index = 0; index < content.length; index += size) {
    chunks.push(content.slice(index, index + size));
  }

  return chunks;
}

async function sleep(durationMs: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

class MockChatProvider implements ChatProvider {
  readonly mode = "mock" as const;

  constructor(private readonly config: ServerConfig) {}

  async *streamChat(input: ChatProviderInput): AsyncIterable<string> {
    const lastUserMessage = [...input.messages].reverse().find((message) => message.role === "user");
    const prompt = lastUserMessage?.content.trim() ?? "";
    const failureKey = `${prompt}:${input.messages.length}`;

    if (prompt.includes("__mock_error__")) {
      throw new Error("Mock provider 被触发为固定失败。");
    }

    if (prompt.includes("__mock_error_once__") && !mockFailureOnceCache.has(failureKey)) {
      mockFailureOnceCache.add(failureKey);
      throw new Error("Mock provider 被触发为一次性失败。");
    }

    const reply = [
      "当前仍处于 Mock 模式，所以这段回复是本地生成的测试内容。",
      prompt ? `我收到的消息是：“${prompt.slice(0, 140)}”。` : "我没有收到用户消息。",
      `本次请求携带的对话轮数：${input.messages.length}。`,
      "如果要切换到真实模型，请把 AI_PROVIDER 改成 openai-compatible，并确认 OPENAI_API_KEY 已正确配置。",
    ].join("\n\n");

    for (const chunk of splitIntoChunks(reply)) {
      if (this.config.mockChunkDelayMs > 0) {
        await sleep(this.config.mockChunkDelayMs);
      }

      yield chunk;
    }
  }
}

class OpenAICompatibleProvider implements ChatProvider {
  readonly mode = "openai-compatible" as const;

  constructor(private readonly config: ServerConfig) {}

  async *streamChat(input: ChatProviderInput): AsyncIterable<string> {
    if (!this.config.openAiApiKey) {
      throw new Error("OPENAI_API_KEY 尚未配置。");
    }

    const client = new OpenAI({
      apiKey: this.config.openAiApiKey,
      baseURL: this.config.openAiBaseUrl,
    });

    const stream = await client.chat.completions.create(
      {
        model: input.model ?? this.config.openAiModel,
        messages: [
          {
            role: "system",
            content: input.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT,
          },
          ...input.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        ],
        stream: true,
      },
      {
        signal: input.signal,
      },
    );

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;

      if (typeof delta === "string" && delta.length > 0) {
        yield delta;
      }
    }
  }
}

export function createProvider(config: ServerConfig, mode = config.provider): ChatProvider {
  if (mode === "openai-compatible") {
    return new OpenAICompatibleProvider(config);
  }

  return new MockChatProvider(config);
}
