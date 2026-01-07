/**
 * FeedbackPage - Community feedback page for feature requests and bug reports
 * Uses Neon Glass design system with DashboardLayout
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tab } from '@headlessui/react';
import { PlusIcon, MagnifyingGlassIcon, LightBulbIcon, BugAntIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { getFeedbackItems, getMyFeedback, getFeedbackItem, type FeedbackItem } from '@/services/feedback';
import { FeedbackCard } from '@/components/feedback/FeedbackCard';
import { FeedbackDetailTray } from '@/components/feedback/FeedbackDetailTray';
import { FeedbackSubmitTray } from '@/components/feedback/FeedbackSubmitTray';

/**
 * Smooth-looping video avatar for Haven
 * Resets video slightly before end to avoid the skip/gap on loop
 */
function HavenVideo({ className }: { className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      // Wait 3 seconds before restarting
      setTimeout(() => {
        video.currentTime = 0;
        video.play();
      }, 3000);
    };

    video.addEventListener('ended', handleEnded);
    return () => video.removeEventListener('ended', handleEnded);
  }, []);

  return (
    <video
      ref={videoRef}
      src="/haven-customer-support.mp4"
      autoPlay
      muted
      playsInline
      className={className}
    />
  );
}

type TabType = 'features' | 'bugs' | 'mine';
type SortType = '-vote_count' | '-created_at';

const tabs: { key: TabType; label: string; icon: typeof LightBulbIcon }[] = [
  { key: 'features', label: 'Feature Requests', icon: LightBulbIcon },
  { key: 'bugs', label: 'Bug Reports', icon: BugAntIcon },
  { key: 'mine', label: 'My Submissions', icon: ChatBubbleLeftIcon },
];

const sortOptions: { value: SortType; label: string }[] = [
  { value: '-vote_count', label: 'Most Voted' },
  { value: '-created_at', label: 'Newest' },
];

export function FeedbackPage() {
  const { id: feedbackIdParam } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabType>('features');
  const [sortBy, setSortBy] = useState<SortType>('-vote_count');
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tray states
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);
  const [isDetailTrayOpen, setIsDetailTrayOpen] = useState(false);
  const [isSubmitTrayOpen, setIsSubmitTrayOpen] = useState(false);

  // Handle deep link - load specific feedback item from URL param
  useEffect(() => {
    if (feedbackIdParam) {
      const feedbackId = parseInt(feedbackIdParam, 10);
      if (!isNaN(feedbackId)) {
        getFeedbackItem(feedbackId)
          .then((item) => {
            setSelectedItem(item);
            setIsDetailTrayOpen(true);
            // Set the appropriate tab based on feedback type
            if (item.feedbackType === 'feature') {
              setActiveTab('features');
            } else if (item.feedbackType === 'bug') {
              setActiveTab('bugs');
            }
          })
          .catch((err) => {
            console.error('Failed to load feedback item:', err);
            // Navigate to main feedback page if item not found
            navigate('/feedback', { replace: true });
          });
      }
    }
  }, [feedbackIdParam, navigate]);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let response;
      if (activeTab === 'mine') {
        response = await getMyFeedback({
          ordering: sortBy,
          search: searchQuery || undefined,
        });
      } else {
        response = await getFeedbackItems({
          feedbackType: activeTab === 'features' ? 'feature' : 'bug',
          ordering: sortBy,
          search: searchQuery || undefined,
        });
      }
      setItems(response.results);
    } catch (err) {
      console.error('Failed to load feedback:', err);
      setError('Failed to load feedback items');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, sortBy, searchQuery]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleCardClick = (item: FeedbackItem) => {
    setSelectedItem(item);
    setIsDetailTrayOpen(true);
  };

  const handleCloseDetailTray = () => {
    setIsDetailTrayOpen(false);
    setTimeout(() => setSelectedItem(null), 200);
    // Clear the URL param when closing the tray
    if (feedbackIdParam) {
      navigate('/feedback', { replace: true });
    }
  };

  const handleSubmitSuccess = (newItem: FeedbackItem) => {
    if (
      activeTab === 'mine' ||
      (activeTab === 'features' && newItem.feedbackType === 'feature') ||
      (activeTab === 'bugs' && newItem.feedbackType === 'bug')
    ) {
      setItems((prev) => [newItem, ...prev]);
    }
    setSelectedItem(newItem);
    setIsDetailTrayOpen(true);
  };

  const handleTabChange = (index: number) => {
    setActiveTab(tabs[index].key);
    setSearchQuery('');
  };

  const handleItemUpdate = (updatedItem: FeedbackItem) => {
    // Update the item in the list
    setItems((prev) => prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)));
    // Update the selected item if it's the one being viewed
    setSelectedItem(updatedItem);
  };

  const handleItemDelete = (itemId: number) => {
    // Remove the item from the list
    setItems((prev) => prev.filter((item) => item.id !== itemId));
    // Clear selected item and close tray
    setSelectedItem(null);
    setIsDetailTrayOpen(false);
  };

  return (
    <DashboardLayout>
      {() => (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
          {/* Hero Header */}
          <header className="relative h-64 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-900 dark:to-slate-800 overflow-hidden">
            {/* Gradient blurs */}
            <div className="absolute top-1/2 left-1/4 -translate-x-1/4 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-rose-500/20 dark:bg-rose-500/15 blur-[120px] pointer-events-none" />
            <div className="absolute top-1/4 right-1/4 w-[400px] h-[300px] rounded-full bg-pink-500/15 dark:bg-pink-500/10 blur-[100px] pointer-events-none" />

            <div className="relative px-4 sm:px-6 lg:px-8 h-full flex items-center">
              <HavenVideo className="w-32 h-32 rounded-full ring-2 ring-white/20 flex-shrink-0 object-cover object-[center_20%]" />
              <div className="ml-6 flex-1">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                  <span className="bg-gradient-to-r from-rose-500 via-pink-400 to-fuchsia-400 dark:from-rose-400 dark:via-pink-300 dark:to-fuchsia-300 bg-clip-text text-transparent">
                    Community Feedback
                  </span>
                </h1>
                <p className="text-xl text-gray-700 dark:text-gray-300">
                  Share your ideas and report issues to help us build a better All Thrive together
                </p>
              </div>
              <button
                onClick={() => setIsSubmitTrayOpen(true)}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 text-white font-medium rounded-xl shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 transition-all duration-200 hover:scale-[1.02]"
              >
                <PlusIcon className="w-5 h-5" />
                <span>Submit Feedback</span>
              </button>
            </div>
          </header>

          {/* Content */}
          <div className="px-4 sm:px-6 lg:px-8 py-8">
            <Tab.Group selectedIndex={tabs.findIndex((t) => t.key === activeTab)} onChange={handleTabChange}>
              {/* Tabs + Search + Sort */}
              <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-8">
                <Tab.List className="flex gap-1 p-1 rounded bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <Tab
                        key={tab.key}
                        className={({ selected }) =>
                          `flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50
                          ${
                            selected
                              ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-700/50'
                          }`
                        }
                      >
                        <Icon className="w-4 h-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                      </Tab>
                    );
                  })}
                </Tab.List>

                <div className="flex-1 flex gap-3">
                  {/* Search */}
                  <div className="relative flex-1">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search feedback..."
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                    />
                  </div>

                  {/* Sort */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortType)}
                    className="px-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                  >
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value} className="bg-white dark:bg-slate-800">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items list */}
              <Tab.Panels>
                {tabs.map((tab) => (
                  <Tab.Panel key={tab.key}>
                    {isLoading ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 animate-pulse"
                          >
                            <div className="flex gap-4">
                              <div className="w-14 h-16 bg-gray-200 dark:bg-slate-700 rounded-lg" />
                              <div className="flex-1 space-y-3">
                                <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4" />
                                <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-1/2" />
                                <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-1/4" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : error ? (
                      <div className="text-center py-16">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-4">
                          <BugAntIcon className="w-8 h-8 text-red-400" />
                        </div>
                        <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
                        <button
                          onClick={loadItems}
                          className="text-sm text-cyan-600 hover:text-cyan-500 dark:text-cyan-400 font-medium"
                        >
                          Try again
                        </button>
                      </div>
                    ) : items.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-800 mb-4">
                          {tab.key === 'features' ? (
                            <LightBulbIcon className="w-8 h-8 text-purple-400" />
                          ) : tab.key === 'bugs' ? (
                            <BugAntIcon className="w-8 h-8 text-red-400" />
                          ) : (
                            <ChatBubbleLeftIcon className="w-8 h-8 text-cyan-400" />
                          )}
                        </div>
                        <p className="text-gray-500 dark:text-slate-400 mb-4">
                          {searchQuery
                            ? 'No results found. Try a different search term.'
                            : tab.key === 'mine'
                              ? "You haven't submitted any feedback yet."
                              : `No ${tab.key === 'features' ? 'feature requests' : 'bug reports'} yet. Be the first to share!`}
                        </p>
                        {!searchQuery && (
                          <button
                            onClick={() => setIsSubmitTrayOpen(true)}
                            className="inline-flex items-center gap-2 text-sm font-medium text-cyan-600 hover:text-cyan-500 dark:text-cyan-400"
                          >
                            <PlusIcon className="w-4 h-4" />
                            Submit Feedback
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {items.map((item) => (
                          <FeedbackCard
                            key={item.id}
                            item={item}
                            onClick={() => handleCardClick(item)}
                          />
                        ))}
                      </div>
                    )}
                  </Tab.Panel>
                ))}
              </Tab.Panels>
            </Tab.Group>
          </div>

          {/* Detail Tray */}
          <FeedbackDetailTray
            item={selectedItem}
            isOpen={isDetailTrayOpen}
            onClose={handleCloseDetailTray}
            onUpdate={handleItemUpdate}
            onDelete={handleItemDelete}
          />

          {/* Submit Tray */}
          <FeedbackSubmitTray
            isOpen={isSubmitTrayOpen}
            onClose={() => setIsSubmitTrayOpen(false)}
            onSuccess={handleSubmitSuccess}
            defaultType={activeTab === 'bugs' ? 'bug' : 'feature'}
          />
        </div>
      )}
    </DashboardLayout>
  );
}

export default FeedbackPage;
