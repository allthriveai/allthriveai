/**
 * ToolsSection - Reusable tools & technologies selector
 * Part of the scalable ProjectFieldsEditor system
 */

import { ToolSelector } from '../ToolSelector';

interface ToolsSectionProps {
  projectTools: number[];
  setProjectTools: (tools: number[]) => void;
  isSaving?: boolean;
}

export function ToolsSection({
  projectTools,
  setProjectTools,
  isSaving = false,
}: ToolsSectionProps) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
        Tools & Technologies
      </label>
      <ToolSelector
        selectedToolIds={projectTools}
        onChange={setProjectTools}
        disabled={isSaving}
      />
    </div>
  );
}
