import { useState, useEffect, useRef, useMemo, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import type { Taxonomy, Project } from '@/types/models';
import type { Quiz } from '@/components/quiz/types';
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

// Memoized wrapper for smooth fade-in animation on new items
const FadeInItem = memo(function FadeInItem({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Small delay to ensure DOM is ready, then trigger animation
    const timer = requestAnimationFrame(() => {
      setIsVisible(true);
    });
    return () => cancelAnimationFrame(timer);
  }, []);

  return (
    <div
      className={`break-inside-avoid mb-2 transition-all duration-300 ease-out ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4'
      }`}
      style={{
        willChange: isVisible ? 'auto' : 'opacity, transform',
      }}
    >
      {children}
    </div>
  );
});

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
    tab: activeTab === 'for-you' ? 'for-you' : activeTab === 'trending' ? 'trending' : activeTab === 'news' ? 'news' : 'all',
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
    queryFn: async ({ pageParam = 1 }) => {
      console.log('[useInfiniteQuery] queryFn called with pageParam:', pageParam);
      const result = await exploreProjects({ ...exploreParamsBase, page: pageParam });
      console.log('[useInfiniteQuery] queryFn result:', {
        count: result.count,
        next: result.next,
        resultsLength: result.results?.length,
        keys: Object.keys(result)
      });
      return result;
    },
    getNextPageParam: (lastPage, allPages) => {
      const nextPage = lastPage.next ? allPages.length + 1 : undefined;
      console.log('[useInfiniteQuery] getNextPageParam:', {
        lastPageNext: lastPage.next,
        allPagesLength: allPages.length,
        nextPage,
        lastPageCount: lastPage.count,
        lastPageResultsLength: lastPage.results?.length
      });
      return nextPage;
    },
    initialPageParam: 1,
    staleTime: 0, // Disable caching for debugging
    gcTime: 0, // Disable garbage collection time (formerly cacheTime)
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

  // Fetch quizzes (exclude from profiles and news tabs)
  const {
    data: quizzesData,
    isLoading: isLoadingQuizzes,
  } = useQuery({
    queryKey: ['exploreQuizzes', searchQuery],
    queryFn: () => getQuizzes({ search: searchQuery || undefined }),
    enabled: activeTab !== 'profiles' && activeTab !== 'news',
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

  // Mix quizzes into projects while preserving backend sort order
  // Projects maintain their order from the API (sorted by recency/trending/relevance)
  // Quizzes are interleaved at regular intervals for variety
  type MixedItem =
    | { type: 'quiz'; data: Quiz; stableKey: string }
    | { type: 'project'; data: Project; stableKey: string };

  const mixedItems = useMemo(() => {
    const QUIZ_INTERVAL = 8; // Insert a quiz every N projects
    const result: MixedItem[] = [];

    let quizIndex = 0;

    // Iterate through projects in their original order from backend
    displayProjects.forEach((project, projectIndex) => {
      // Insert a quiz before every QUIZ_INTERVAL projects (if quizzes available)
      if (projectIndex > 0 && projectIndex % QUIZ_INTERVAL === 0 && quizIndex < displayQuizzes.length) {
        const quiz = displayQuizzes[quizIndex];
        result.push({
          type: 'quiz' as const,
          data: quiz,
          stableKey: `quiz-${quiz.slug || quiz.id}`
        });
        quizIndex++;
      }

      // Add the project in its original order
      result.push({
        type: 'project' as const,
        data: project,
        stableKey: `project-${project.slug || project.id}`
      });
    });

    // Add any remaining quizzes at the end
    while (quizIndex < displayQuizzes.length) {
      const quiz = displayQuizzes[quizIndex];
      result.push({
        type: 'quiz' as const,
        data: quiz,
        stableKey: `quiz-${quiz.slug || quiz.id}`
      });
      quizIndex++;
    }

    return result;
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

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          console.log('[InfiniteScroll] Observer triggered, hasNextPage:', hasNextPage, 'isFetching:', isFetchingNextPage);
          if (activeTab === 'profiles') {
            if (hasNextProfiles && !isFetchingNextProfiles) {
              console.log('[InfiniteScroll] Fetching next profiles page');
              fetchNextProfiles();
            }
          } else {
            if (hasNextPage && !isFetchingNextPage) {
              console.log('[InfiniteScroll] Fetching next projects page');
              fetchNextPage();
            }
          }
        }
      },
      {
        root: null, // Use viewport
        threshold: 0,
        rootMargin: '400px' // Load when within 400px of viewport
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
  // Temporarily disabled to avoid auto-reopening the Add Project chat on Explore
  // when users close it manually. Re-enable once the welcome flow is revised.
  // useEffect(() => {
  //   const isWelcome = searchParams.get('welcome') === 'true';
  //   if (isWelcome && openAddProjectRef.current) {
  //     // Remove the welcome param from URL first
  //     const newParams = new URLSearchParams(searchParams);
  //     newParams.delete('welcome');
  //     setSearchParams(newParams, { replace: true });
  //     // Open the chat in welcome mode after a brief delay for UI to settle
  //     setTimeout(() => openAddProjectRef.current?.(true), 100);
  //   }
  // }, [searchParams, setSearchParams]);

  return (
    <>
    <DashboardLayout>
      {({ openAddProject, openCommentPanel }) => {
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
                      {allProfiles.map((profile) => (
                        <div
                          key={profile.id}
                          className="animate-fade-in-up"
                          style={{
                            animationDelay: '0ms',
                            animationFillMode: 'backwards',
                          }}
                        >
                          <UserProfileCard user={profile} />
                        </div>
                      ))}
                    </div>

                {/* Infinite scroll trigger - always present for continuous loading */}
                <div ref={observerTarget} className="h-20 mt-8" aria-hidden="true" />

                {/* Loading indicator for next page */}
                {isFetchingNextProfiles && (
                  <div className="flex justify-center py-8">
                    <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-sm">Loading more profiles...</span>
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
                        <FadeInItem key={item.stableKey}>
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
                              onCommentClick={openCommentPanel}
                            />
                          )}
                        </FadeInItem>
                      ))}
                    </div>

                    {/* Infinite scroll trigger */}
                    <div
                      ref={observerTarget}
                      className="h-20 w-full mt-8"
                      style={{ clear: 'both' }}
                      aria-hidden="true"
                    />

                    {/* Loading indicator or Load More button */}
                    {isFetchingNextPage ? (
                      <div className="flex justify-center py-8">
                        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span className="text-sm">Loading more projects...</span>
                        </div>
                      </div>
                    ) : hasNextPage ? (
                      <div className="flex justify-center py-8">
                        <button
                          onClick={() => fetchNextPage()}
                          className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                        >
                          Load More Projects
                        </button>
                      </div>
                    ) : allProjects.length > 0 ? (
                      <div className="flex justify-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                        You've reached the end ({allProjects.length} projects)
                      </div>
                    ) : null}
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
