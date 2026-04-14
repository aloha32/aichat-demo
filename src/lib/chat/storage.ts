import type { ChatStore } from "@/lib/chat/types";
import { chatStoreSchema } from "@/lib/chat/types";
import { buildInitialStore } from "@/lib/chat/utils";

const STORAGE_KEY = "aichat-demo.chat-store";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface ChatStorage {
  clear(): void;
  load(): ChatStore;
  save(store: ChatStore): void;
}

export function normalizeChatStore(candidate: unknown): ChatStore {
  const parsed = chatStoreSchema.safeParse(candidate);

  if (!parsed.success) {
    return buildInitialStore();
  }

  const store = parsed.data;

  if (store.conversations.length === 0) {
    return buildInitialStore();
  }

  const activeConversationId = store.conversations.some(
    (conversation) => conversation.id === store.activeConversationId,
  )
    ? store.activeConversationId
    : store.conversations[0].id;

  const messagesByConversation = Object.fromEntries(
    store.conversations.map((conversation) => [
      conversation.id,
      [...(store.messagesByConversation[conversation.id] ?? [])].sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt),
      ),
    ]),
  );

  return {
    ...store,
    activeConversationId,
    messagesByConversation,
  };
}

export function createChatStorage(storage: StorageLike): ChatStorage {
  return {
    clear() {
      storage.removeItem(STORAGE_KEY);
    },
    load() {
      const raw = storage.getItem(STORAGE_KEY);

      if (!raw) {
        return buildInitialStore();
      }

      try {
        return normalizeChatStore(JSON.parse(raw));
      } catch {
        return buildInitialStore();
      }
    },
    save(store) {
      storage.setItem(STORAGE_KEY, JSON.stringify(normalizeChatStore(store)));
    },
  };
}

export function loadBrowserChatStore(): ChatStore {
  if (typeof window === "undefined") {
    return buildInitialStore();
  }

  return createChatStorage(window.localStorage).load();
}
