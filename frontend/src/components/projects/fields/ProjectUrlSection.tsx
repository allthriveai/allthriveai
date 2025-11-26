/**
 * ProjectUrlSection - Reusable external project URL input
 * Part of the scalable ProjectFieldsEditor system
 */

interface ProjectUrlSectionProps {
  projectUrl: string;
  setProjectUrl: (url: string) => void;
  isSaving?: boolean;
}

export function ProjectUrlSection({
  projectUrl,
  setProjectUrl,
  isSaving = false,
}: ProjectUrlSectionProps) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
        Project URL
      </label>
      <input
        type="url"
        value={projectUrl}
        onChange={(e) => setProjectUrl(e.target.value)}
        placeholder="https://example.com"
        disabled={isSaving}
        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
      />
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Link to live project, GitHub repo, or demo
      </p>
    </div>
  );
}
