/**
 * LinksSection - Resources and external links
 */

import {
  BookOpenIcon,
  VideoCameraIcon,
  LinkIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  NewspaperIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
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

function ResourceLinkCard({ link }: { link: ResourceLink }) {
  const Icon = getLinkIcon(link.icon);

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
          {new URL(link.url).hostname}
        </p>
      </div>
    </a>
  );
}

export function LinksSection({ content, isEditing, onUpdate }: LinksSectionProps) {
  const { links } = content;

  if (!links || links.length === 0) {
    return null;
  }

  return (
    <section className="project-section" data-section-type="links">
      {/* Section Header */}
      <div className="flex items-center gap-4 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Resources</h2>
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
      </div>

      {/* Links Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {links.map((link, index) => (
          <ResourceLinkCard key={index} link={link} />
        ))}
      </div>
    </section>
  );
}
