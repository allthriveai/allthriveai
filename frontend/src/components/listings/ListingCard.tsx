/**
 * ListingCard - Display card for listings (asks & offers)
 *
 * Follows the Neon Glass design system:
 * - .glass-card for card container with hover effects
 * - Cyan/green/magenta accent colors
 * - Dark theme with glassmorphism
 *
 * Used in profile sections and listing grids.
 */

import { Link } from 'react-router-dom';
import { PencilIcon, ClockIcon, MapPinIcon, TagIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import type { Listing, ListingIntent } from '@/types/listings';

interface ListingCardProps {
  listing: Listing;
  /** Show edit button for owners */
  isEditable?: boolean;
  /** Callback for edit action */
  onEdit?: () => void;
  /** Compact mode for profile sections */
  compact?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Get intent badge styling
 */
function getIntentBadge(intent: ListingIntent) {
  if (intent === 'ask') {
    return {
      label: 'Ask',
      className: 'bg-magenta-500/20 text-magenta-400 border-magenta-500/30',
    };
  }
  return {
    label: 'Offer',
    className: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  };
}

/**
 * Get status indicator
 */
function getStatusIndicator(status: string) {
  switch (status) {
    case 'open':
      return { icon: CheckCircleIcon, color: 'text-green-400', label: 'Open' };
    case 'in_progress':
      return { icon: ClockIcon, color: 'text-yellow-400', label: 'In Progress' };
    case 'closed':
    case 'completed':
      return { icon: XCircleIcon, color: 'text-gray-400', label: 'Closed' };
    default:
      return { icon: CheckCircleIcon, color: 'text-cyan-400', label: 'Published' };
  }
}

/**
 * Format time ago
 */
function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ListingCard({
  listing,
  isEditable = false,
  onEdit,
  compact = false,
  className,
}: ListingCardProps) {
  const intentBadge = getIntentBadge(listing.intent);
  const statusIndicator = getStatusIndicator(listing.status);
  const StatusIcon = statusIndicator.icon;

  // Build listing URL
  const listingUrl = `/listings/${listing.slug}`;

  return (
    <div
      className={clsx(
        // Glass card base - following styleguide
        'relative group rounded-lg overflow-hidden',
        'bg-gray-900/60 backdrop-blur-md',
        'border border-white/10',
        // Hover effects
        'hover:border-cyan-500/30 hover:bg-gray-900/80',
        'transition-all duration-200',
        // Neon glow on hover
        'hover:shadow-[0_0_20px_rgba(34,211,238,0.1)]',
        className
      )}
    >
      {/* Edit button overlay for owners */}
      {isEditable && onEdit && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEdit();
          }}
          className="absolute top-2 right-2 z-10 p-2 rounded bg-gray-800/80 backdrop-blur-sm text-gray-400 hover:text-cyan-400 hover:bg-gray-800 opacity-0 group-hover:opacity-100 transition-all"
          title="Edit listing"
        >
          <PencilIcon className="w-4 h-4" />
        </button>
      )}

      <Link to={listingUrl} className="block p-4">
        {/* Header: Intent badge + Status */}
        <div className="flex items-center justify-between mb-3">
          <span
            className={clsx(
              'px-2 py-0.5 text-xs font-medium rounded border',
              intentBadge.className
            )}
          >
            {intentBadge.label}
          </span>
          <div className="flex items-center gap-1.5 text-xs">
            <StatusIcon className={clsx('w-3.5 h-3.5', statusIndicator.color)} />
            <span className="text-gray-400">{statusIndicator.label}</span>
          </div>
        </div>

        {/* Title */}
        <h3
          className={clsx(
            'font-semibold text-white mb-2 line-clamp-2',
            'group-hover:text-cyan-400 transition-colors',
            compact ? 'text-sm' : 'text-base'
          )}
        >
          {listing.title}
        </h3>

        {/* Description */}
        {listing.description && !compact && (
          <p className="text-sm text-gray-400 line-clamp-2 mb-3">
            {listing.description}
          </p>
        )}

        {/* Listing type tag */}
        {listing.listingTypeDisplay && (
          <div className="flex items-center gap-1.5 mb-3">
            <TagIcon className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-xs text-gray-500">{listing.listingTypeDisplay}</span>
          </div>
        )}

        {/* Footer: Location + Time */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          {listing.location ? (
            <div className="flex items-center gap-1">
              <MapPinIcon className="w-3.5 h-3.5" />
              <span className="truncate max-w-[120px]">{listing.location}</span>
            </div>
          ) : (
            <span />
          )}
          <span>{formatTimeAgo(listing.createdAt)}</span>
        </div>

        {/* Pricing indicator for offers */}
        {listing.intent === 'offer' && listing.isPaid && listing.price && (
          <div className="mt-3 pt-3 border-t border-white/5">
            <span className="text-sm font-semibold text-green-400">
              ${listing.price.toLocaleString()}
              {listing.pricingType === 'hourly' && '/hr'}
              {listing.pricingType === 'monthly' && '/mo'}
            </span>
          </div>
        )}

        {/* Budget range for asks */}
        {listing.intent === 'ask' && (listing.budgetMin || listing.budgetMax) && (
          <div className="mt-3 pt-3 border-t border-white/5">
            <span className="text-sm text-gray-400">
              Budget:{' '}
              <span className="text-white">
                {listing.budgetMin && listing.budgetMax
                  ? `$${listing.budgetMin.toLocaleString()} - $${listing.budgetMax.toLocaleString()}`
                  : listing.budgetMax
                  ? `Up to $${listing.budgetMax.toLocaleString()}`
                  : `From $${listing.budgetMin?.toLocaleString()}`}
              </span>
            </span>
          </div>
        )}
      </Link>
    </div>
  );
}

export default ListingCard;
