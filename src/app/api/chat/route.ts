import { handleChatRequest } from "@/lib/server/chat-handler";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return handleChatRequest(request);
}
