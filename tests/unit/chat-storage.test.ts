import { describe, expect, it } from "vitest";

import { createChatStorage, normalizeChatStore } from "@/lib/chat/storage";
import type { ChatStore } from "@/lib/chat/types";

class MemoryStorage {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe("chat storage", () => {
  it("creates a usable default store when storage is empty", () => {
    const storage = createChatStorage(new MemoryStorage());
    const store = storage.load();

    expect(store.conversations).toHaveLength(1);
    expect(store.activeConversationId).toBe(store.conversations[0]?.id ?? null);
    expect(store.messagesByConversation[store.conversations[0]!.id]).toEqual([]);
  });

  it("normalizes invalid active conversation ids and sorts stored messages", () => {
    const candidate: ChatStore = {
      version: 1,
      activeConversationId: "missing",
      conversations: [
        {
          id: "conversation-1",
          title: "Conversation",
          createdAt: "2026-04-14T00:00:00.000Z",
          updatedAt: "2026-04-14T00:00:00.000Z",
        },
      ],
      messagesByConversation: {
        "conversation-1": [
          {
            id: "message-2",
            conversationId: "conversation-1",
            role: "assistant",
            content: "Second",
            createdAt: "2026-04-14T00:00:02.000Z",
            status: "done",
          },
          {
            id: "message-1",
            conversationId: "conversation-1",
            role: "user",
            content: "First",
            createdAt: "2026-04-14T00:00:01.000Z",
            status: "done",
          },
        ],
      },
    };

    const normalized = normalizeChatStore(candidate);

    expect(normalized.activeConversationId).toBe("conversation-1");
    expect(normalized.messagesByConversation["conversation-1"].map((message) => message.id)).toEqual([
      "message-1",
      "message-2",
    ]);
  });
});
