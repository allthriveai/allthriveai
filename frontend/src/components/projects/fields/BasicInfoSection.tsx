/**
 * BasicInfoSection - Reusable project title input
 * Part of the scalable ProjectFieldsEditor system
 */

interface BasicInfoSectionProps {
  projectTitle: string;
  setProjectTitle: (title: string) => void;
  isSaving?: boolean;
}

export function BasicInfoSection({
  projectTitle,
  setProjectTitle,
  isSaving = false,
}: BasicInfoSectionProps) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
        Project Title
      </label>
      <input
        type="text"
        value={projectTitle}
        onChange={(e) => setProjectTitle(e.target.value)}
        placeholder="Enter your project title"
        disabled={isSaving}
        className="w-full px-4 py-3 text-lg border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
      />
    </div>
  );
}
