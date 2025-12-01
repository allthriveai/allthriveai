/**
 * HeroComponent - Project introduction with visual impact
 *
 * Supports inline editing when used within a ProjectProvider context.
 */

import { useCallback } from 'react';
import type { HeroComponent as HeroComponentType } from '@/types/components';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { useProjectContext } from '@/contexts/ProjectContext';
import { updateProject } from '@/services/projects';
import {
  InlineEditableTitle,
  InlineEditableText,
} from '@/components/projects/shared/InlineEditable';

interface HeroComponentProps {
  component: HeroComponentType;
}

export function HeroComponent({ component }: HeroComponentProps) {
  const { data } = component;
  const { title, subtitle, description, variant, badges, primaryCta, secondaryCta } = data;

  // Try to get project context for inline editing (optional)
  let isOwner = false;
  let project: any = null;
  let setProject: any = null;

  try {
    const context = useProjectContext();
    isOwner = context.isOwner;
    project = context.project;
    setProject = context.setProject;
  } catch {
    // Not within a ProjectProvider - render as read-only
  }

  // Handle title change
  const handleTitleChange = useCallback(async (newTitle: string) => {
    if (!project || !setProject) return;
    try {
      const updated = await updateProject(project.id, { title: newTitle });
      setProject(updated);
    } catch (error) {
      console.error('Failed to update title:', error);
    }
  }, [project, setProject]);

  // Handle description change (subtitle maps to project.description)
  const handleDescriptionChange = useCallback(async (newDescription: string) => {
    if (!project || !setProject) return;
    try {
      const updated = await updateProject(project.id, { description: newDescription });
      setProject(updated);
    } catch (error) {
      console.error('Failed to update description:', error);
    }
  }, [project, setProject]);

  // Render title - editable or static
  const renderTitle = (className: string) => {
    if (isOwner && project) {
      return (
        <InlineEditableTitle
          value={project.title || title}
          isEditable={isOwner}
          onChange={handleTitleChange}
          placeholder="Enter project title..."
          className={className}
          as="h1"
        />
      );
    }
    return <h1 className={className}>{title}</h1>;
  };

  // Render subtitle/description - editable or static
  const renderSubtitle = (className: string) => {
    const displayValue = project?.description || subtitle || '';
    if (isOwner && project) {
      return (
        <InlineEditableText
          value={displayValue}
          isEditable={isOwner}
          onChange={handleDescriptionChange}
          placeholder="Add a description for your project..."
          className={className}
          multiline
          rows={3}
        />
      );
    }
    if (!displayValue) return null;
    return <p className={className}>{displayValue}</p>;
  };

  // Gradient variant
  if (variant === 'gradient') {
    const gradientFrom = data.gradientFrom || 'violet-600';
    const gradientTo = data.gradientTo || 'indigo-600';

    return (
      <section className="relative overflow-hidden rounded-2xl">
        <div
          className={`bg-gradient-to-br from-${gradientFrom} to-${gradientTo} px-8 py-16 md:px-16 md:py-24`}
        >
          <div className="relative z-10 max-w-4xl">
            {badges && badges.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {badges.map((badge, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-white/20 text-white backdrop-blur-sm"
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
            )}

            {renderTitle('text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4')}
            {renderSubtitle('text-xl md:text-2xl text-white/90 mb-4')}

            {description && (
              <p className="text-lg text-white/80 mb-8 max-w-2xl">{description}</p>
            )}

            {(primaryCta || secondaryCta) && (
              <div className="flex flex-wrap gap-4">
                {primaryCta && (
                  <a
                    href={primaryCta.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-colors"
                  >
                    {primaryCta.label}
                    <ArrowRightIcon className="w-4 h-4" />
                  </a>
                )}
                {secondaryCta && (
                  <a
                    href={secondaryCta.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border-2 border-white/30 text-white font-semibold hover:bg-white/10 transition-colors"
                  >
                    {secondaryCta.label}
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-1/2 h-full opacity-20">
            <div className="absolute top-10 right-10 w-64 h-64 rounded-full bg-white/30 blur-3xl" />
            <div className="absolute bottom-10 right-32 w-48 h-48 rounded-full bg-white/20 blur-2xl" />
          </div>
        </div>
      </section>
    );
  }

  // Image variant
  if (variant === 'image' && data.backgroundImage) {
    return (
      <section className="relative overflow-hidden rounded-2xl">
        <div className="absolute inset-0">
          <img
            src={data.backgroundImage}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
        </div>

        <div className="relative z-10 px-8 py-24 md:px-16 md:py-32">
          <div className="max-w-4xl">
            {badges && badges.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {badges.map((badge, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-white/20 text-white backdrop-blur-sm"
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
            )}

            {renderTitle('text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4')}
            {renderSubtitle('text-xl md:text-2xl text-white/90 mb-4')}

            {description && (
              <p className="text-lg text-white/80 mb-8 max-w-2xl">{description}</p>
            )}

            {(primaryCta || secondaryCta) && (
              <div className="flex flex-wrap gap-4">
                {primaryCta && (
                  <a
                    href={primaryCta.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-colors"
                  >
                    {primaryCta.label}
                    <ArrowRightIcon className="w-4 h-4" />
                  </a>
                )}
                {secondaryCta && (
                  <a
                    href={secondaryCta.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border-2 border-white/30 text-white font-semibold hover:bg-white/10 transition-colors"
                  >
                    {secondaryCta.label}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  // Video variant
  if (variant === 'video' && data.backgroundVideo) {
    return (
      <section className="relative overflow-hidden rounded-2xl">
        <div className="absolute inset-0">
          <video
            src={data.backgroundVideo}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
        </div>

        <div className="relative z-10 px-8 py-24 md:px-16 md:py-32">
          <div className="max-w-4xl">
            {renderTitle('text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4')}
            {renderSubtitle('text-xl md:text-2xl text-white/90 mb-4')}

            {description && (
              <p className="text-lg text-white/80 mb-8 max-w-2xl">{description}</p>
            )}

            {(primaryCta || secondaryCta) && (
              <div className="flex flex-wrap gap-4">
                {primaryCta && (
                  <a
                    href={primaryCta.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-colors"
                  >
                    {primaryCta.label}
                    <ArrowRightIcon className="w-4 h-4" />
                  </a>
                )}
                {secondaryCta && (
                  <a
                    href={secondaryCta.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border-2 border-white/30 text-white font-semibold hover:bg-white/10 transition-colors"
                  >
                    {secondaryCta.label}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  // Minimal variant (default fallback)
  return (
    <section className="py-12 md:py-16">
      <div className="max-w-4xl">
        {badges && badges.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {badges.map((badge, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
              >
                {badge.label}
              </span>
            ))}
          </div>
        )}

        {renderTitle('text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4')}
        {renderSubtitle('text-xl md:text-2xl text-gray-600 dark:text-gray-400 mb-4')}

        {description && (
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            {description}
          </p>
        )}

        {(primaryCta || secondaryCta) && (
          <div className="flex flex-wrap gap-4">
            {primaryCta && (
              <a
                href={primaryCta.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors"
              >
                {primaryCta.label}
                <ArrowRightIcon className="w-4 h-4" />
              </a>
            )}
            {secondaryCta && (
              <a
                href={secondaryCta.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {secondaryCta.label}
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
