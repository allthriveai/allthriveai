import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

  // Ref to store openAddProject function from DashboardLayout
  const openAddProjectRef = useRef<((welcomeMode?: boolean) => void) | null>(null);

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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previousScrollHeight = useRef<number>(0);

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
    error: projectsError,
    refetch: refetchProjects,
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
    error: profilesError,
    refetch: refetchProfiles,
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

  // Determine if there's an error to display
  const hasError = activeTab === 'profiles' ? !!profilesError : !!projectsError;
  const errorMessage = activeTab === 'profiles'
    ? (profilesError as any)?.error || 'Failed to load profiles'
    : (projectsError as any)?.error || 'Failed to load projects';
  const handleRetry = activeTab === 'profiles' ? refetchProfiles : refetchProjects;

  // Stably mix quizzes and projects using memoization to prevent re-shuffling
  const mixedItems = useMemo(() => {
    const items: Array<{ type: 'quiz' | 'project'; data: any; stableKey: string }> = [
      ...displayQuizzes.map(quiz => ({
        type: 'quiz' as const,
        data: quiz,
        stableKey: `quiz-${quiz.slug || quiz.id}`
      })),
      ...displayProjects.map(project => ({
        type: 'project' as const,
        data: project,
        stableKey: `project-${project.slug || project.id}`
      })),
    ];

    // Use a stable hash-based shuffle instead of random
    // This ensures the same items always appear in the same order
    const hashString = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return hash;
    };

    return items.sort((a, b) => {
      const hashA = hashString(a.stableKey);
      const hashB = hashString(b.stableKey);
      return hashA - hashB;
    });
  }, [displayQuizzes, displayProjects]);

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

  // Preserve scroll position when new content loads
  useEffect(() => {
    if (isFetchingNextPage || isFetchingNextProfiles) {
      const container = scrollContainerRef.current;
      if (container) {
        previousScrollHeight.current = container.scrollHeight;
      }
    }
  }, [isFetchingNextPage, isFetchingNextProfiles]);

  useEffect(() => {
    if (!isFetchingNextPage && !isFetchingNextProfiles && previousScrollHeight.current > 0) {
      const container = scrollContainerRef.current;
      if (container) {
        const newScrollHeight = container.scrollHeight;
        const heightDiff = newScrollHeight - previousScrollHeight.current;

        // Only adjust if content was added (height increased)
        if (heightDiff > 0) {
          // Maintain scroll position by adjusting for new content height
          const currentScrollTop = container.scrollTop;
          // This prevents the jump by keeping the user at the same visual position
          requestAnimationFrame(() => {
            // No adjustment needed since content loads at bottom
          });
        }

        previousScrollHeight.current = 0;
      }
    }
  }, [isFetchingNextPage, isFetchingNextProfiles, allProjects.length, allProfiles.length]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    // Find the scrolling container (main element from DashboardLayout)
    const scrollContainer = scrollContainerRef.current?.closest('main');

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
        root: scrollContainer, // Use the actual scrolling container
        threshold: 0.1,
        rootMargin: '400px' // Load earlier to prevent visible loading states
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

  // Handle welcome redirect from auth - open chat in welcome mode
  // Uses useEffect to avoid race conditions from calling during render
  useEffect(() => {
    const isWelcome = searchParams.get('welcome') === 'true';
    if (isWelcome && openAddProjectRef.current) {
      // Remove the welcome param from URL first
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('welcome');
      setSearchParams(newParams, { replace: true });
      // Open the chat in welcome mode after a brief delay for UI to settle
      setTimeout(() => openAddProjectRef.current?.(true), 100);
    }
  }, [searchParams, setSearchParams]);

  return (
    <>
    <DashboardLayout>
      {({ openAddProject }) => {
        // Store the function in ref for useEffect to access
        openAddProjectRef.current = openAddProject;

        return (
        <div ref={scrollContainerRef} className="px-4 sm:px-6 lg:px-8 py-8">
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

            {/* Error State */}
            {hasError && !isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center max-w-md mx-auto">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Something went wrong
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {errorMessage}
                  </p>
                  <button
                    onClick={() => handleRetry()}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {/* Content */}
            {!hasError && (
              activeTab === 'profiles' ? (
              // Profiles Grid
              <div>
                {isLoading ? (
                  <LoadingSkeleton type="profile" count={9} />
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                      {allProfiles.map((user) => (
                        <UserProfileCard key={user.id} user={user} />
                      ))}
                    </div>

                {/* Infinite scroll trigger */}
                {hasNextProfiles && <div ref={observerTarget} className="h-4 mt-8" />}

                {/* Loading skeletons for next page - shown inline during fetch */}
                {isFetchingNextProfiles && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 mt-4">
                    <LoadingSkeleton type="profile" count={4} />
                  </div>
                )}

                {/* End of feed indicator */}
                {!hasNextProfiles && !isFetchingNextProfiles && allProfiles.length > 0 && (
                  <div className="flex flex-col items-center justify-center py-12 mt-8">
                    <div className="text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        You've reached the end
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {allProfiles.length} profiles shown
                      </p>
                    </div>
                  </div>
                )}
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
                  <>
                    <div className="columns-1 sm:columns-2 lg:columns-3 2xl:columns-4 gap-2">
                      {/* Interleave quizzes and projects with stable ordering */}
                      {mixedItems.map((item) => (
                        <div key={item.stableKey} className="break-inside-avoid mb-2">
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
                      ))}
                    </div>

                    {/* Infinite scroll trigger - placed outside columns for reliability */}
                    {hasNextPage && (
                      <div ref={observerTarget} className="h-20 w-full mt-8" style={{ clear: 'both' }} />
                    )}

                    {/* Loading skeletons for next page - shown inline during fetch */}
                    {isFetchingNextPage && (
                      <div className="columns-1 sm:columns-2 lg:columns-3 2xl:columns-4 gap-2 mt-2">
                        <LoadingSkeleton type="project" count={6} />
                      </div>
                    )}

                    {/* End of feed indicator */}
                    {!hasNextPage && !isFetchingNextPage && displayProjects.length > 0 && (
                      <div className="flex flex-col items-center justify-center py-12 mt-8">
                        <div className="text-center">
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                            You've reached the end
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {displayProjects.length} projects shown
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )
            )}
          </div>
        );
      }}
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
