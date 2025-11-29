import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Taxonomy } from '@/types/models';
import { api } from '@/services/api';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SearchBarWithFilters } from '@/components/explore/SearchBarWithFilters';
import { TabNavigation, type ExploreTab } from '@/components/explore/TabNavigation';
import { ProjectsGrid } from '@/components/explore/ProjectsGrid';
import { UserProfileCard } from '@/components/explore/UserProfileCard';
import { QuizPreviewCard } from '@/components/quiz/QuizPreviewCard';
import { QuizOverlay } from '@/components/quiz/QuizOverlay';
import { ProjectCard } from '@/components/projects/ProjectCard';
import {
  exploreProjects,
  semanticSearch,
  exploreProfiles,
  getFilterOptions,
  type ExploreParams,
} from '@/services/explore';
import { getQuizzes } from '@/services/quiz';

export function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // State from URL params
  const [activeTab, setActiveTab] = useState<ExploreTab>(
    (searchParams.get('tab') as ExploreTab) || 'for-you'
  );
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedCategorySlugs, setSelectedCategorySlugs] = useState<string[]>(
    searchParams.getAll('categories').filter(Boolean)
  );
  const [selectedToolSlugs, setSelectedToolSlugs] = useState<string[]>(
    searchParams.getAll('tools').filter(Boolean)
  );
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);

  // Quiz overlay state
  const [quizOverlayOpen, setQuizOverlayOpen] = useState(false);
  const [selectedQuizSlug, setSelectedQuizSlug] = useState<string>('');

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeTab !== 'for-you') params.set('tab', activeTab);
    if (searchQuery) params.set('q', searchQuery);
    selectedCategorySlugs.forEach(slug => params.append('categories', slug));
    selectedToolSlugs.forEach(slug => params.append('tools', slug));
    if (page > 1) params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [activeTab, searchQuery, selectedCategorySlugs, selectedToolSlugs, page, setSearchParams]);

  // Fetch filter options (tools)
  const { data: filterOptions } = useQuery({
    queryKey: ['filterOptions'],
    queryFn: getFilterOptions,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch taxonomy categories
  const { data: taxonomyCategories } = useQuery({
    queryKey: ['taxonomyCategories'],
    queryFn: async () => {
      const response = await api.get('/taxonomies/?taxonomy_type=category');
      return response.data.results as Taxonomy[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Convert category slugs to IDs for API
  const selectedCategoryIds = taxonomyCategories
    ?.filter(cat => selectedCategorySlugs.includes(cat.slug))
    .map(cat => cat.id) || [];

  // Convert tool slugs to IDs for API
  const selectedToolIds = filterOptions?.tools
    .filter(tool => selectedToolSlugs.includes(tool.slug))
    .map(tool => tool.id) || [];

  // Debug logging
  console.log('[ExplorePage] State:', {
    activeTab,
    selectedCategorySlugs,
    selectedCategoryIds,
    selectedToolSlugs,
    selectedToolIds,
    taxonomyCategories: taxonomyCategories?.map(c => ({ id: c.id, slug: c.slug, name: c.name })),
    filterOptions: filterOptions?.tools.map(t => ({ id: t.id, slug: t.slug, name: t.name })),
  });

  // Fetch projects (for most tabs)
  const exploreParams: ExploreParams = {
    tab: activeTab === 'for-you' ? 'for-you' : activeTab === 'trending' ? 'trending' : 'all',
    search: searchQuery || undefined,
    categories: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
    tools: selectedToolIds.length > 0 ? selectedToolIds : undefined,
    page,
    page_size: 30,
  };

  console.log('[ExplorePage] exploreParams:', exploreParams);

  const {
    data: projectsData,
    isLoading: isLoadingProjects,
    refetch: refetchProjects,
  } = useQuery({
    queryKey: ['exploreProjects', exploreParams],
    queryFn: () => exploreProjects(exploreParams),
    // Only run query if:
    // 1. Not on profiles tab
    // 2. If tools are selected, filterOptions must be loaded
    // 3. If categories are selected, taxonomyCategories must be loaded (IDs might be empty if no match, which is ok - we want to show 0 results)
    enabled:
      activeTab !== 'profiles' &&
      (selectedToolSlugs.length === 0 || !!filterOptions) &&
      (selectedCategorySlugs.length === 0 || !!taxonomyCategories),
  });

  // Fetch semantic search results
  const {
    data: semanticResults,
    isLoading: isLoadingSemanticSearch,
  } = useQuery({
    queryKey: ['semanticSearch', searchQuery],
    queryFn: () => semanticSearch(searchQuery),
    enabled: !!searchQuery && activeTab !== 'profiles',
  });

  // Fetch profiles
  const {
    data: profilesData,
    isLoading: isLoadingProfiles,
  } = useQuery({
    queryKey: ['exploreProfiles', page],
    queryFn: () => exploreProfiles(page, 30),
    enabled: activeTab === 'profiles',
  });

  // Fetch quizzes
  const {
    data: quizzesData,
    isLoading: isLoadingQuizzes,
  } = useQuery({
    queryKey: ['exploreQuizzes', searchQuery],
    queryFn: () => getQuizzes({ search: searchQuery || undefined }),
    enabled: activeTab !== 'profiles',
  });

  // Determine which data to display
  // IMPORTANT: If category or tool filters are selected but taxonomies/tools haven't loaded yet,
  // show loading state instead of showing unfiltered results
  const isWaitingForFilters =
    (selectedCategorySlugs.length > 0 && !taxonomyCategories) ||
    (selectedToolSlugs.length > 0 && !filterOptions);

  const displayProjects = searchQuery && semanticResults ? semanticResults : projectsData?.results || [];
  const displayQuizzes = quizzesData?.results || [];
  const isLoading = isLoadingProjects || isLoadingSemanticSearch || isLoadingProfiles || isLoadingQuizzes || isWaitingForFilters;

  // Handle tab change
  const handleTabChange = (tab: ExploreTab) => {
    setActiveTab(tab);
    setPage(1);
  };

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  // Handle filter changes
  const handleCategoriesChange = (categorySlugs: string[]) => {
    setSelectedCategorySlugs(categorySlugs);
    setPage(1);
  };

  const handleToolsChange = (slugs: string[]) => {
    setSelectedToolSlugs(slugs);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSelectedCategorySlugs([]);
    setSelectedToolSlugs([]);
    setPage(1);
  };

  const handleOpenQuiz = (quizSlug: string) => {
    setSelectedQuizSlug(quizSlug);
    setQuizOverlayOpen(true);
  };

  const handleCloseQuiz = () => {
    setQuizOverlayOpen(false);
    setSelectedQuizSlug('');
  };

  // Show filters only for certain tabs
  const showFilters = activeTab === 'categories' || activeTab === 'tools';

  return (
    <>
    <DashboardLayout>
      {() => (
        <div className="h-full overflow-y-auto">
          <div className="px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Explore
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Discover amazing projects and creators
              </p>
            </div>

            {/* Combined Glass Card with Tabs and Search */}
            <div className="glass-subtle rounded border border-gray-200 dark:border-gray-700 p-6 mb-6">
              {/* Tab Navigation */}
              <TabNavigation activeTab={activeTab} onChange={handleTabChange} />

              {/* Search Bar with Integrated Filters */}
              <div className="mt-4">
                <SearchBarWithFilters
                  onSearch={handleSearch}
                  placeholder="Search projects with AI..."
                  initialValue={searchQuery}
                  topics={activeTab === 'categories' ? (taxonomyCategories ?? []) : []}
                  tools={activeTab === 'tools' ? (filterOptions?.tools ?? []) : []}
                  selectedTopics={selectedCategorySlugs}
                  selectedToolSlugs={selectedToolSlugs}
                  onTopicsChange={handleCategoriesChange}
                  onToolsChange={handleToolsChange}
                  showFilters={showFilters}
                  openFiltersByDefault={activeTab === 'categories' || activeTab === 'tools'}
                />
              </div>
            </div>

            {/* Content */}
            {activeTab === 'profiles' ? (
              // Profiles Grid
              <div>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary-400"></div>
                      <p className="mt-4 text-gray-600 dark:text-gray-400">Loading profiles...</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {profilesData?.results.map((user) => (
                      <UserProfileCard key={user.id} user={user} />
                    ))}
                  </div>
                )}

                {/* Pagination for profiles */}
                {profilesData && profilesData.count > 30 && (
                  <div className="mt-8 flex items-center justify-center gap-4">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-gray-600 dark:text-gray-400">
                      Page {page} of {Math.ceil(profilesData.count / 30)}
                    </span>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={!profilesData.next}
                      className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // Mixed Projects and Quizzes Grid
              <>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary-400"></div>
                      <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
                    </div>
                  </div>
                ) : displayProjects.length === 0 && displayQuizzes.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center max-w-md mx-auto">
                      <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        {(() => {
                          if (searchQuery) {
                            return `No results found for "${searchQuery}"`;
                          }
                          if (selectedCategorySlugs.length > 0 || selectedToolSlugs.length > 0) {
                            const filterNames = [
                              ...selectedCategorySlugs.map(slug =>
                                taxonomyCategories?.find(c => c.slug === slug)?.name || slug
                              ),
                              ...selectedToolSlugs.map(slug =>
                                filterOptions?.tools.find(t => t.slug === slug)?.name || slug
                              )
                            ];
                            return `No projects found with ${filterNames.length === 1 ? 'this filter' : 'these filters'}`;
                          }
                          return 'No projects found';
                        })()}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {(() => {
                          if (selectedCategorySlugs.length > 0 || selectedToolSlugs.length > 0) {
                            return 'Try selecting different categories or tools to discover more projects';
                          }
                          if (searchQuery) {
                            return 'Try different keywords or clear your search to see all projects';
                          }
                          return 'Check back later for new content';
                        })()}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="columns-1 sm:columns-2 lg:columns-3 gap-2">
                    {/* Interleave quizzes and projects */}
                    {(() => {
                      const items: Array<{ type: 'quiz' | 'project'; data: any }> = [
                        ...displayQuizzes.map(quiz => ({ type: 'quiz' as const, data: quiz })),
                        ...displayProjects.map(project => ({ type: 'project' as const, data: project })),
                      ];

                      // Simple shuffle to mix quizzes and projects
                      const mixed = items.sort(() => Math.random() - 0.5);

                      return mixed.map((item, index) => (
                        <div key={`${item.type}-${item.data.id || item.data.slug}-${index}`} className="break-inside-avoid mb-2">
                          {item.type === 'quiz' ? (
                            <QuizPreviewCard
                              quiz={item.data}
                              variant="compact"
                              onOpen={() => handleOpenQuiz(item.data.slug)}
                            />
                          ) : (
                            <ProjectCard
                              project={item.data}
                              variant="masonry"
                              userAvatarUrl={item.data.userAvatarUrl}
                            />
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                )}

                {/* Pagination for projects */}
                {projectsData && projectsData.count > 30 && !searchQuery && (
                  <div className="mt-8 flex items-center justify-center gap-4">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-gray-600 dark:text-gray-400">
                      Page {page} of {Math.ceil(projectsData.count / 30)}
                    </span>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={!projectsData.next}
                      className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>

    {/* Quiz Overlay */}
    {quizOverlayOpen && selectedQuizSlug && (
      <QuizOverlay
        isOpen={quizOverlayOpen}
        onClose={handleCloseQuiz}
        quizSlug={selectedQuizSlug}
      />
    )}
    </>
  );
}
