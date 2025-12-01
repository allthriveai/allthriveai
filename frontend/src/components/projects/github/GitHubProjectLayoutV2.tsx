/**
 * GitHubProjectLayoutV2 - Component-based layout for GitHub projects
 *
 * This layout uses the new ProjectComponents system to render
 * GitHub repositories with a dynamic, AI-selected component arrangement.
 */

import type { Project } from '@/types/models';
import { ProjectComponents } from '@/components/project-components';
import { getProjectComponentLayout } from '@/lib/generators';

interface GitHubProjectLayoutV2Props {
  project: Project;
}

export function GitHubProjectLayoutV2({ project }: GitHubProjectLayoutV2Props) {
  // Get or generate the component layout for this project
  const layout = getProjectComponentLayout(project);

  if (!layout || layout.components.length === 0) {
    // Fallback message if no layout could be generated
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Unable to generate layout
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          This project doesn't have enough data to generate a component layout.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <ProjectComponents layout={layout} />
    </div>
  );
}
