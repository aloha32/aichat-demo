import type { ChatConversation, ChatMessage, ChatStore, MessageRole, MessageStatus } from "@/lib/chat/types";
import { STORAGE_VERSION } from "@/lib/chat/types";

const UNTITLED_CONVERSATION = "新对话";
const TITLE_LIMIT = 48;

export function generateConversationTitle(input: string): string {
  const normalized = input.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return UNTITLED_CONVERSATION;
  }

  if (normalized.length <= TITLE_LIMIT) {
    return normalized;
  }

  return `${normalized.slice(0, TITLE_LIMIT - 3).trimEnd()}...`;
}

export function createConversation(timestamp = new Date().toISOString()): ChatConversation {
  return {
    id: crypto.randomUUID(),
    title: UNTITLED_CONVERSATION,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createMessage({
  conversationId,
  role,
  content,
  status = "done",
  error,
  timestamp = new Date().toISOString(),
}: {
  conversationId: string;
  role: MessageRole;
  content: string;
  status?: MessageStatus;
  error?: string;
  timestamp?: string;
}): ChatMessage {
  return {
    id: crypto.randomUUID(),
    conversationId,
    role,
    content,
    createdAt: timestamp,
    status,
    ...(error ? { error } : {}),
  };
}

export function buildInitialStore(): ChatStore {
  const conversation = createConversation();

  return {
    version: STORAGE_VERSION,
    activeConversationId: conversation.id,
    conversations: [conversation],
    messagesByConversation: {
      [conversation.id]: [],
    },
  };
}

export function getConversationMessages(store: ChatStore, conversationId: string): ChatMessage[] {
  return store.messagesByConversation[conversationId] ?? [];
}

export function isUntitledConversation(conversation: ChatConversation): boolean {
  return conversation.title === UNTITLED_CONVERSATION;
}

export function formatConversationTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    month: "numeric",
    day: "numeric",
    hour12: false,
  }).format(date);
}
