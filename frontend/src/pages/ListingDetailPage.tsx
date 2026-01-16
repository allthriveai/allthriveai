/**
 * ListingDetailPage - Page for viewing and editing listings
 *
 * This page handles:
 * - Data fetching and loading states
 * - SEO metadata
 * - Owner-only inline editing via ListingEditor
 * - Navigation for slug changes
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SEO } from '@/components/common/SEO';
import { getListingBySlug, deleteListing, toggleListingHeart, toggleListingSave } from '@/services/listings';
import type { Listing } from '@/types/listings';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeftIcon, HeartIcon, BookmarkIcon, TrashIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon, BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';
import { ListingEditor, ListingEditView } from '@/components/listings';
import clsx from 'clsx';

export default function ListingDetailPage() {
  const { username, listingSlug } = useParams<{ username: string; listingSlug: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Engagement state (local optimistic updates)
  const [isHearted, setIsHearted] = useState(false);
  const [heartCount, setHeartCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);

  // Ref to track loading state for event handlers
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;

  // Load listing data
  useEffect(() => {
    async function loadListing(showLoadingState = true) {
      if (!username || !listingSlug) {
        setError('Invalid listing URL');
        setIsLoading(false);
        return;
      }

      if (showLoadingState) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const fullListing = await getListingBySlug(username, listingSlug);
        setListing(fullListing);
        setIsHearted(fullListing.isHeartedByUser || false);
        setHeartCount(fullListing.heartCount || 0);
        setIsSaved(fullListing.isSavedByUser || false);
      } catch (err) {
        console.error('Failed to load listing:', err);
        if (showLoadingState) {
          setError('Listing not found');
        }
      } finally {
        if (showLoadingState) {
          setIsLoading(false);
        }
      }
    }

    loadListing(true);

    // Reload when window regains focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isLoadingRef.current) {
        loadListing(false);
      }
    };

    const handleFocus = () => {
      if (!isLoadingRef.current) {
        loadListing(false);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [username, listingSlug]);

  // Allow editing if user is the listing owner OR is an admin
  const isListingOwner = isAuthenticated && user && listing && user.username.toLowerCase() === listing.username.toLowerCase();
  const isAdmin = isAuthenticated && user && (user.role === 'admin' || user.isAdminRole);
  const isOwner = isListingOwner || isAdmin;

  // Auto-enable edit mode for owners
  useEffect(() => {
    if (isOwner && listing?.status === 'draft') {
      setIsEditMode(true);
    }
  }, [isOwner, listing?.status]);

  // Handler functions
  const handleDelete = async () => {
    if (!listing) return;

    if (!window.confirm('Are you sure you want to delete this listing?')) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteListing(listing.id);
      navigate(`/${username}`);
    } catch (error) {
      console.error('Failed to delete listing:', error);
      alert('Failed to delete listing');
      setIsDeleting(false);
    }
  };

  const handleToggleHeart = async () => {
    if (!listing || !isAuthenticated) return;

    // Optimistic update
    setIsHearted(!isHearted);
    setHeartCount(isHearted ? heartCount - 1 : heartCount + 1);

    try {
      const result = await toggleListingHeart(listing.id);
      setIsHearted(result.hearted || false);
      setHeartCount(result.heartCount || 0);
    } catch (error) {
      // Revert on error
      setIsHearted(isHearted);
      setHeartCount(heartCount);
      console.error('Failed to toggle heart:', error);
    }
  };

  const handleToggleSave = async () => {
    if (!listing || !isAuthenticated) return;

    // Optimistic update
    setIsSaved(!isSaved);

    try {
      const result = await toggleListingSave(listing.id);
      setIsSaved(result.saved || false);
    } catch (error) {
      // Revert on error
      setIsSaved(isSaved);
      console.error('Failed to toggle save:', error);
    }
  };

  const handleSlugChange = (newSlug: string) => {
    if (newSlug !== listingSlug) {
      navigate(`/${username}/listing/${newSlug}`, { replace: true });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout autoCollapseSidebar>
        <div className="flex-1 flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Loading listing...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (error || !listing) {
    return (
      <DashboardLayout autoCollapseSidebar>
        <div className="flex-1 flex items-center justify-center bg-gray-900 p-8">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold text-white mb-4">
              {error || 'Listing Not Found'}
            </h1>
            <p className="text-gray-400 mb-6">
              The listing you're looking for doesn't exist or you don't have permission to view it.
            </p>
            <button
              onClick={() => navigate(`/${username}`)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              Back to Profile
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Render listing
  return (
    <DashboardLayout autoCollapseSidebar>
      <SEO
        title={listing.title}
        description={listing.description || `${listing.title} by @${listing.username} on All Thrive AI`}
        image={listing.featuredImageUrl || listing.bannerUrl}
        type="article"
      />
      <div className="flex-1 bg-gray-900 overflow-y-auto">
        {/* Header with back button and actions */}
        <div className="sticky top-0 z-10 bg-gray-900/90 backdrop-blur-sm border-b border-gray-800">
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
            <button
              onClick={() => navigate(`/${username}`)}
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              <span className="text-sm">Back to @{username}</span>
            </button>

            <div className="flex items-center gap-3">
              {/* Heart button */}
              {isAuthenticated && (
                <button
                  onClick={handleToggleHeart}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors bg-gray-800 hover:bg-gray-700"
                >
                  {isHearted ? (
                    <HeartSolidIcon className="w-5 h-5 text-rose-500" />
                  ) : (
                    <HeartIcon className="w-5 h-5 text-gray-400" />
                  )}
                  <span className={isHearted ? 'text-rose-400' : 'text-gray-400'}>
                    {heartCount}
                  </span>
                </button>
              )}

              {/* Save button */}
              {isAuthenticated && (
                <button
                  onClick={handleToggleSave}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors bg-gray-800 hover:bg-gray-700"
                >
                  {isSaved ? (
                    <BookmarkSolidIcon className="w-5 h-5 text-amber-500" />
                  ) : (
                    <BookmarkIcon className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              )}

              {/* Delete button (owner only) */}
              {isOwner && (
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Intent badge */}
        <div className="max-w-3xl mx-auto px-6 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <span
              className={clsx(
                'px-3 py-1 rounded-full text-sm font-medium',
                listing.intent === 'offer'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
              )}
            >
              {listing.intent === 'offer' ? 'Offering' : 'Looking for'}
            </span>
            {listing.listingTypeDetails && (
              <span className="text-gray-500">
                {listing.listingTypeDetails.name}
              </span>
            )}
            {listing.status !== 'published' && listing.status !== 'open' && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-400">
                {listing.status}
              </span>
            )}
          </div>
        </div>

        {/* Listing content */}
        {isOwner ? (
          <ListingEditor
            listing={listing}
            onListingUpdate={setListing}
            onSlugChange={handleSlugChange}
          >
            {(editorProps) => (
              <ListingEditView
                {...editorProps}
                isEditMode={isEditMode}
                onToggleEdit={() => setIsEditMode(!isEditMode)}
              />
            )}
          </ListingEditor>
        ) : (
          // Read-only view for non-owners
          <div className="max-w-3xl mx-auto p-6">
            <h1 className="text-3xl font-bold text-white mb-4">{listing.title}</h1>
            <p className="text-lg text-gray-300 mb-6">{listing.description}</p>

            {/* Author info */}
            <div className="flex items-center gap-3 mb-8 pb-6 border-b border-gray-800">
              {listing.userAvatarUrl ? (
                <img
                  src={listing.userAvatarUrl}
                  alt={listing.userDisplayName || listing.username}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                  <span className="text-gray-400 text-sm font-medium">
                    {(listing.userDisplayName || listing.username).charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <div className="font-medium text-white">
                  {listing.userDisplayName || listing.username}
                </div>
                <div className="text-sm text-gray-500">@{listing.username}</div>
              </div>
            </div>

            {/* Body content */}
            {listing.bodyHtml ? (
              <div
                className="prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: listing.bodyHtml }}
              />
            ) : listing.body ? (
              <div className="text-gray-300 whitespace-pre-wrap">{listing.body}</div>
            ) : null}

            {/* Pricing/Budget info */}
            {listing.isPaid && listing.price && (
              <div className="mt-8 p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                <div className="text-sm text-gray-400 mb-1">Price</div>
                <div className="text-2xl font-bold text-white">
                  ${listing.price}
                  {listing.pricingType !== 'one_time' && (
                    <span className="text-base font-normal text-gray-400">
                      /{listing.pricingType === 'hourly' ? 'hr' : listing.pricingType}
                    </span>
                  )}
                </div>
              </div>
            )}

            {(listing.budgetMin || listing.budgetMax) && (
              <div className="mt-8 p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                <div className="text-sm text-gray-400 mb-1">Budget Range</div>
                <div className="text-2xl font-bold text-white">
                  ${listing.budgetMin || 0} - ${listing.budgetMax || '∞'}
                </div>
              </div>
            )}

            {/* Availability */}
            {listing.isAvailable !== undefined && (
              <div className="mt-4 flex items-center gap-2">
                <span
                  className={clsx(
                    'w-2 h-2 rounded-full',
                    listing.isAvailable ? 'bg-green-500' : 'bg-red-500'
                  )}
                />
                <span className="text-sm text-gray-400">
                  {listing.isAvailable ? 'Currently available' : 'Not available'}
                </span>
              </div>
            )}

            {/* External link */}
            {listing.externalUrl && (
              <a
                href={listing.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
              >
                Learn More
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
