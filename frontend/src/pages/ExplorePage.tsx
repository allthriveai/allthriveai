import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import type { Taxonomy, Project } from '@/types/models';
import type { Quiz } from '@/components/quiz/types';
import { api } from '@/services/api';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SearchBarWithFilters } from '@/components/explore/SearchBarWithFilters';
import type { ContentTypeKey } from '@/components/explore/FilterDropdown';
import { TabNavigation, type ExploreTab } from '@/components/explore/TabNavigation';
import { UserProfileCard } from '@/components/explore/UserProfileCard';
import { QuizPreviewCard } from '@/components/quiz/QuizPreviewCard';
import { QuizOverlay } from '@/components/quiz/QuizOverlay';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { LoadingSkeleton } from '@/components/explore/LoadingSkeleton';
import { MasonryGrid } from '@/components/common/MasonryGrid';
import {
  exploreProjects,
  semanticSearch,
  exploreProfiles,
  getFilterOptions,
} from '@/services/explore';
import { getQuizzes } from '@/services/quiz';
import { useAuth } from '@/hooks/useAuth';
import { trackProjectClick, getClickSourceFromTab } from '@/services/tracking';


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
  const [selectedContentType, setSelectedContentType] = useState<ContentTypeKey>(
    (searchParams.get('contentType') as ContentTypeKey) || 'all'
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
    if (selectedContentType !== 'all') params.set('contentType', selectedContentType);
    setSearchParams(params, { replace: true });
  }, [activeTab, searchQuery, selectedCategorySlugs, selectedToolSlugs, selectedContentType, setSearchParams]);

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

  // Convert category slugs to IDs for API (memoized to prevent re-renders)
  const selectedCategoryIds = useMemo(() => {
    return taxonomyCategories
      ?.filter(cat => selectedCategorySlugs.includes(cat.slug))
      .map(cat => cat.id) || [];
  }, [taxonomyCategories, selectedCategorySlugs]);

  // Convert tool slugs to IDs for API (memoized to prevent re-renders)
  const selectedToolIds = useMemo(() => {
    return filterOptions?.tools
      .filter(tool => selectedToolSlugs.includes(tool.slug))
      .map(tool => tool.id) || [];
  }, [filterOptions, selectedToolSlugs]);

  // Map tab to API tab parameter (memoized)
  type TabType = 'new' | 'for-you' | 'trending';
  const apiTab: TabType = useMemo(() => {
    switch (activeTab) {
      case 'for-you': return 'for-you' as const;
      case 'trending': return 'trending' as const;
      case 'new': return 'new' as const;
      default: return 'for-you' as const;
    }
  }, [activeTab]);

  // Memoize params to prevent queryKey from changing on every render
  const exploreParamsBase = useMemo(() => ({
    tab: apiTab,
    search: searchQuery || undefined,
    categories: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
    tools: selectedToolIds.length > 0 ? selectedToolIds : undefined,
    page_size: 30,
  }), [apiTab, searchQuery, selectedCategoryIds, selectedToolIds]);

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
      const params = { ...exploreParamsBase, page: pageParam as number };
      return await exploreProjects(params);
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.next ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
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
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
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
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch quizzes (exclude from profiles tab)
  const {
    data: quizzesData,
    isLoading: isLoadingQuizzes,
  } = useQuery({
    queryKey: ['exploreQuizzes', searchQuery],
    queryFn: () => getQuizzes({ search: searchQuery || undefined }),
    enabled: activeTab !== 'profiles',
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Determine which data to display
  // IMPORTANT: If category or tool filters are selected but taxonomies/tools haven't loaded yet,
  // show loading state instead of showing unfiltered results
  const isWaitingForFilters =
    (selectedCategorySlugs.length > 0 && !taxonomyCategories) ||
    (selectedToolSlugs.length > 0 && !filterOptions);

  // Flatten paginated results for infinite scroll and deduplicate by slug
  const allProjects = useMemo(() => {
    const projects = projectsData?.pages.flatMap(page => page.results) || [];
    const seen = new Set<string>();
    return projects.filter(project => {
      const key = project.slug || String(project.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [projectsData]);

  const allProfiles = useMemo(() => {
    const profiles = profilesData?.pages.flatMap(page => page.results) || [];
    const seen = new Set<number>();
    return profiles.filter(profile => {
      if (seen.has(profile.id)) return false;
      seen.add(profile.id);
      return true;
    });
  }, [profilesData]);

  const displayProjects = useMemo(() => {
    // Hide projects when 'quiz' type is selected (quizzes are not projects)
    if (selectedContentType === 'quiz') return [];

    // Use semantic results only if they have actual results
    // Fall back to explore API results (which also support search) when semantic returns empty
    let projects = searchQuery && semanticResults && semanticResults.length > 0
      ? semanticResults
      : allProjects;

    // Apply client-side content type filter
    if (selectedContentType !== 'all') {
      projects = projects.filter(project => project.type === selectedContentType);
    }

    return projects;
  }, [searchQuery, semanticResults, allProjects, selectedContentType]);

  // Filter quizzes by tab, content type, categories, and tools
  const displayQuizzes = useMemo(() => {
    // Don't show quizzes in profiles tab
    if (activeTab === 'profiles') return [];

    // Hide quizzes when a non-quiz content type is selected (except 'all')
    if (selectedContentType !== 'all' && selectedContentType !== 'quiz') return [];

    let quizzes = quizzesData?.results || [];

    // Filter by selected categories (if any)
    if (selectedCategorySlugs.length > 0) {
      quizzes = quizzes.filter(quiz =>
        quiz.categories?.some(cat => selectedCategorySlugs.includes(cat.slug))
      );
    }

    // Filter by selected tools (if any)
    if (selectedToolSlugs.length > 0) {
      quizzes = quizzes.filter(quiz =>
        quiz.tools?.some(tool => selectedToolSlugs.includes(tool.slug))
      );
    }

    return quizzes;
  }, [activeTab, quizzesData?.results, selectedContentType, selectedCategorySlugs, selectedToolSlugs]);
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

  const handleContentTypeChange = (type: ContentTypeKey) => {
    setSelectedContentType(type);
  };

  const handleOpenQuiz = (quizSlug: string) => {
    setSelectedQuizSlug(quizSlug);
    setQuizOverlayOpen(true);
  };

  const handleCloseQuiz = () => {
    setQuizOverlayOpen(false);
    setSelectedQuizSlug('');
  };

  // Create a lookup map for project positions based on their index in mixedItems
  const projectPositionMap = useMemo(() => {
    const map = new Map<number, number>();
    let projectIndex = 0;
    mixedItems.forEach((item) => {
      if (item.type === 'project') {
        map.set(item.data.id, projectIndex);
        projectIndex++;
      }
    });
    return map;
  }, [mixedItems]);

  // Track click on project card (fire and forget - doesn't block navigation)
  const handleProjectClick = useCallback((projectId: number) => {
    const position = projectPositionMap.get(projectId);
    const source = getClickSourceFromTab(activeTab);
    trackProjectClick(projectId, source, position);
  }, [activeTab, projectPositionMap]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          if (activeTab === 'profiles') {
            if (hasNextProfiles && !isFetchingNextProfiles) {
              fetchNextProfiles();
            }
          } else {
            if (hasNextPage && !isFetchingNextPage) {
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

  // Show filters on all content tabs except profiles
  const showFilters = activeTab !== 'profiles';

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
            <div className="glass-subtle rounded border border-gray-200 dark:border-gray-700 p-6 mb-6 relative z-20">
              {/* Tab Navigation */}
              <TabNavigation activeTab={activeTab} onChange={handleTabChange} />

              {/* Search Bar with Integrated Filters */}
              <div className="mt-4 relative z-30">
                <SearchBarWithFilters
                  onSearch={handleSearch}
                  placeholder="Search projects with AI..."
                  initialValue={searchQuery}
                  topics={taxonomyCategories ?? []}
                  tools={filterOptions?.tools ?? []}
                  selectedTopics={selectedCategorySlugs}
                  selectedToolSlugs={selectedToolSlugs}
                  selectedContentType={selectedContentType}
                  onTopicsChange={handleCategoriesChange}
                  onToolsChange={handleToolsChange}
                  onContentTypeChange={handleContentTypeChange}
                  showFilters={showFilters}
                  openFiltersByDefault={false}
                />
              </div>
            </div>

            {/* Error State */}
            {hasError && !isLoading && (
              <div className="flex items-center justify-center py-12" role="alert" aria-live="assertive">
                <div className="text-center max-w-md mx-auto">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-label="Error icon">
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
              <div
                role="tabpanel"
                id={`tabpanel-${activeTab}`}
                aria-labelledby={`tab-${activeTab}`}
                className="relative z-10"
              >
                {isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                    <LoadingSkeleton type="profile" count={12} />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
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
                  <div className="flex justify-center py-8" role="status" aria-live="polite">
                    <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-label="Loading">
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
              <div
                role="tabpanel"
                id={`tabpanel-${activeTab}`}
                aria-labelledby={`tab-${activeTab}`}
                className="relative z-10"
              >
                {isLoading ? (
                  <MasonryGrid>
                    <LoadingSkeleton type="project" count={12} />
                  </MasonryGrid>
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
                    <MasonryGrid>
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
                              onCommentClick={openCommentPanel}
                              onCardClick={handleProjectClick}
                              enableInlinePreview={true}
                            />
                          )}
                        </div>
                      ))}
                    </MasonryGrid>

                    {/* Infinite scroll trigger */}
                    <div
                      ref={observerTarget}
                      className="h-20 w-full mt-8"
                      style={{ clear: 'both' }}
                      aria-hidden="true"
                    />

                    {/* Loading indicator or Load More button */}
                    {isFetchingNextPage ? (
                      <div className="flex justify-center py-8" role="status" aria-live="polite">
                        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-label="Loading">
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
              </div>
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
