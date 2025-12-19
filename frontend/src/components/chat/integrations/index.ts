/**
 * Chat Integration Components
 *
 * Self-contained components for managing integration flows (GitHub, GitLab, Figma, YouTube).
 * Each flow component handles its own state machine: connect → install (if needed) → select → import.
 */

export { useIntegrationFlow } from './useIntegrationFlow';
export { GitHubFlow } from './GitHubFlow';
export { GitLabFlow } from './GitLabFlow';
export { FigmaFlow } from './FigmaFlow';
export { IntegrationPicker } from './IntegrationPicker';
