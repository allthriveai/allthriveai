/**
 * Types for the Social Clip Creator feature
 */

export type ClipTemplate = 'quick_tip' | 'explainer' | 'how_to' | 'comparison';

export type SceneType = 'hook' | 'point' | 'example' | 'cta' | 'comparison_a' | 'comparison_b' | 'winner';

/**
 * Visual element types for rich scene content
 */
export type VisualType = 'image' | 'icon' | 'code' | 'emoji' | 'avatar' | 'screenshot';

export interface VisualElement {
  type: VisualType;
  /** URL for images/screenshots/avatars */
  src?: string;
  /** Icon name (FontAwesome) e.g., 'robot', 'brain', 'bolt' */
  icon?: string;
  /** Code content with optional language */
  code?: string;
  codeLanguage?: string;
  /** Emoji character */
  emoji?: string;
  /** Alt text for accessibility */
  alt?: string;
  /** Position: 'center' | 'left' | 'right' | 'background' | 'floating' */
  position?: 'center' | 'left' | 'right' | 'background' | 'floating';
  /** Size: 'small' | 'medium' | 'large' | 'full' */
  size?: 'small' | 'medium' | 'large' | 'full';
  /** Animation style */
  animation?: 'fade' | 'slide' | 'zoom' | 'bounce' | 'pulse' | 'float';
}

export interface SceneContent {
  headline?: string;
  body?: string;
  /** Code block with syntax highlighting */
  code?: string;
  codeLanguage?: string;
  bullets?: string[];
  /** Primary visual element (image, icon, etc.) */
  visual?: VisualElement;
  /** Secondary visuals (decorative elements) */
  decorations?: VisualElement[];
  /** Background image URL */
  backgroundImage?: string;
  /** Background gradient override */
  backgroundGradient?: string;
}

export interface Scene {
  id: string;
  type: SceneType;
  timing: {
    start: number; // ms
    end: number;   // ms
  };
  content: SceneContent;
}

export interface ClipStyle {
  primaryColor: string;
  accentColor: string;
}

export interface SocialClipContent {
  template: ClipTemplate;
  scenes: Scene[];
  duration: number; // total ms
  style: ClipStyle;
  sourceLesson?: number; // optional lesson ID if derived from lesson
}

/**
 * Preview update payload from the clip agent
 */
export interface ClipPreviewUpdate {
  action: 'update_preview';
  clip_data: SocialClipContent;
}

/**
 * Helper to check if a message contains a clip preview update
 */
export function isClipPreviewUpdate(data: unknown): data is ClipPreviewUpdate {
  return (
    typeof data === 'object' &&
    data !== null &&
    'action' in data &&
    (data as ClipPreviewUpdate).action === 'update_preview' &&
    'clip_data' in data
  );
}

/**
 * Generate a unique scene ID
 */
export function generateSceneId(): string {
  return `scene-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate scene durations based on content
 * - Hook: 4-5 seconds
 * - Points: ~8-10 seconds each (based on word count)
 * - CTA: 4-5 seconds
 */
export function calculateSceneDuration(scene: Scene): number {
  const { type, content } = scene;

  switch (type) {
    case 'hook':
      return 4500; // 4.5 seconds
    case 'cta':
      return 4500; // 4.5 seconds
    case 'point':
    case 'example': {
      // Base duration + extra time for content
      const wordCount = [
        content.headline || '',
        content.body || '',
        ...(content.bullets || []),
      ].join(' ').split(/\s+/).length;

      // ~150 wpm reading speed
      const readingTime = (wordCount / 150) * 60 * 1000;
      return Math.max(8000, Math.min(12000, readingTime + 3000));
    }
    case 'comparison_a':
    case 'comparison_b':
      return 6000; // 6 seconds each
    case 'winner':
      return 5000; // 5 seconds
    default:
      return 8000; // 8 seconds default
  }
}

/**
 * Calculate total clip duration from scenes
 */
export function calculateTotalDuration(scenes: Scene[]): number {
  if (scenes.length === 0) return 0;
  const lastScene = scenes[scenes.length - 1];
  return lastScene.timing.end;
}

/**
 * Get the current scene based on elapsed time
 */
export function getCurrentScene(scenes: Scene[], currentTime: number): Scene | null {
  return scenes.find(
    (scene) => currentTime >= scene.timing.start && currentTime < scene.timing.end
  ) || null;
}

/**
 * Get progress through current scene (0-1)
 */
export function getSceneProgress(scene: Scene, currentTime: number): number {
  const duration = scene.timing.end - scene.timing.start;
  const elapsed = currentTime - scene.timing.start;
  return Math.min(1, Math.max(0, elapsed / duration));
}
