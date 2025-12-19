/**
 * Avatar types for AI-generated user avatars.
 *
 * Note: Uses camelCase to match frontend conventions.
 * The API service auto-transforms between snake_case (backend) and camelCase (frontend).
 */

export type CreationMode = 'make_me' | 'template' | 'scratch' | 'dicebear' | 'legacy';

export type SessionStatus = 'generating' | 'ready' | 'accepted' | 'abandoned' | 'failed';

export interface UserAvatar {
  id: number;
  imageUrl: string;
  creationMode: CreationMode;
  creationModeDisplay: string;
  templateUsed: string;
  originalPrompt: string;
  isCurrent: boolean;
  createdAt: string;
}

export interface AvatarGenerationIteration {
  id: number;
  prompt: string;
  imageUrl: string;
  order: number;
  isSelected: boolean;
  generationTimeMs: number | null;
  createdAt: string;
}

export interface AvatarGenerationSession {
  id: number;
  conversationId: string;
  creationMode: CreationMode;
  creationModeDisplay: string;
  templateUsed: string;
  referenceImageUrl: string | null;
  status: SessionStatus;
  statusDisplay: string;
  errorMessage: string;
  achievementAwarded: boolean;
  createdAt: string;
  updatedAt: string;
  iterations: AvatarGenerationIteration[];
  savedAvatar: UserAvatar | null;
}

export interface CreateSessionRequest {
  creationMode: CreationMode;
  templateUsed?: string;
  referenceImageUrl?: string;
}

export interface SetCurrentAvatarRequest {
  avatarId: number;
}

export interface AcceptIterationRequest {
  iterationId: number;
}

// Avatar templates available for "Create a Character" mode
export const AVATAR_TEMPLATES = {
  wizard: {
    id: 'wizard',
    name: 'Wizard',
    description: 'A wise wizard with mystical powers',
    icon: 'faHatWizard',
  },
  robot: {
    id: 'robot',
    name: 'Robot',
    description: 'A friendly futuristic robot',
    icon: 'faRobot',
  },
  creature: {
    id: 'creature',
    name: 'Creature',
    description: 'A cute magical creature',
    icon: 'faDragon',
  },
  astronaut: {
    id: 'astronaut',
    name: 'Astronaut',
    description: 'An adventurous space explorer',
    icon: 'faUserAstronaut',
  },
  superhero: {
    id: 'superhero',
    name: 'Superhero',
    description: 'A confident hero with powers',
    icon: 'faMask',
  },
  pirate: {
    id: 'pirate',
    name: 'Pirate',
    description: 'A swashbuckling adventurer',
    icon: 'faSkullCrossbones',
  },
  ninja: {
    id: 'ninja',
    name: 'Ninja',
    description: 'A mysterious warrior',
    icon: 'faUserNinja',
  },
  explorer: {
    id: 'explorer',
    name: 'Explorer',
    description: 'An adventurous discoverer',
    icon: 'faCompass',
  },
} as const;

export type AvatarTemplateId = keyof typeof AVATAR_TEMPLATES;

// WebSocket events for avatar generation
export interface AvatarWebSocketMessage {
  event: string;
  conversationId?: string;
  sessionId?: number;
  iterationId?: number;
  iterationNumber?: number;
  imageUrl?: string;
  textResponse?: string;
  message?: string;
  error?: string;
  timestamp?: string;
  taskId?: string;
}
