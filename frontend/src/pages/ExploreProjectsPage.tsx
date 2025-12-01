import { useState, useEffect } from 'react';
import { ExploreTemplate, FilterGroup } from '@/components/layouts/ExploreTemplate';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { PhotoIcon } from '@heroicons/react/24/outline';
import { exploreProjects } from '@/services/explore';
import type { Project } from '@/types/models';

export default function ExploreProjectsPage() {
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    applyFiltersAndSearch();
  }, [allProjects, searchQuery, activeFilters]);

  async function loadProjects() {
    try {
      setIsLoading(true);
      const response = await exploreProjects({ tab: 'all', page_size: 100 });
      setAllProjects(response.results || []);
    } catch (err: any) {
      console.error('Failed to load projects:', err);
      setError(err?.message || 'Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  }

  function applyFiltersAndSearch() {
    let filtered = [...allProjects];

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (project) =>
          project.title.toLowerCase().includes(query) ||
          project.description.toLowerCase().includes(query) ||
          project.content?.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply type filter
    if (activeFilters.type && activeFilters.type.length > 0) {
      filtered = filtered.filter((project) =>
        activeFilters.type.includes(project.type)
      );
    }

    // Apply showcase filter
    if (activeFilters.showcase && activeFilters.showcase.includes('true')) {
      filtered = filtered.filter((project) => project.isShowcase);
    }

    // Apply tags filter (example)
    if (activeFilters.tags && activeFilters.tags.length > 0) {
      filtered = filtered.filter((project) =>
        project.content?.tags?.some(tag =>
          activeFilters.tags.includes(tag)
        )
      );
    }

    setFilteredProjects(filtered);
  }

  // Define filter groups
  const filterGroups: FilterGroup[] = [
    {
      id: 'type',
      label: 'Project Type',
      multiSelect: true,
      options: [
        { id: 'type-github', label: 'GitHub Repo', value: 'github_repo', count: allProjects.filter(p => p.type === 'github_repo').length },
        { id: 'type-figma', label: 'Figma Design', value: 'figma_design', count: allProjects.filter(p => p.type === 'figma_design').length },
        { id: 'type-image', label: 'Image Collection', value: 'image_collection', count: allProjects.filter(p => p.type === 'image_collection').length },
        { id: 'type-prompt', label: 'Prompt', value: 'prompt', count: allProjects.filter(p => p.type === 'prompt').length },
        { id: 'type-reddit', label: 'Reddit Thread', value: 'reddit_thread', count: allProjects.filter(p => p.type === 'reddit_thread').length },
        { id: 'type-other', label: 'Other', value: 'other', count: allProjects.filter(p => p.type === 'other').length },
      ],
    },
    {
      id: 'showcase',
      label: 'Featured',
      multiSelect: false,
      options: [
        { id: 'showcase-true', label: '⭐ Showcase Only', value: 'true', count: allProjects.filter(p => p.isShowcase).length },
      ],
    },
    // Example: Dynamic tags filter (you'd build this from actual project tags)
    ...(getAllUniqueTags(allProjects).length > 0
      ? [{
          id: 'tags',
          label: 'Tags',
          multiSelect: true,
          options: getAllUniqueTags(allProjects).slice(0, 10).map(tag => ({
            id: `tag-${tag}`,
            label: tag,
            value: tag,
            count: allProjects.filter(p => p.content?.tags?.includes(tag)).length,
          })),
        }]
      : []
    ),
  ];

  return (
    <ExploreTemplate
      title="Explore Projects"
      subtitle={`Discover ${allProjects.length} amazing projects from our community`}
      icon={<PhotoIcon className="w-10 h-10" />}
      items={filteredProjects}
      isLoading={isLoading}
      error={error}
      searchPlaceholder="Search projects..."
      searchValue={searchQuery}
      onSearch={setSearchQuery}
      filterGroups={filterGroups}
      activeFilters={activeFilters}
      onFilterChange={(filterId, values) => {
        setActiveFilters(prev => ({
          ...prev,
          [filterId]: values,
        }));
      }}
      renderItem={(project) => (
        <ProjectCard project={project} variant="masonry" />
      )}
      getItemKey={(project) => project.id}
      emptyMessage="No projects available yet. Check back soon!"
      emptySearchMessage="No projects match your search and filters."
      columns={4}
    />
  );
}

// Helper function to extract unique tags
function getAllUniqueTags(projects: Project[]): string[] {
  const tagSet = new Set<string>();
  projects.forEach(project => {
    project.content?.tags?.forEach(tag => tagSet.add(tag));
  });
  return Array.from(tagSet).sort();
}
