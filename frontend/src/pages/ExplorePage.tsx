import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SemanticSearchBar } from '@/components/explore/SemanticSearchBar';
import { TabNavigation, type ExploreTab } from '@/components/explore/TabNavigation';
import { FilterPanel } from '@/components/explore/FilterPanel';
import { ProjectsGrid } from '@/components/explore/ProjectsGrid';
import { UserProfileCard } from '@/components/explore/UserProfileCard';
import {
  exploreProjects,
  semanticSearch,
  exploreProfiles,
  getFilterOptions,
  type ExploreParams,
} from '@/services/explore';

export function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // State from URL params
  const [activeTab, setActiveTab] = useState<ExploreTab>(
    (searchParams.get('tab') as ExploreTab) || 'for-you'
  );
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedTopics, setSelectedTopics] = useState<string[]>(
    searchParams.get('topics')?.split(',').filter(Boolean) || []
  );
  const [selectedTools, setSelectedTools] = useState<number[]>(
    searchParams.get('tools')?.split(',').map(Number).filter(Boolean) || []
  );
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeTab !== 'for-you') params.set('tab', activeTab);
    if (searchQuery) params.set('q', searchQuery);
    if (selectedTopics.length > 0) params.set('topics', selectedTopics.join(','));
    if (selectedTools.length > 0) params.set('tools', selectedTools.join(','));
    if (page > 1) params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [activeTab, searchQuery, selectedTopics, selectedTools, page, setSearchParams]);

  // Fetch filter options
  const { data: filterOptions } = useQuery({
    queryKey: ['filterOptions'],
    queryFn: getFilterOptions,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch projects (for most tabs)
  const exploreParams: ExploreParams = {
    tab: activeTab === 'for-you' ? 'for-you' : activeTab === 'trending' ? 'trending' : 'all',
    search: searchQuery || undefined,
    topics: selectedTopics.length > 0 ? selectedTopics : undefined,
    tools: selectedTools.length > 0 ? selectedTools : undefined,
    page,
    page_size: 30,
  };

  const {
    data: projectsData,
    isLoading: isLoadingProjects,
    refetch: refetchProjects,
  } = useQuery({
    queryKey: ['exploreProjects', exploreParams],
    queryFn: () => exploreProjects(exploreParams),
    enabled: activeTab !== 'profiles',
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

  // Determine which data to display
  const displayProjects = searchQuery && semanticResults ? semanticResults : projectsData?.results || [];
  const isLoading = isLoadingProjects || isLoadingSemanticSearch || isLoadingProfiles;

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
  const handleTopicsChange = (topics: string[]) => {
    setSelectedTopics(topics);
    setPage(1);
  };

  const handleToolsChange = (tools: number[]) => {
    setSelectedTools(tools);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSelectedTopics([]);
    setSelectedTools([]);
    setPage(1);
  };

  // Show filters only for certain tabs
  const showFilters = activeTab === 'topics' || activeTab === 'tools';

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Explore
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Discover amazing projects and creators
          </p>
        </div>

        {/* Search Bar */}
        <SemanticSearchBar
          onSearch={handleSearch}
          placeholder="Search projects with AI..."
          initialValue={searchQuery}
        />

        {/* Tab Navigation */}
        <TabNavigation activeTab={activeTab} onChange={handleTabChange} />

        {/* Filters */}
        {showFilters && filterOptions && (
          <div className="mb-6">
            <FilterPanel
              topics={filterOptions.topics}
              tools={filterOptions.tools}
              selectedTopics={selectedTopics}
              selectedTools={selectedTools}
              onTopicsChange={handleTopicsChange}
              onToolsChange={handleToolsChange}
              onClear={handleClearFilters}
            />
          </div>
        )}

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
          // Projects Grid
          <>
            <ProjectsGrid
              projects={displayProjects}
              isLoading={isLoading}
              emptyMessage={
                searchQuery
                  ? `No projects found for "${searchQuery}"`
                  : 'No projects found'
              }
            />

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
  );
}
