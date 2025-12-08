
import type { Project } from '@/types/models';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

interface GitHubProjectPendingViewProps {
  project: Project;
}

export function GitHubProjectPendingView({ project }: GitHubProjectPendingViewProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Basic Project Info */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">{project.title}</h1>
        {project.description && (
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-6">{project.description}</p>
        )}
        {project.externalUrl && (
          <a
            href={project.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 underline"
          >
            View on GitHub →
          </a>
        )}
      </div>

      {/* Analyzing Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-lg border-2 border-dashed border-primary-300 dark:border-primary-700 mb-12">
        <div className="flex items-center justify-center mb-4">
          <ArrowPathIcon className="w-12 h-12 text-primary-600 dark:text-primary-400 animate-spin" />
        </div>
        <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
          Analyzing Repository...
        </h2>
        <p className="text-center text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          We're analyzing this GitHub repository to extract tech stack information, generate architecture diagrams,
          and create a comprehensive project overview. This usually takes 20-30 seconds.
        </p>
      </div>

      {/* Skeleton Loaders */}
      <div className="space-y-12">
        {/* Tech Stack Skeleton */}
        <div>
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-6 animate-pulse" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md"
              >
                <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse" />
                <div className="flex flex-wrap gap-2">
                  <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                  <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                  <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Architecture Diagram Skeleton */}
        <div>
          <div className="h-8 w-56 bg-gray-200 dark:bg-gray-700 rounded mb-6 animate-pulse" />
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>

        {/* Project Structure Skeleton */}
        <div>
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-6 animate-pulse" />
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: `${Math.random() * 40 + 40}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
