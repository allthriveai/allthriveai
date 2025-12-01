/**
 * TechStackSection - Technologies used, grouped by category with icons
 *
 * Supports inline editing when isEditing=true for owners.
 */

import { useCallback } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { InlineEditableTitle, InlineEditableText } from '../shared/InlineEditable';
import type { TechStackSectionContent, Technology, TechCategory } from '@/types/sections';

interface TechStackSectionProps {
  content: TechStackSectionContent;
  isEditing?: boolean;
  onUpdate?: (content: TechStackSectionContent) => void;
}

// Common tech icons from SimpleIcons (using Devicon CDN)
const TECH_ICONS: Record<string, string> = {
  // Languages
  python: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg',
  javascript: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg',
  typescript: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg',
  go: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/go/go-original.svg',
  rust: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rust/rust-plain.svg',
  java: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/java/java-original.svg',
  ruby: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/ruby/ruby-original.svg',
  php: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/php/php-original.svg',
  swift: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/swift/swift-original.svg',
  kotlin: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/kotlin/kotlin-original.svg',
  c: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/c/c-original.svg',
  'c++': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/cplusplus/cplusplus-original.svg',
  'c#': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/csharp/csharp-original.svg',

  // Frontend
  react: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg',
  vue: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vuejs/vuejs-original.svg',
  angular: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/angularjs/angularjs-original.svg',
  svelte: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/svelte/svelte-original.svg',
  nextjs: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-original.svg',
  'next.js': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-original.svg',
  nuxt: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nuxtjs/nuxtjs-original.svg',
  gatsby: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/gatsby/gatsby-original.svg',
  tailwind: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tailwindcss/tailwindcss-plain.svg',
  tailwindcss: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tailwindcss/tailwindcss-plain.svg',

  // Backend
  nodejs: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg',
  'node.js': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg',
  express: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/express/express-original.svg',
  fastapi: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/fastapi/fastapi-original.svg',
  django: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/django/django-plain.svg',
  flask: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/flask/flask-original.svg',
  rails: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rails/rails-plain.svg',
  spring: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/spring/spring-original.svg',
  laravel: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/laravel/laravel-plain.svg',

  // Databases
  postgresql: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg',
  postgres: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg',
  mysql: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mysql/mysql-original.svg',
  mongodb: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg',
  redis: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/redis/redis-original.svg',
  sqlite: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/sqlite/sqlite-original.svg',

  // DevOps & Infrastructure
  docker: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg',
  kubernetes: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/kubernetes/kubernetes-plain.svg',
  aws: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/amazonwebservices/amazonwebservices-original.svg',
  gcp: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/googlecloud/googlecloud-original.svg',
  azure: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/azure/azure-original.svg',
  nginx: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nginx/nginx-original.svg',
  github: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg',
  gitlab: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/gitlab/gitlab-original.svg',
  terraform: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/terraform/terraform-original.svg',

  // AI/ML
  pytorch: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/pytorch/pytorch-original.svg',
  tensorflow: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tensorflow/tensorflow-original.svg',
  pandas: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/pandas/pandas-original.svg',
  numpy: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/numpy/numpy-original.svg',

  // Tools
  git: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg',
  vscode: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vscode/vscode-original.svg',
  figma: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/figma/figma-original.svg',
  graphql: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/graphql/graphql-plain.svg',
  jest: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/jest/jest-plain.svg',
  webpack: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/webpack/webpack-original.svg',
};

function getTechIcon(tech: Technology): string | null {
  // If icon is provided and looks like a URL, use it directly
  if (tech.icon && (tech.icon.startsWith('http') || tech.icon.startsWith('/'))) {
    return tech.icon;
  }

  // Try to match from our icon library
  const normalizedName = tech.name.toLowerCase().replace(/\s+/g, '');
  return TECH_ICONS[normalizedName] || TECH_ICONS[tech.icon?.toLowerCase() || ''] || null;
}

interface TechBadgeProps {
  tech: Technology;
  isEditing?: boolean;
  onUpdate?: (tech: Technology) => void;
  onDelete?: () => void;
}

function TechBadge({ tech, isEditing, onUpdate, onDelete }: TechBadgeProps) {
  const iconUrl = getTechIcon(tech);

  const handleNameChange = useCallback(
    async (newName: string) => {
      if (onUpdate) {
        onUpdate({ ...tech, name: newName });
      }
    },
    [tech, onUpdate]
  );

  if (isEditing) {
    return (
      <div className="group relative flex items-center gap-2.5 px-4 py-2.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        {/* Delete button */}
        {onDelete && (
          <button
            onClick={onDelete}
            className="absolute -top-2 -right-2 z-10 p-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove technology"
          >
            <TrashIcon className="w-3 h-3" />
          </button>
        )}
        {iconUrl ? (
          <img src={iconUrl} alt={tech.name} className="w-5 h-5 object-contain" />
        ) : (
          <div className="w-5 h-5 rounded bg-gradient-to-br from-primary-500/20 to-secondary-500/20 flex items-center justify-center">
            <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
              {tech.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <InlineEditableText
          value={tech.name}
          isEditable={true}
          onChange={handleNameChange}
          placeholder="Tech name..."
          className="font-medium text-gray-900 dark:text-white"
          showEditIcon={false}
        />
      </div>
    );
  }

  return (
    <a
      href={tech.url || `https://www.google.com/search?q=${encodeURIComponent(tech.name)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-2.5 px-4 py-2.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-500/50 dark:hover:border-primary-500/50 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
    >
      {iconUrl ? (
        <img
          src={iconUrl}
          alt={tech.name}
          className="w-5 h-5 object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div className="w-5 h-5 rounded bg-gradient-to-br from-primary-500/20 to-secondary-500/20 flex items-center justify-center">
          <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
            {tech.name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <span className="font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
        {tech.name}
      </span>
      {tech.version && (
        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
          {tech.version}
        </span>
      )}
    </a>
  );
}

interface TechCategoryGroupProps {
  category: TechCategory;
  categoryIndex: number;
  isEditing?: boolean;
  onUpdateCategory?: (index: number, category: TechCategory) => void;
  onDeleteCategory?: (index: number) => void;
}

function TechCategoryGroup({
  category,
  categoryIndex,
  isEditing,
  onUpdateCategory,
  onDeleteCategory
}: TechCategoryGroupProps) {
  const handleCategoryNameChange = useCallback(
    async (newName: string) => {
      if (onUpdateCategory) {
        onUpdateCategory(categoryIndex, { ...category, name: newName });
      }
    },
    [category, categoryIndex, onUpdateCategory]
  );

  const handleTechUpdate = useCallback(
    (techIndex: number, updatedTech: Technology) => {
      if (onUpdateCategory) {
        const newTechnologies = [...category.technologies];
        newTechnologies[techIndex] = updatedTech;
        onUpdateCategory(categoryIndex, { ...category, technologies: newTechnologies });
      }
    },
    [category, categoryIndex, onUpdateCategory]
  );

  const handleTechDelete = useCallback(
    (techIndex: number) => {
      if (onUpdateCategory) {
        const newTechnologies = category.technologies.filter((_, i) => i !== techIndex);
        onUpdateCategory(categoryIndex, { ...category, technologies: newTechnologies });
      }
    },
    [category, categoryIndex, onUpdateCategory]
  );

  const handleAddTech = useCallback(() => {
    if (onUpdateCategory) {
      const newTech: Technology = { name: 'New Tech' };
      onUpdateCategory(categoryIndex, {
        ...category,
        technologies: [...category.technologies, newTech],
      });
    }
  }, [category, categoryIndex, onUpdateCategory]);

  if (!category.technologies || category.technologies.length === 0) {
    if (!isEditing) return null;
  }

  return (
    <div className="group/category relative space-y-3">
      {/* Delete category button */}
      {isEditing && onDeleteCategory && (
        <button
          onClick={() => onDeleteCategory(categoryIndex)}
          className="absolute -top-2 -right-2 z-10 p-1.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 opacity-0 group-hover/category:opacity-100 transition-opacity"
          title="Delete category"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      )}

      {isEditing ? (
        <InlineEditableTitle
          value={category.name}
          isEditable={true}
          onChange={handleCategoryNameChange}
          placeholder="Category name..."
          className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
          as="h4"
        />
      ) : (
        <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {category.name}
        </h4>
      )}
      <div className="flex flex-wrap gap-3">
        {category.technologies.map((tech, index) => (
          <TechBadge
            key={index}
            tech={typeof tech === 'string' ? { name: tech } : tech}
            isEditing={isEditing}
            onUpdate={(updatedTech) => handleTechUpdate(index, updatedTech)}
            onDelete={() => handleTechDelete(index)}
          />
        ))}
        {isEditing && (
          <button
            onClick={handleAddTech}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-primary-500 border border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-500 rounded-xl transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Add Tech
          </button>
        )}
      </div>
    </div>
  );
}

export function TechStackSection({ content, isEditing, onUpdate }: TechStackSectionProps) {
  const { categories } = content;

  const handleCategoryUpdate = useCallback(
    (index: number, updatedCategory: TechCategory) => {
      if (onUpdate) {
        const newCategories = [...categories];
        newCategories[index] = updatedCategory;
        onUpdate({ categories: newCategories });
      }
    },
    [categories, onUpdate]
  );

  const handleCategoryDelete = useCallback(
    (index: number) => {
      if (onUpdate) {
        const newCategories = categories.filter((_, i) => i !== index);
        onUpdate({ categories: newCategories });
      }
    },
    [categories, onUpdate]
  );

  const handleAddCategory = useCallback(() => {
    if (onUpdate) {
      const newCategory: TechCategory = {
        name: 'New Category',
        technologies: [],
      };
      onUpdate({ categories: [...(categories || []), newCategory] });
    }
  }, [categories, onUpdate]);

  // Allow empty categories in edit mode
  if ((!categories || categories.length === 0) && !isEditing) {
    return null;
  }

  // Filter out empty categories for display (but show all in edit mode)
  const displayCategories = isEditing
    ? categories || []
    : (categories || []).filter(cat => cat.technologies && cat.technologies.length > 0);

  if (displayCategories.length === 0 && !isEditing) {
    return null;
  }

  return (
    <section className="project-section" data-section-type="tech_stack">
      {/* Section Header */}
      <div className="flex items-center gap-4 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Tech Stack</h2>
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
      </div>

      {/* Categories */}
      <div className="space-y-8">
        {displayCategories.map((category, index) => (
          <TechCategoryGroup
            key={index}
            category={category}
            categoryIndex={index}
            isEditing={isEditing}
            onUpdateCategory={handleCategoryUpdate}
            onDeleteCategory={handleCategoryDelete}
          />
        ))}

        {/* Add Category button */}
        {isEditing && (
          <button
            onClick={handleAddCategory}
            className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-400 hover:text-primary-500 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-500 rounded-xl transition-colors w-full justify-center"
          >
            <PlusIcon className="w-5 h-5" />
            Add Category
          </button>
        )}
      </div>
    </section>
  );
}
