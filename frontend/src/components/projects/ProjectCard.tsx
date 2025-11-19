import { Link } from 'react-router-dom';
import type { Project } from '@/types/models';
import { 
  CodeBracketIcon, 
  PhotoIcon, 
  ChatBubbleLeftRightIcon,
  DocumentTextIcon 
} from '@heroicons/react/24/outline';

interface ProjectCardProps {
  project: Project;
}

const typeIcons = {
  github_repo: CodeBracketIcon,
  image_collection: PhotoIcon,
  prompt: ChatBubbleLeftRightIcon,
  other: DocumentTextIcon,
};

const typeLabels = {
  github_repo: 'GitHub Repo',
  image_collection: 'Image Collection',
  prompt: 'Prompt',
  other: 'Project',
};

export function ProjectCard({ project }: ProjectCardProps) {
  const Icon = typeIcons[project.type];
  const projectUrl = `/${project.username}/${project.slug}`;

  return (
    <Link
      to={projectUrl}
      className="block glass-subtle hover:glass-strong transition-all duration-300 rounded-xl overflow-hidden group"
    >
      {/* Thumbnail or placeholder */}
      <div className="relative aspect-video bg-gradient-to-br from-primary-500/20 to-secondary-500/20 overflow-hidden">
        {project.thumbnailUrl ? (
          <img
            src={project.thumbnailUrl}
            alt={project.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon className="w-16 h-16 text-slate-400 dark:text-slate-600" />
          </div>
        )}
        
        {/* Type badge */}
        <div className="absolute top-3 right-3">
          <span className="px-2 py-1 text-xs font-medium rounded-full glass-strong border border-white/20 text-slate-700 dark:text-slate-300">
            {typeLabels[project.type]}
          </span>
        </div>

        {/* Showcase badge */}
        {project.isShowcase && (
          <div className="absolute top-3 left-3">
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-500/90 text-white">
              ⭐ Showcase
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1">
          {project.title}
        </h3>
        
        {project.description && (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
            {project.description}
          </p>
        )}

        {/* Tags */}
        {project.content?.tags && project.content.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {project.content.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 text-xs rounded-md bg-white/50 dark:bg-white/5 text-slate-600 dark:text-slate-400"
              >
                {tag}
              </span>
            ))}
            {project.content.tags.length > 3 && (
              <span className="px-2 py-1 text-xs text-slate-500 dark:text-slate-500">
                +{project.content.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-500 dark:text-slate-500">
          <div className="flex items-center gap-1">
            <Icon className="w-4 h-4" />
            <span>/{project.slug}</span>
          </div>
          <span>{new Date(project.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </Link>
  );
}
