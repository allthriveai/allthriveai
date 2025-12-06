/**
 * Chat message persistence using localStorage.
 *
 * Provides session-based storage for chat messages so users can
 * close and reopen the chat to see their conversation history.
 *
 * Phase 1: localStorage for immediate persistence
 * Phase 2: Will integrate with Redis Agent Memory Server for
 *          cross-device sync, semantic search, and AI memory
 */

import type { ChatMessage } from '@/hooks/useIntelligentChat';
import { logError } from '@/utils/errorHandler';

// Storage configuration
const STORAGE_PREFIX = 'allthriveai_chat_';
const MAX_STORED_MESSAGES = 50; // Limit stored messages per conversation
const STORAGE_VERSION = 1;

interface StoredChatData {
  version: number;
  messages: SerializedChatMessage[];
  lastUpdated: string;
  conversationId: string;
}

// Serialized version of ChatMessage for storage
interface SerializedChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: string; // ISO string
  metadata?: {
    type?: 'text' | 'generating' | 'generated_image';
    imageUrl?: string;
    filename?: string;
    sessionId?: number;
    iterationNumber?: number;
  };
}

/**
 * Get the storage key for a conversation
 */
function getStorageKey(conversationId: string): string {
  return `${STORAGE_PREFIX}${conversationId}`;
}

/**
 * Serialize a ChatMessage for storage
 */
function serializeMessage(message: ChatMessage): SerializedChatMessage {
  return {
    ...message,
    timestamp: message.timestamp.toISOString(),
  };
}

/**
 * Deserialize a stored message back to ChatMessage
 */
function deserializeMessage(stored: SerializedChatMessage): ChatMessage {
  return {
    ...stored,
    timestamp: new Date(stored.timestamp),
  };
}

/**
 * Save chat messages to localStorage
 */
export function saveChatMessages(
  conversationId: string,
  messages: ChatMessage[]
): void {
  try {
    // Filter out 'generating' type messages - they're temporary
    const persistableMessages = messages.filter(
      (m) => m.metadata?.type !== 'generating'
    );

    // Only keep the last N messages
    const messagesToStore = persistableMessages.slice(-MAX_STORED_MESSAGES);

    const data: StoredChatData = {
      version: STORAGE_VERSION,
      messages: messagesToStore.map(serializeMessage),
      lastUpdated: new Date().toISOString(),
      conversationId,
    };

    localStorage.setItem(getStorageKey(conversationId), JSON.stringify(data));
  } catch (error) {
    // localStorage might be full or unavailable
    logError('ChatStorage.saveChatMessages', error, { conversationId, messageCount: messages.length });

    // Try to clear old conversations if storage is full
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      cleanupOldConversations();
    }
  }
}

/**
 * Load chat messages from localStorage
 */
export function loadChatMessages(conversationId: string): ChatMessage[] {
  try {
    const stored = localStorage.getItem(getStorageKey(conversationId));
    if (!stored) {
      return [];
    }

    const data: StoredChatData = JSON.parse(stored);

    // Version check for future migrations
    if (data.version !== STORAGE_VERSION) {
      console.warn('[ChatStorage] Version mismatch, clearing old data', { stored: data.version, current: STORAGE_VERSION });
      localStorage.removeItem(getStorageKey(conversationId));
      return [];
    }

    return data.messages.map(deserializeMessage);
  } catch (error) {
    logError('ChatStorage.loadChatMessages', error, { conversationId });
    return [];
  }
}

/**
 * Clear chat messages for a specific conversation
 */
export function clearChatMessages(conversationId: string): void {
  try {
    localStorage.removeItem(getStorageKey(conversationId));
  } catch (error) {
    logError('ChatStorage.clearChatMessages', error, { conversationId });
  }
}

/**
 * Clear all stored chat conversations
 */
export function clearAllChatMessages(): void {
  try {
    const keys = Object.keys(localStorage).filter((key) =>
      key.startsWith(STORAGE_PREFIX)
    );
    keys.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    logError('ChatStorage.clearAllChatMessages', error);
  }
}

/**
 * Get list of stored conversation IDs with their last update times
 */
export function getStoredConversations(): Array<{
  conversationId: string;
  lastUpdated: Date;
  messageCount: number;
}> {
  try {
    const conversations: Array<{
      conversationId: string;
      lastUpdated: Date;
      messageCount: number;
    }> = [];

    const keys = Object.keys(localStorage).filter((key) =>
      key.startsWith(STORAGE_PREFIX)
    );

    for (const key of keys) {
      const stored = localStorage.getItem(key);
      if (stored) {
        const data: StoredChatData = JSON.parse(stored);
        conversations.push({
          conversationId: data.conversationId,
          lastUpdated: new Date(data.lastUpdated),
          messageCount: data.messages.length,
        });
      }
    }

    // Sort by last updated, newest first
    return conversations.sort(
      (a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime()
    );
  } catch (error) {
    logError('ChatStorage.getStoredConversations', error);
    return [];
  }
}

/**
 * Clean up old conversations to free up storage space
 * Keeps the 10 most recent conversations
 */
function cleanupOldConversations(): void {
  try {
    const conversations = getStoredConversations();

    // Keep only the 10 most recent
    const toDelete = conversations.slice(10);

    for (const conv of toDelete) {
      localStorage.removeItem(getStorageKey(conv.conversationId));
    }
  } catch (error) {
    logError('ChatStorage.cleanupOldConversations', error);
  }
}

/**
 * Check if localStorage is available
 */
export function isStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}
