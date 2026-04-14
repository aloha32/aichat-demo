import { z } from "zod";

const providerModeSchema = z.enum(["mock", "openai-compatible"]);

export type ProviderMode = z.infer<typeof providerModeSchema>;

function normalizeOpenAiBaseUrl(value?: string | null): string {
  const trimmed = (value?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");

  // Right Code's Codex-compatible endpoint expects the `/v1` suffix.
  if (/^https:\/\/(www\.)?right\.codes\/codex$/i.test(trimmed)) {
    return `${trimmed}/v1`;
  }

  return trimmed;
}

export interface ServerConfig {
  demoApiKey: string;
  mockChunkDelayMs: number;
  openAiApiKey: string;
  openAiBaseUrl: string;
  openAiModel: string;
  provider: ProviderMode;
}

export function resolveProviderMode(value?: string | null): ProviderMode {
  const parsed = providerModeSchema.safeParse(value);
  return parsed.success ? parsed.data : "mock";
}

export function getServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const parsedDelay = z.coerce.number().int().min(0).safeParse(env.MOCK_STREAM_DELAY_MS ?? "16");

  return {
    demoApiKey: env.DEMO_API_KEY?.trim() || "demo-chat-key",
    mockChunkDelayMs: parsedDelay.success ? parsedDelay.data : 16,
    openAiApiKey: env.OPENAI_API_KEY?.trim() || "",
    openAiBaseUrl: normalizeOpenAiBaseUrl(env.OPENAI_BASE_URL),
    openAiModel: env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
    provider: resolveProviderMode(env.AI_PROVIDER),
  };
}
