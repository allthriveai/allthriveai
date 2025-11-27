import React from 'react';
import type { Project } from '@/types/models';
import {
  SwatchIcon,
  CubeIcon,
  DocumentTextIcon,
  LinkIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

interface FigmaProjectLayoutProps {
  project: Project;
}

export function FigmaProjectLayout({ project }: FigmaProjectLayoutProps) {
  const analysis = project.content?.figma?.analysis;
  const figmaData = project.content?.figma;

  if (!analysis) {
    return null;
  }

  const file = analysis.file || {};
  const designSystem = analysis.design_system || { colors: [], text_styles: [], effects: [] };
  const components = analysis.components || [];
  const pages = analysis.pages || [];
  const stats = analysis.stats || { page_count: 0, component_count: 0 };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <div className="mb-12">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">{project.title}</h1>
          {stats.component_count > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <CubeIcon className="w-5 h-5 text-primary-500" />
              <span className="font-semibold text-gray-900 dark:text-white">{stats.component_count} components</span>
            </div>
          )}
        </div>

        {project.description && (
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-6">{project.description}</p>
        )}

        {/* File Info Badge */}
        {file.name && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 rounded-lg mb-4">
            <DocumentTextIcon className="w-5 h-5" />
            <span className="font-semibold">Figma Design File: {file.name}</span>
          </div>
        )}

        {/* Figma Link */}
        {project.externalUrl && (
          <div className="mt-4">
            <a
              href={project.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
            >
              <LinkIcon className="w-5 h-5" />
              Open in Figma
            </a>
          </div>
        )}
      </div>

      {/* Thumbnail */}
      {file.thumbnail_url && (
        <div className="mb-12">
          <img
            src={file.thumbnail_url}
            alt={`${file.name} thumbnail`}
            className="w-full rounded-lg shadow-lg"
          />
        </div>
      )}

      {/* Main Content */}
      <div className="space-y-16">
        {/* Stats Overview */}
        {(stats.page_count > 0 || stats.component_count > 0) && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <ChartBarIcon className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Overview</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
                <div className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-2">
                  {stats.page_count}
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  {stats.page_count === 1 ? 'Page' : 'Pages'}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
                <div className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-2">
                  {stats.component_count}
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  {stats.component_count === 1 ? 'Component' : 'Components'}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Design System Section */}
        {(designSystem.colors.length > 0 || designSystem.text_styles.length > 0 || designSystem.effects.length > 0) && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <SwatchIcon className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Design System</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Colors */}
              {designSystem.colors.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Colors</h3>
                  <div className="space-y-2">
                    {designSystem.colors.slice(0, 10).map((color, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{color.name}</p>
                          {color.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{color.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {designSystem.colors.length > 10 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      +{designSystem.colors.length - 10} more
                    </p>
                  )}
                </div>
              )}

              {/* Text Styles */}
              {designSystem.text_styles.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Text Styles</h3>
                  <div className="space-y-2">
                    {designSystem.text_styles.slice(0, 10).map((style, index) => (
                      <div key={index}>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{style.name}</p>
                        {style.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{style.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  {designSystem.text_styles.length > 10 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      +{designSystem.text_styles.length - 10} more
                    </p>
                  )}
                </div>
              )}

              {/* Effects */}
              {designSystem.effects.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Effects</h3>
                  <div className="space-y-2">
                    {designSystem.effects.slice(0, 10).map((effect, index) => (
                      <div key={index}>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{effect.name}</p>
                        {effect.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{effect.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  {designSystem.effects.length > 10 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      +{designSystem.effects.length - 10} more
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Components Section */}
        {components.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <CubeIcon className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Components</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {components.map((component, index) => (
                <div
                  key={component.id || index}
                  className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{component.name}</p>
                  {component.type && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{component.type}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Pages Section */}
        {pages.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <DocumentTextIcon className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Pages</h2>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md divide-y divide-gray-200 dark:divide-gray-700">
              {pages.map((page, index) => (
                <div key={page.id || index} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{page.name}</p>
                      {page.type && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{page.type}</p>
                      )}
                    </div>
                    {page.children_count !== undefined && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {page.children_count} {page.children_count === 1 ? 'frame' : 'frames'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Analysis Footer */}
      {figmaData?.analyzed_at && (
        <div className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            Design file analyzed {new Date(figmaData.analyzed_at).toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  );
}
