import { useState } from 'react';
import type { GitHubImportPreview } from '@/services/github';
import { FaStar, FaCodeBranch, FaExternalLinkAlt, FaArrowLeft, FaCheck } from 'react-icons/fa';

interface ImportPreviewProps {
  previewData: GitHubImportPreview;
  onConfirm: (title?: string, tldr?: string) => void;
  onBack: () => void;
  isImporting: boolean;
  error: string | null;
}

export function ImportPreview({ previewData, onConfirm, onBack, isImporting, error }: ImportPreviewProps) {
  const [editedTitle, setEditedTitle] = useState(previewData.title);
  const [editedTldr, setEditedTldr] = useState(previewData.tldr);
  const [showFullReadme, setShowFullReadme] = useState(false);

  const handleConfirm = () => {
    const finalTitle = editedTitle.trim() || previewData.title;
    const finalTldr = editedTldr.trim() || previewData.tldr;
    onConfirm(finalTitle, finalTldr);
  };

  const readmePreview = previewData.readmeContent?.slice(0, 500) || '';
  const hasMoreReadme = previewData.readmeContent && previewData.readmeContent.length > 500;

  return (
    <div className="space-y-6">
      {/* Repository Info Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            {previewData.language && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300">
                <span className="w-2 h-2 rounded-full bg-primary-500" />
                {previewData.language}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
              <FaStar className="w-3 h-3" />
              {previewData.stars}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
              <FaCodeBranch className="w-3 h-3" />
              {previewData.forks}
            </span>
          </div>

          {previewData.htmlUrl && (
            <a
              href={previewData.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary-400 hover:text-primary-300"
            >
              View on GitHub
              <FaExternalLinkAlt className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Editable Title */}
      <div>
        <label className="block text-sm font-semibold text-white mb-2">Project Title</label>
        <input
          type="text"
          value={editedTitle}
          onChange={(e) => setEditedTitle(e.target.value)}
          placeholder="Enter project title"
          disabled={isImporting}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
        />
      </div>

      {/* Editable TL;DR */}
      <div>
        <label className="block text-sm font-semibold text-white mb-2">
          TL;DR Summary
          <span className="ml-2 text-xs text-gray-400 font-normal">(AI-generated)</span>
        </label>
        <textarea
          value={editedTldr}
          onChange={(e) => setEditedTldr(e.target.value)}
          placeholder="Brief project summary..."
          disabled={isImporting}
          rows={3}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 resize-none"
        />
      </div>

      {/* Topics */}
      {previewData.topics && previewData.topics.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-white mb-2">Topics</label>
          <div className="flex flex-wrap gap-2">
            {previewData.topics.map((topic) => (
              <span
                key={topic}
                className="inline-flex items-center px-3 py-1 bg-gray-800 border border-gray-700 rounded-full text-xs text-gray-300"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* README Preview */}
      {previewData.readmeContent && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-semibold text-white">README Preview</label>
            {previewData.readmeHtmlUrl && (
              <a
                href={previewData.readmeHtmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
              >
                View full README
                <FaExternalLinkAlt className="w-3 h-3" />
              </a>
            )}
          </div>
          <div className="px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg">
            <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono overflow-x-auto">
              {showFullReadme ? previewData.readmeContent : readmePreview}
              {!showFullReadme && hasMoreReadme && '...'}
            </pre>
            {hasMoreReadme && (
              <button
                onClick={() => setShowFullReadme(!showFullReadme)}
                className="mt-2 text-xs text-primary-400 hover:text-primary-300"
              >
                {showFullReadme ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Repository Description (if different from TL;DR) */}
      {previewData.description && previewData.description !== previewData.tldr && (
        <div>
          <label className="block text-sm font-semibold text-white mb-2">Original Description</label>
          <p className="text-sm text-gray-400 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg">
            {previewData.description}
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-4">
        <button
          onClick={onBack}
          disabled={isImporting}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <FaArrowLeft className="w-4 h-4" />
          Back to Repos
        </button>
        <button
          onClick={handleConfirm}
          disabled={isImporting || !editedTitle.trim()}
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isImporting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <FaCheck className="w-4 h-4" />
              Confirm Import
            </>
          )}
        </button>
      </div>

      {/* Info Note */}
      <p className="text-xs text-gray-500 text-center">
        This will create a new project from your GitHub repository with all the details above
      </p>
    </div>
  );
}
