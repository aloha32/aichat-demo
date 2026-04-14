import { handleChatRequest } from "@/lib/server/chat-handler";
import { getServerConfig } from "@/lib/server/env";
import { jsonError } from "@/lib/server/http";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  const config = getServerConfig();

  if (authHeader !== `Bearer ${config.demoApiKey}`) {
    return jsonError("测试接口的 demo API key 缺失或无效。", 401);
  }

  return handleChatRequest(request, { forceProvider: "mock" });
}
