import { chatRequestSchema } from "@/lib/chat/types";
import type { ProviderMode } from "@/lib/server/env";
import { getServerConfig } from "@/lib/server/env";
import { createTextStreamResponse, getErrorMessage, jsonError } from "@/lib/server/http";
import { createProvider } from "@/lib/server/provider";

function streamFromIterator(
  iterator: AsyncIterator<string>,
  firstChunk: IteratorResult<string>,
): AsyncIterable<string> {
  return {
    async *[Symbol.asyncIterator]() {
      if (!firstChunk.done) {
        yield firstChunk.value;
      }

      while (true) {
        const next = await iterator.next();

        if (next.done) {
          return;
        }

        yield next.value;
      }
    },
  };
}

export async function handleChatRequest(
  request: Request,
  options?: {
    forceProvider?: ProviderMode;
  },
): Promise<Response> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("请求体必须是合法的 JSON。", 400);
  }

  const parsed = chatRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return jsonError("聊天请求参数校验失败。", 400, parsed.error.flatten());
  }

  const config = getServerConfig();
  const providerMode = options?.forceProvider ?? config.provider;

  if (providerMode === "openai-compatible" && !config.openAiApiKey) {
    return jsonError("OPENAI_API_KEY 尚未配置。", 500);
  }

  const provider = createProvider(config, providerMode);
  const stream = provider.streamChat({
    ...parsed.data,
    signal: request.signal,
  });
  const iterator = stream[Symbol.asyncIterator]();

  let firstChunk: IteratorResult<string>;

  try {
    firstChunk = await iterator.next();
  } catch (error) {
    return jsonError(getErrorMessage(error, "无法启动聊天流。"), 500);
  }

  return createTextStreamResponse(
    streamFromIterator(iterator, firstChunk),
  );
}
