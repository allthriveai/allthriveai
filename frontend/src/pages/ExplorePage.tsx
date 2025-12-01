import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
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
import { LoadingSkeleton } from '@/components/explore/LoadingSkeleton';
import {
  exploreProjects,
  semanticSearch,
  exploreProfiles,
  getFilterOptions,
  type ExploreParams,
} from '@/services/explore';
import { getQuizzes } from '@/services/quiz';
import { useAuth } from '@/hooks/useAuth';

export function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

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

  // Quiz overlay state
  const [quizOverlayOpen, setQuizOverlayOpen] = useState(false);
  const [selectedQuizSlug, setSelectedQuizSlug] = useState<string>('');

  // Intersection observer ref for infinite scroll
  const observerTarget = useRef<HTMLDivElement>(null);

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeTab !== 'for-you') params.set('tab', activeTab);
    if (searchQuery) params.set('q', searchQuery);
    selectedCategorySlugs.forEach(slug => params.append('categories', slug));
    selectedToolSlugs.forEach(slug => params.append('tools', slug));
    setSearchParams(params, { replace: true });
  }, [activeTab, searchQuery, selectedCategorySlugs, selectedToolSlugs, setSearchParams]);

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

  // Fetch projects with infinite scroll (for most tabs)
  const exploreParamsBase = {
    tab: activeTab === 'for-you' ? 'for-you' : activeTab === 'trending' ? 'trending' : 'all',
    search: searchQuery || undefined,
    categories: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
    tools: selectedToolIds.length > 0 ? selectedToolIds : undefined,
    page_size: 30,
  } as const;

  console.log('[ExplorePage] exploreParamsBase:', exploreParamsBase);

  const {
    data: projectsData,
    isLoading: isLoadingProjects,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['exploreProjects', exploreParamsBase],
    queryFn: ({ pageParam = 1 }) => exploreProjects({ ...exploreParamsBase, page: pageParam }),
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.next ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
    // Only run query if:
    // 1. Not on profiles tab
    // 2. If tools are selected, filterOptions must be loaded
    // 3. If categories are selected, taxonomyCategories must be loaded
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

  // Fetch profiles with infinite scroll
  const {
    data: profilesData,
    isLoading: isLoadingProfiles,
    isFetchingNextPage: isFetchingNextProfiles,
    hasNextPage: hasNextProfiles,
    fetchNextPage: fetchNextProfiles,
  } = useInfiniteQuery({
    queryKey: ['exploreProfiles'],
    queryFn: ({ pageParam = 1 }) => exploreProfiles(pageParam, 30),
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.next ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
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

  // Flatten paginated results for infinite scroll
  const allProjects = projectsData?.pages.flatMap(page => page.results) || [];
  const allProfiles = profilesData?.pages.flatMap(page => page.results) || [];

  const displayProjects = searchQuery && semanticResults ? semanticResults : allProjects;
  const displayQuizzes = quizzesData?.results || [];
  const isLoading = isLoadingProjects || isLoadingSemanticSearch || isLoadingProfiles || isLoadingQuizzes || isWaitingForFilters;

  // Handle tab change
  const handleTabChange = (tab: ExploreTab) => {
    setActiveTab(tab);
  };

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Handle filter changes
  const handleCategoriesChange = (categorySlugs: string[]) => {
    setSelectedCategorySlugs(categorySlugs);
  };

  const handleToolsChange = (slugs: string[]) => {
    setSelectedToolSlugs(slugs);
  };

  const handleClearFilters = () => {
    setSelectedCategorySlugs([]);
    setSelectedToolSlugs([]);
  };

  const handleOpenQuiz = (quizSlug: string) => {
    setSelectedQuizSlug(quizSlug);
    setQuizOverlayOpen(true);
  };

  const handleCloseQuiz = () => {
    setQuizOverlayOpen(false);
    setSelectedQuizSlug('');
  };

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          if (activeTab === 'profiles' && hasNextProfiles && !isFetchingNextProfiles) {
            fetchNextProfiles();
          } else if (activeTab !== 'profiles' && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }
      },
      {
        threshold: 0.1,
        rootMargin: '400px' // Start loading before user reaches the bottom
      }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [activeTab, hasNextPage, hasNextProfiles, isFetchingNextPage, isFetchingNextProfiles, fetchNextPage, fetchNextProfiles]);

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
                  <LoadingSkeleton type="profile" count={9} />
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {allProfiles.map((user) => (
                        <UserProfileCard key={user.id} user={user} />
                      ))}
                    </div>

                    {/* Loading skeletons for next page */}
                    {isFetchingNextProfiles && (
                      <div className="mt-6">
                        <LoadingSkeleton type="profile" count={3} />
                      </div>
                    )}

                    {/* Infinite scroll trigger */}
                    {hasNextProfiles && <div ref={observerTarget} className="h-4 mt-8" />}
                  </>
                )}
              </div>
            ) : (
              // Mixed Projects and Quizzes Grid
              <>
                {isLoading ? (
                  <LoadingSkeleton type="project" count={9} />
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
                              isOwner={user?.username === item.data.username}
                            />
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                )}

                {/* Loading skeletons for next page */}
                {isFetchingNextPage && (
                  <div className="mt-6">
                    <LoadingSkeleton type="project" count={6} />
                  </div>
                )}

                {/* Infinite scroll trigger */}
                {hasNextPage && <div ref={observerTarget} className="h-4 mt-8" />}
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
