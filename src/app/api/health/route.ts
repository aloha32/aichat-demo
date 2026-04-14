import { getServerConfig } from "@/lib/server/env";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const config = getServerConfig();

  return Response.json({
    ok: true,
    provider: config.provider,
    model: config.openAiModel,
    timestamp: new Date().toISOString(),
  });
}
