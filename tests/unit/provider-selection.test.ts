import { describe, expect, it } from "vitest";

import { getServerConfig, resolveProviderMode } from "@/lib/server/env";
import { createProvider } from "@/lib/server/provider";

describe("provider selection", () => {
  it("falls back to mock when the provider value is invalid", () => {
    expect(resolveProviderMode("unknown-provider")).toBe("mock");
    expect(resolveProviderMode(undefined)).toBe("mock");
  });

  it("creates the mock provider by default", () => {
    const config = getServerConfig({ NODE_ENV: "test" } as NodeJS.ProcessEnv);
    const provider = createProvider(config);

    expect(provider.mode).toBe("mock");
  });

  it("creates the OpenAI-compatible provider when requested", () => {
    const config = getServerConfig({
      AI_PROVIDER: "openai-compatible",
      NODE_ENV: "test",
      OPENAI_API_KEY: "sk-test",
      OPENAI_BASE_URL: "https://example.com/v1/",
      OPENAI_MODEL: "demo-model",
    } as unknown as NodeJS.ProcessEnv);
    const provider = createProvider(config);

    expect(provider.mode).toBe("openai-compatible");
    expect(config.openAiBaseUrl).toBe("https://example.com/v1");
    expect(config.openAiModel).toBe("demo-model");
  });

  it("normalizes the Right Code Codex base url to include /v1", () => {
    const config = getServerConfig({
      AI_PROVIDER: "openai-compatible",
      NODE_ENV: "test",
      OPENAI_API_KEY: "sk-test",
      OPENAI_BASE_URL: "https://www.right.codes/codex",
      OPENAI_MODEL: "gpt-5.4-mini",
    } as unknown as NodeJS.ProcessEnv);

    expect(config.openAiBaseUrl).toBe("https://www.right.codes/codex/v1");
  });
});
