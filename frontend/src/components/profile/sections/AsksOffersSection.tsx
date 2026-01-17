/**
 * AsksOffersSection - Profile section displaying user's asks and offers
 *
 * Shows the user's active asks (things they're looking for) and offers
 * (things they're providing). Supports inline editing for profile owners.
 *
 * Follows Neon Glass design system:
 * - Dark glassmorphism backgrounds
 * - Cyan/magenta accent colors for offers/asks
 * - Subtle neon glow effects on hover
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { getUserAsks, getUserOffers } from '@/services/listings';
import { ListingCard } from '@/components/listings/ListingCard';
import type { ListingCard as ListingCardType } from '@/types/listings';
import type { ProfileUser } from './ProfileSectionRenderer';
import clsx from 'clsx';

// ============================================================================
// Types
// ============================================================================

export interface AsksOffersSectionContent {
  showAsks?: boolean;
  showOffers?: boolean;
  maxItems?: number;
  layout?: 'grid' | 'list';
  title?: string;
}

interface AsksOffersSectionProps {
  content: AsksOffersSectionContent;
  user: ProfileUser;
  isEditing?: boolean;
  isOwnProfile?: boolean;
  _onUpdate?: (content: AsksOffersSectionContent) => void;
}

// ============================================================================
// Component
// ============================================================================

export function AsksOffersSection({
  content,
  user,
  isEditing,
  isOwnProfile,
}: AsksOffersSectionProps) {
  const navigate = useNavigate();
  const [asks, setAsks] = useState<ListingCardType[]>([]);
  const [offers, setOffers] = useState<ListingCardType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'asks' | 'offers'>('asks');

  const showAsks = content?.showAsks !== false;
  const showOffers = content?.showOffers !== false;
  const maxItems = content?.maxItems || 6;
  const title = content?.title || 'Asks & Offers';

  // Load asks and offers
  useEffect(() => {
    async function loadListings() {
      if (!user.username) return;

      setIsLoading(true);
      try {
        const [asksData, offersData] = await Promise.all([
          showAsks ? getUserAsks(user.username) : Promise.resolve([]),
          showOffers ? getUserOffers(user.username) : Promise.resolve([]),
        ]);

        setAsks(asksData.slice(0, maxItems));
        setOffers(offersData.slice(0, maxItems));

        // Auto-select tab based on what's available
        if (asksData.length === 0 && offersData.length > 0) {
          setActiveTab('offers');
        }
      } catch (err) {
        console.error('Failed to load listings:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadListings();
  }, [user.username, showAsks, showOffers, maxItems]);

  // Handle edit click
  const handleEditListing = (listingSlug: string) => {
    navigate(`/listings/${listingSlug}/edit`);
  };

  // Handle create new
  const handleCreateNew = (intent: 'ask' | 'offer') => {
    navigate(`/listings/new?intent=${intent}`);
  };

  // Empty state when nothing to show and not owner
  const hasContent = asks.length > 0 || offers.length > 0;
  if (!hasContent && !isOwnProfile && !isEditing) {
    return null;
  }

  const currentItems = activeTab === 'asks' ? asks : offers;

  return (
    <div className="py-6 w-full group/section">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">{title}</h2>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-gray-800/50 border border-white/5">
          {showAsks && (
            <button
              onClick={() => setActiveTab('asks')}
              className={clsx(
                'px-3 py-1.5 text-sm font-medium rounded transition-all',
                activeTab === 'asks'
                  ? 'bg-magenta-500/20 text-magenta-400 shadow-[0_0_10px_rgba(217,70,239,0.2)]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              )}
            >
              Asks {asks.length > 0 && `(${asks.length})`}
            </button>
          )}
          {showOffers && (
            <button
              onClick={() => setActiveTab('offers')}
              className={clsx(
                'px-3 py-1.5 text-sm font-medium rounded transition-all',
                activeTab === 'offers'
                  ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              )}
            >
              Offers {offers.length > 0 && `(${offers.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <svg className="w-6 h-6 animate-spin text-cyan-500" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      )}

      {/* Content */}
      {!isLoading && (
        <>
          {/* Listing grid */}
          {currentItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentItems.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing as any}
                  isEditable={isOwnProfile}
                  onEdit={() => handleEditListing(listing.slug)}
                  compact
                />
              ))}
            </div>
          ) : (
            /* Empty state */
            <div
              className={clsx(
                'rounded-lg p-8 text-center',
                'bg-gray-800/30 border border-dashed',
                activeTab === 'asks'
                  ? 'border-magenta-500/30'
                  : 'border-cyan-500/30'
              )}
            >
              <p className="text-gray-400 mb-4">
                {activeTab === 'asks'
                  ? isOwnProfile
                    ? "You haven't posted any asks yet."
                    : "No asks to show."
                  : isOwnProfile
                  ? "You haven't posted any offers yet."
                  : "No offers to show."}
              </p>
              {isOwnProfile && (
                <button
                  onClick={() => handleCreateNew(activeTab === 'asks' ? 'ask' : 'offer')}
                  className={clsx(
                    'inline-flex items-center gap-2 px-4 py-2 rounded font-medium text-sm transition-all',
                    activeTab === 'asks'
                      ? 'bg-magenta-500/20 text-magenta-400 hover:bg-magenta-500/30 border border-magenta-500/30'
                      : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30'
                  )}
                >
                  <PlusIcon className="w-4 h-4" />
                  Create {activeTab === 'asks' ? 'an Ask' : 'an Offer'}
                </button>
              )}
            </div>
          )}

          {/* View All link */}
          {currentItems.length > 0 && (
            <div className="mt-4 flex justify-end">
              <Link
                to={`/@${user.username}?tab=listings&filter=${activeTab}`}
                className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-cyan-400 transition-colors"
              >
                View all {activeTab}
                <ChevronRightIcon className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* Add new button for owners (always visible in edit mode) */}
          {(isOwnProfile || isEditing) && currentItems.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <button
                onClick={() => handleCreateNew(activeTab === 'asks' ? 'ask' : 'offer')}
                className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-cyan-400 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Add new {activeTab === 'asks' ? 'ask' : 'offer'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AsksOffersSection;
