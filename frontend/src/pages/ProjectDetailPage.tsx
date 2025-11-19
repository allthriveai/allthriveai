import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { getProjectBySlug } from '@/services/projects';
import type { Project } from '@/types/models';
import {
  ArrowLeftIcon,
  CodeBracketIcon,
  PhotoIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';

const typeIcons = {
  github_repo: CodeBracketIcon,
  image_collection: PhotoIcon,
  prompt: ChatBubbleLeftRightIcon,
  other: DocumentTextIcon,
};

const typeLabels = {
  github_repo: 'GitHub Repository',
  image_collection: 'Image Collection',
  prompt: 'Prompt',
  other: 'Project',
};

export default function ProjectDetailPage() {
  const { username, projectSlug } = useParams<{ username: string; projectSlug: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProject() {
      if (!username || !projectSlug) {
        setError('Invalid project URL');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await getProjectBySlug(username, projectSlug);
        setProject(data);
      } catch (err) {
        console.error('Failed to load project:', err);
        setError('Project not found');
      } finally {
        setIsLoading(false);
      }
    }

    loadProject();
  }, [username, projectSlug]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading project...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !project) {
    return (
      <DashboardLayout>
        <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900 p-8">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              {error || 'Project Not Found'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              The project you're looking for doesn't exist or you don't have permission to view it.
            </p>
            <button
              onClick={() => navigate(`/${username}`)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              Back to Profile
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const Icon = typeIcons[project.type];

  return (
    <DashboardLayout>
      <div className="flex-1 bg-white dark:bg-gray-900 overflow-y-auto">
        {/* Header with back button */}
        <div className="border-b border-gray-200 dark:border-gray-800 px-8 py-4">
          <Link
            to={`/${project.username}`}
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Back to {project.username}'s profile
          </Link>
        </div>

        {/* Cover Image */}
        {project.content?.coverImage?.url ? (
          <div className="w-full h-64 md:h-96 bg-gradient-to-br from-primary-500/20 to-secondary-500/20 overflow-hidden">
            <img
              src={project.content.coverImage.url}
              alt={project.content.coverImage.alt || project.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-full h-64 md:h-96 bg-gradient-to-br from-primary-500/20 to-secondary-500/20 flex items-center justify-center">
            <Icon className="w-24 h-24 text-slate-400 dark:text-slate-600" />
          </div>
        )}

        {/* Content */}
        <div className="max-w-4xl mx-auto px-8 py-12">
          {/* Title and Meta */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 text-sm font-medium rounded-full glass-strong border border-white/20 text-slate-700 dark:text-slate-300">
                {typeLabels[project.type]}
              </span>
              {project.isShowcase && (
                <span className="px-3 py-1 text-sm font-medium rounded-full bg-yellow-500/90 text-white">
                  ⭐ Showcase
                </span>
              )}
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              {project.title}
            </h1>

            {project.description && (
              <p className="text-xl text-gray-600 dark:text-gray-400">
                {project.description}
              </p>
            )}

            {/* Tags */}
            {project.content?.tags && project.content.tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {project.content.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 text-sm rounded-lg bg-white/50 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-white/20"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Metadata */}
            <div className="mt-6 flex items-center gap-6 text-sm text-gray-500 dark:text-gray-500">
              <span>Created {new Date(project.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</span>
              <span>•</span>
              <span>by <Link to={`/${project.username}`} className="text-primary-600 dark:text-primary-400 hover:underline">{project.username}</Link></span>
            </div>
          </div>

          {/* Content Blocks */}
          {project.content?.blocks && project.content.blocks.length > 0 ? (
            <div className="space-y-8">
              {project.content.blocks.map((block, index) => (
                <div key={index}>
                  {block.type === 'text' && (
                    <div className={`prose dark:prose-invert max-w-none ${
                      block.style === 'heading' ? 'text-2xl font-bold' :
                      block.style === 'quote' ? 'border-l-4 border-primary-500 pl-6 italic' :
                      ''
                    }`}>
                      {block.content}
                    </div>
                  )}

                  {block.type === 'image' && (
                    <figure>
                      <img
                        src={block.url}
                        alt={block.caption || ''}
                        className="w-full rounded-xl"
                      />
                      {block.caption && (
                        <figcaption className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
                          {block.caption}
                        </figcaption>
                      )}
                    </figure>
                  )}

                  {block.type === 'imageGrid' && (
                    <div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {block.images.map((img, imgIndex) => (
                          <figure key={imgIndex}>
                            <img
                              src={img.url}
                              alt={img.caption || ''}
                              className="w-full h-48 object-cover rounded-lg"
                            />
                            {img.caption && (
                              <figcaption className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                                {img.caption}
                              </figcaption>
                            )}
                          </figure>
                        ))}
                      </div>
                      {block.caption && (
                        <p className="mt-4 text-sm text-center text-gray-600 dark:text-gray-400">
                          {block.caption}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-12 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                No additional content for this project yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
