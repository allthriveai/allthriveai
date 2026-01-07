/**
 * Onboarding chat message components
 *
 * Simplified onboarding flow:
 * 1. Intro → 2. Avatar creation → 3. Avatar preview → Complete
 * After onboarding, user lands on feelings-first home chat
 */

export { OnboardingIntroMessage } from './OnboardingIntroMessage';
export { AvatarTemplateSelector, defaultAvatarTemplates } from './AvatarTemplateSelector';
export { AvatarPreviewMessage } from './AvatarPreviewMessage';
export {
  LearningGoalSelectionMessage,
  learningGoalOptions,
  SAGE_COMPANION,
  AVA_COMPANION,
  type CompanionConfig,
} from './LearningGoalSelectionMessage';
// Note: PathSelectionMessage is kept for potential future use but not exported
// Note: ProfileSetupMessage has been removed - profile generation handled via Ava chat
