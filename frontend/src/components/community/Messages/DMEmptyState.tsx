/**
 * DM Empty State Component
 *
 * Shows when user has no DM conversations yet.
 * Provides inline search and suggested users to message.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { MagnifyingGlassIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { useDMSuggestions } from '@/hooks/useDMSuggestions';
import { createDMThread } from '@/services/community';
import { globalSearch } from '@/services/globalSearch';
import type { DMSuggestion } from '@/types/community';
import type { UserSearchResult } from '@/types/search';

interface DMEmptyStateProps {
  onStartThread: (threadId: string) => void;
}

export function DMEmptyState({ onStartThread }: DMEmptyStateProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: suggestions, isLoading: isLoadingSuggestions } = useDMSuggestions(8);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await globalSearch({
          query: searchQuery,
          types: ['users'],
          limit: 5,
        });
        setSearchResults(response.results.users || []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Handle clicking on a user (search result or suggestion)
  const handleUserClick = useCallback(async (userId: number | string) => {
    if (isCreatingThread) return;

    setIsCreatingThread(true);
    try {
      // Ensure userId is a number for the API
      const numericId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
      const thread = await createDMThread({
        participantIds: [numericId],
      });
      onStartThread(thread.id);
    } catch (error) {
      console.error('Failed to create DM thread:', error);
    } finally {
      setIsCreatingThread(false);
    }
  }, [isCreatingThread, onStartThread]);

  // Get match reason color
  const getMatchReasonColor = (reason: string) => {
    switch (reason) {
      case 'In your Thrive Circle':
        return 'text-cyan-400 bg-cyan-500/10';
      case 'You follow':
        return 'text-purple-400 bg-purple-500/10';
      default:
        return 'text-slate-400 bg-slate-500/10';
    }
  };

  return (
    <div className="flex flex-col h-full p-4">
      {/* Search Input */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for someone to message..."
          className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
        />
        {isSearching && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Search Results */}
      {searchQuery.trim() && searchResults.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Search Results
          </h3>
          <div className="space-y-2">
            {searchResults.map((user) => (
              <button
                key={user.id}
                onClick={() => handleUserClick(user.id)}
                disabled={isCreatingThread}
                className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all disabled:opacity-50"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.username}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center">
                    <span className="text-white font-medium">
                      {user.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 text-left">
                  <p className="text-white font-medium">{user.fullName || user.username}</p>
                  <p className="text-sm text-slate-400">@{user.username}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No Search Results */}
      {searchQuery.trim() && !isSearching && searchResults.length === 0 && (
        <div className="mb-6 text-center py-4">
          <p className="text-slate-400 text-sm">No users found for "{searchQuery}"</p>
        </div>
      )}

      {/* Suggested Users */}
      {!searchQuery.trim() && (
        <>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Suggested
          </h3>

          {isLoadingSuggestions ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-32 h-40 bg-white/5 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : suggestions && suggestions.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
              {suggestions.map((user) => (
                <SuggestionCard
                  key={user.userId}
                  user={user}
                  onClick={() => handleUserClick(user.userId)}
                  disabled={isCreatingThread}
                  matchReasonColor={getMatchReasonColor(user.matchReason)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <UserCircleIcon className="w-12 h-12 text-slate-500 mb-3" />
              <p className="text-slate-400 text-sm">
                Search for someone to start a conversation
              </p>
            </div>
          )}

          {/* Quick Actions */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-slate-500 text-center">
              Or visit someone's profile to message them
            </p>
            <button
              onClick={() => navigate('/explore')}
              className="mt-3 w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-sm font-medium transition-all"
            >
              Explore Profiles
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Suggestion Card Component
function SuggestionCard({
  user,
  onClick,
  disabled,
  matchReasonColor,
}: {
  user: DMSuggestion;
  onClick: () => void;
  disabled: boolean;
  matchReasonColor: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-shrink-0 w-32 p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all disabled:opacity-50 text-center group"
    >
      {/* Avatar */}
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.username}
          className="w-14 h-14 mx-auto rounded-full object-cover mb-2 group-hover:ring-2 group-hover:ring-cyan-500/50 transition-all"
        />
      ) : (
        <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center mb-2 group-hover:ring-2 group-hover:ring-cyan-500/50 transition-all">
          <span className="text-white text-lg font-medium">
            {user.username.charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      {/* Name */}
      <p className="text-white text-sm font-medium truncate">
        {user.displayName || user.username}
      </p>
      <p className="text-xs text-slate-400 truncate mb-2">@{user.username}</p>

      {/* Match Reason */}
      <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${matchReasonColor}`}>
        {user.matchReason}
      </span>
    </button>
  );
}

export default DMEmptyState;
