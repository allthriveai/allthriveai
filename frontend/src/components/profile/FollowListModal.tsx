import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes, faUserPlus } from '@fortawesome/free-solid-svg-icons';
import { followService, type FollowListItem } from '@/services/followService';
import { useAuth } from '@/hooks/useAuth';
import { logError } from '@/utils/errorHandler';

interface FollowListModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  type: 'followers' | 'following';
}

export function FollowListModal({ isOpen, onClose, username, type }: FollowListModalProps) {
  const { user, isAuthenticated } = useAuth();
  const [users, setUsers] = useState<FollowListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [followingStates, setFollowingStates] = useState<Record<string, boolean>>({});
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      loadUsers(1, true);
    }
  }, [isOpen, username, type]);

  const loadUsers = async (pageNum: number, reset = false) => {
    setIsLoading(true);
    try {
      const response = type === 'followers'
        ? await followService.getFollowers(username, pageNum)
        : await followService.getFollowing(username, pageNum);

      if (reset) {
        setUsers(response.results);
      } else {
        setUsers(prev => [...prev, ...response.results]);
      }

      setHasMore(!!response.next);
      setPage(pageNum);

      // Initialize following states for followers list
      if (type === 'followers') {
        const states: Record<string, boolean> = {};
        response.results.forEach(item => {
          states[item.user.username] = item.isFollowing ?? false;
        });
        if (reset) {
          setFollowingStates(states);
        } else {
          setFollowingStates(prev => ({ ...prev, ...states }));
        }
      }
    } catch (error) {
      logError('FollowListModal.loadUsers', error, { username, type, pageNum });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFollow = async (targetUsername: string) => {
    if (!isAuthenticated || loadingStates[targetUsername]) return;

    setLoadingStates(prev => ({ ...prev, [targetUsername]: true }));
    try {
      const isCurrentlyFollowing = followingStates[targetUsername];
      if (isCurrentlyFollowing) {
        await followService.unfollowUser(targetUsername);
        setFollowingStates(prev => ({ ...prev, [targetUsername]: false }));
      } else {
        await followService.followUser(targetUsername);
        setFollowingStates(prev => ({ ...prev, [targetUsername]: true }));
      }
    } catch (error) {
      logError('FollowListModal.handleToggleFollow', error, { targetUsername });
    } finally {
      setLoadingStates(prev => ({ ...prev, [targetUsername]: false }));
    }
  };

  const loadMore = () => {
    if (!isLoading && hasMore) {
      loadUsers(page + 1, false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {type === 'followers' ? 'Followers' : 'Following'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} className="w-5 h-5" />
          </button>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && users.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <FontAwesomeIcon icon={faSpinner} className="w-6 h-6 animate-spin text-teal-500" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {type === 'followers'
                ? 'No followers yet'
                : 'Not following anyone yet'}
            </div>
          ) : (
            <div className="space-y-3">
              {users.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Link
                    to={`/${item.user.username}`}
                    onClick={onClose}
                    className="flex items-center gap-3 min-w-0 flex-1"
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                      {item.user.avatarUrl ? (
                        <img
                          src={item.user.avatarUrl}
                          alt={item.user.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 font-semibold">
                          {item.user.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white truncate">
                      @{item.user.username}
                    </span>
                  </Link>

                  {/* Follow button - only for followers list and not for self */}
                  {type === 'followers' && isAuthenticated && user?.username !== item.user.username && (
                    <button
                      onClick={() => handleToggleFollow(item.user.username)}
                      disabled={loadingStates[item.user.username]}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex-shrink-0 ${
                        followingStates[item.user.username]
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400'
                          : 'bg-teal-500 text-white hover:bg-teal-600'
                      }`}
                    >
                      {loadingStates[item.user.username] ? (
                        <FontAwesomeIcon icon={faSpinner} className="w-4 h-4 animate-spin" />
                      ) : followingStates[item.user.username] ? (
                        'Following'
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faUserPlus} className="w-3 h-3 mr-1" />
                          Follow
                        </>
                      )}
                    </button>
                  )}
                </div>
              ))}

              {/* Load More */}
              {hasMore && (
                <button
                  onClick={loadMore}
                  disabled={isLoading}
                  className="w-full py-2 text-sm text-teal-600 dark:text-teal-400 hover:underline disabled:opacity-50"
                >
                  {isLoading ? (
                    <FontAwesomeIcon icon={faSpinner} className="w-4 h-4 animate-spin" />
                  ) : (
                    'Load more'
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
