/**
 * TypeScript types for Community Messaging
 *
 * All types use camelCase as the axios interceptors handle
 * automatic conversion from snake_case API responses.
 */

// Room types
export type RoomType = 'forum' | 'circle' | 'dm';
export type RoomVisibility = 'public' | 'private' | 'unlisted';
export type MemberRole = 'owner' | 'admin' | 'moderator' | 'trusted' | 'member' | 'muted' | 'banned';
export type MessageType = 'text' | 'image' | 'file' | 'embed' | 'system' | 'deleted';

export interface UserMinimal {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export interface Room {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  roomType: RoomType;
  visibility: RoomVisibility;
  creator: UserMinimal | null;
  autoThread: boolean;
  position: number;
  isDefault: boolean;
  slowModeSeconds: number;
  minTrustToJoin: number;
  memberCount: number;
  messageCount: number;
  onlineCount: number;
  lastMessageAt: string | null;
  isArchived: boolean;
  isMember: boolean;
  userRole: MemberRole | null;
  createdAt: string;
}

export interface RoomListItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  roomType: RoomType;
  visibility: RoomVisibility;
  memberCount: number;
  onlineCount: number;
  lastMessageAt: string | null;
  isDefault: boolean;
}

export interface Thread {
  id: string;
  room: string;
  parentMessage: string | null;
  title: string;
  creator: UserMinimal | null;
  isLocked: boolean;
  isPinned: boolean;
  isResolved: boolean;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface Message {
  id: string;
  roomId: string;
  threadId?: string;
  author: UserMinimal | null;
  content: string;
  messageType: MessageType;
  attachments: MessageAttachment[];
  mentions: string[];
  replyTo: ReplyPreview | null;
  reactionCounts: Record<string, number>;
  isEdited: boolean;
  isPinned: boolean;
  createdAt: string;
}

export interface MessageAttachment {
  url: string;
  name: string;
  size: number;
  type: string;
}

export interface ReplyPreview {
  id: string;
  content: string;
  author: {
    id: string | null;
    username: string;
  };
}

export interface RoomMembership {
  id: string;
  room: string;
  user: UserMinimal;
  role: MemberRole;
  trustScore: number;
  messagesSent: number;
  notificationsEnabled: boolean;
  notificationLevel: 'all' | 'mentions' | 'none';
  lastReadAt: string | null;
  joinedAt: string;
}

export interface DirectMessageThread {
  id: string;
  participants: UserMinimal[];
  isGroup: boolean;
  name: string;
  createdBy: UserMinimal | null;
  lastMessageAt: string | null;
  lastMessage: LastMessage | null;
  unreadCount: number;
  createdAt: string;
}

export interface LastMessage {
  content: string;
  author: {
    id: string | null;
    username: string;
  };
  createdAt: string;
}

// WebSocket event types
export interface CommunityWebSocketEvent {
  event: string;
  timestamp?: string;
}

export interface RoomStateEvent extends CommunityWebSocketEvent {
  event: 'room_state';
  room: {
    id: string;
    name: string;
    description: string;
    icon: string;
    roomType: RoomType;
    memberCount: number;
  };
  messages: Message[];
  onlineUsers: OnlineUser[];
}

export interface NewMessageEvent extends CommunityWebSocketEvent {
  event: 'new_message';
  message: Message;
}

export interface TypingEvent extends CommunityWebSocketEvent {
  event: 'typing';
  userId: string;
  username: string;
  isTyping: boolean;
}

export interface UserJoinedEvent extends CommunityWebSocketEvent {
  event: 'user_joined';
  userId: string;
  username: string;
  avatarUrl: string | null;
}

export interface UserLeftEvent extends CommunityWebSocketEvent {
  event: 'user_left';
  userId: string;
}

export interface MessageHistoryEvent extends CommunityWebSocketEvent {
  event: 'message_history';
  messages: Message[];
  hasMore: boolean;
  cursor: string | null;
}

export interface ErrorEvent extends CommunityWebSocketEvent {
  event: 'error';
  message: string;
}

export interface OnlineUser {
  userId: string;
  username: string;
}

// API request/response types
export interface CreateRoomRequest {
  name: string;
  description?: string;
  emoji?: string;
  visibility?: RoomVisibility;
}

export interface SendMessageRequest {
  content: string;
  attachments?: MessageAttachment[];
  mentions?: string[];
  replyToId?: string;
}

export interface CreateDMRequest {
  participantIds: string[];
  initialMessage?: string;
}

export interface MessageReactionRequest {
  emoji: string;
}

export interface ReportMessageRequest {
  reason: string;
}

// Component prop types
export interface RoomViewProps {
  roomId: string;
}

export interface MessageProps {
  message: Message;
  isOwn: boolean;
  onReply?: (message: Message) => void;
  onReact?: (messageId: string, emoji: string) => void;
}

export interface RoomListProps {
  rooms: RoomListItem[];
  selectedRoomId?: string;
  onRoomSelect: (roomId: string) => void;
}
