/**
 * LinksSection - Resources and external links
 *
 * Supports inline editing when isEditing=true for owners.
 */

import { useCallback } from 'react';
import {
  BookOpenIcon,
  VideoCameraIcon,
  LinkIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  NewspaperIcon,
  ArrowTopRightOnSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { InlineEditableTitle, InlineEditableText } from '../shared/InlineEditable';
import type { LinksSectionContent, ResourceLink } from '@/types/sections';

interface LinksSectionProps {
  content: LinksSectionContent;
  isEditing?: boolean;
  onUpdate?: (content: LinksSectionContent) => void;
}

const linkIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  book: BookOpenIcon,
  video: VideoCameraIcon,
  github: CodeBracketIcon,
  code: CodeBracketIcon,
  docs: DocumentTextIcon,
  article: NewspaperIcon,
  external: LinkIcon,
  default: LinkIcon,
};

function getLinkIcon(icon?: string): React.ComponentType<{ className?: string }> {
  if (!icon) return linkIcons.default;
  return linkIcons[icon.toLowerCase()] || linkIcons.default;
}

interface ResourceLinkCardProps {
  link: ResourceLink;
  index: number;
  isEditing?: boolean;
  isSubtle?: boolean;
  onUpdate?: (index: number, link: ResourceLink) => void;
  onDelete?: (index: number) => void;
}

function ResourceLinkCard({ link, index, isEditing, isSubtle, onUpdate, onDelete }: ResourceLinkCardProps) {
  const Icon = getLinkIcon(link.icon);

  const handleLabelChange = useCallback(
    async (newLabel: string) => {
      if (onUpdate) {
        onUpdate(index, { ...link, label: newLabel });
      }
    },
    [index, link, onUpdate]
  );

  const handleUrlChange = useCallback(
    async (newUrl: string) => {
      if (onUpdate) {
        onUpdate(index, { ...link, url: newUrl });
      }
    },
    [index, link, onUpdate]
  );

  const handleDescriptionChange = useCallback(
    async (newDescription: string) => {
      if (onUpdate) {
        onUpdate(index, { ...link, description: newDescription });
      }
    },
    [index, link, onUpdate]
  );

  const handleIconChange = useCallback(
    (newIcon: string) => {
      if (onUpdate) {
        onUpdate(index, { ...link, icon: newIcon });
      }
    },
    [index, link, onUpdate]
  );

  // Get hostname safely
  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return 'Enter a valid URL';
    }
  };

  if (isEditing) {
    return (
      <div className="group relative flex items-start gap-4 p-4 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700/50">
        {/* Delete button */}
        {onDelete && (
          <button
            onClick={() => onDelete(index)}
            className="absolute -top-2 -right-2 p-1.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 opacity-0 group-hover:opacity-100 transition-opacity z-10"
            title="Delete link"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}

        {/* Icon selector */}
        <div className="flex-shrink-0">
          <select
            value={link.icon || 'external'}
            onChange={(e) => handleIconChange(e.target.value)}
            className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 border-0 text-center cursor-pointer"
            title="Select icon"
          >
            <option value="book">📚</option>
            <option value="video">🎬</option>
            <option value="github">💻</option>
            <option value="code">⌨️</option>
            <option value="docs">📄</option>
            <option value="article">📰</option>
            <option value="external">🔗</option>
          </select>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          <InlineEditableText
            value={link.label}
            isEditable={true}
            onChange={handleLabelChange}
            placeholder="Link label..."
            className="font-semibold text-gray-900 dark:text-white"
          />
          <InlineEditableText
            value={link.url}
            isEditable={true}
            onChange={handleUrlChange}
            placeholder="https://..."
            className="text-sm text-gray-500 dark:text-gray-400 font-mono"
          />
          <InlineEditableText
            value={link.description || ''}
            isEditable={true}
            onChange={handleDescriptionChange}
            placeholder="Description (optional)..."
            className="text-sm text-gray-600 dark:text-gray-400"
          />
        </div>
      </div>
    );
  }

  // Subtle style - simple text link for expert review source links
  if (isSubtle) {
    return (
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
      >
        <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
        <span className="underline underline-offset-2 decoration-gray-300 dark:decoration-gray-600 group-hover:decoration-primary-400">
          {link.label}
        </span>
      </a>
    );
  }

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-4 p-4 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700/50 hover:border-primary-500/50 dark:hover:border-primary-500/50 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
    >
      {/* Icon */}
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 transition-colors">
        <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
            {link.label}
          </h4>
          <ArrowTopRightOnSquareIcon className="w-4 h-4 text-gray-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        {link.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
            {link.description}
          </p>
        )}
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">
          {getHostname(link.url)}
        </p>
      </div>
    </a>
  );
}

export function LinksSection({ content, isEditing, onUpdate }: LinksSectionProps) {
  const { links, title, style } = content;
  const isSubtle = style === 'subtle';

  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      if (onUpdate) {
        onUpdate({ ...content, title: newTitle });
      }
    },
    [content, onUpdate]
  );

  const handleLinkUpdate = useCallback(
    (index: number, updatedLink: ResourceLink) => {
      if (onUpdate) {
        const newLinks = [...(links || [])];
        newLinks[index] = updatedLink;
        onUpdate({ ...content, links: newLinks });
      }
    },
    [content, links, onUpdate]
  );

  const handleLinkDelete = useCallback(
    (index: number) => {
      if (onUpdate) {
        const newLinks = (links || []).filter((_, i) => i !== index);
        onUpdate({ ...content, links: newLinks });
      }
    },
    [content, links, onUpdate]
  );

  const handleAddLink = useCallback(() => {
    if (onUpdate) {
      const newLink: ResourceLink = {
        label: 'New Link',
        url: 'https://',
        description: '',
        icon: 'external',
      };
      onUpdate({ ...content, links: [...(links || []), newLink] });
    }
  }, [content, links, onUpdate]);

  // Allow empty in edit mode
  if ((!links || links.length === 0) && !isEditing) {
    return null;
  }

  // Subtle style for expert review source links - no header, simple inline links
  if (isSubtle && !isEditing) {
    return (
      <section className="project-section" data-section-type="links">
        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700/50">
          {links?.map((link, index) => (
            <ResourceLinkCard
              key={index}
              link={link}
              index={index}
              isSubtle={true}
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="project-section" data-section-type="links">
      {/* Section Header */}
      <div className="flex items-center gap-4 mb-8">
        {isEditing ? (
          <InlineEditableTitle
            value={title || 'Resources'}
            isEditable={true}
            onChange={handleTitleChange}
            placeholder="Section title..."
            className="text-2xl font-bold text-gray-900 dark:text-white"
            as="h2"
          />
        ) : (
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {title || 'Resources'}
          </h2>
        )}
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
      </div>

      {/* Links Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {links?.map((link, index) => (
          <ResourceLinkCard
            key={index}
            link={link}
            index={index}
            isEditing={isEditing}
            onUpdate={handleLinkUpdate}
            onDelete={handleLinkDelete}
          />
        ))}

        {/* Add Link button */}
        {isEditing && (
          <button
            onClick={handleAddLink}
            className="flex flex-col items-center justify-center min-h-[100px] rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-500 text-gray-400 hover:text-primary-500 transition-colors"
          >
            <PlusIcon className="w-8 h-8 mb-2" />
            <span className="text-sm font-medium">Add Link</span>
          </button>
        )}
      </div>
    </section>
  );
}
