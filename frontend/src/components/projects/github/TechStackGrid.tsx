

interface TechStackGridProps {
  technologies: Record<string, string[]>;
}

const categoryIcons: Record<string, string> = {
  frontend: '🎨',
  backend: '⚙️',
  databases: '💾',
  infrastructure: '🏗️',
  testing: '🧪',
};

const categoryLabels: Record<string, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  databases: 'Databases',
  infrastructure: 'Infrastructure',
  testing: 'Testing',
};

export function TechStackGrid({ technologies }: TechStackGridProps) {
  const categories = Object.entries(technologies).filter(([, techs]) => techs.length > 0);

  if (categories.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {categories.map(([category, techs]) => (
        <div
          key={category}
          className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl" role="img" aria-label={category}>
              {categoryIcons[category] || '📦'}
            </span>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {categoryLabels[category] || category.charAt(0).toUpperCase() + category.slice(1)}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {techs.map((tech) => (
              <span
                key={tech}
                className="px-3 py-1 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 rounded-full text-sm font-medium"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
