/**
 * Layout Generators
 *
 * Transform integration data into ProjectComponentLayout structures.
 * Each generator is responsible for a specific integration type.
 */

export {
  generateGitHubLayout,
  generateMinimalGitHubLayout,
  type GitHubRepoData,
  type GitHubAnalysisResult,
  type GitHubLayoutInput,
} from './github-layout-generator';

export {
  convertGitHubProjectToLayout,
  hasComponentLayout,
  getProjectComponentLayout,
} from './project-to-layout';
