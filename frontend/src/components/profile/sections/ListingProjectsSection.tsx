/**
 * ListingProjectsSection - Profile section displaying user's project-type listings
 *
 * Shows listings where listing_type.parent is 'project' (Apps, Agents, MCP Servers, etc.)
 * Supports inline editing for profile owners.
 *
 * Follows Neon Glass design system:
 * - Dark glassmorphism backgrounds
 * - Cyan accent color
 * - Subtle neon glow effects on hover
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusIcon, ChevronRightIcon, FolderIcon } from '@heroicons/react/24/outline';
import { getListings } from '@/services/listings';
import { ListingCard } from '@/components/listings/ListingCard';
import type { ListingCard as ListingCardType } from '@/types/listings';
import type { ProfileUser } from './ProfileSectionRenderer';
import clsx from 'clsx';

// ============================================================================
// Types
// ============================================================================

export interface ListingProjectsSectionContent {
  maxItems?: number;
  showDescription?: boolean;
  layout?: 'grid' | 'masonry';
  title?: string;
  /** Filter by specific listing type slugs (e.g., ['app', 'agent', 'listing-mcp-server']) */
  listingTypes?: string[];
}

interface ListingProjectsSectionProps {
  content: ListingProjectsSectionContent;
  user: ProfileUser;
  isEditing?: boolean;
  isOwnProfile?: boolean;
  _onUpdate?: (content: ListingProjectsSectionContent) => void;
}

// ============================================================================
// Component
// ============================================================================

export function ListingProjectsSection({
  content,
  user,
  isEditing,
  isOwnProfile,
}: ListingProjectsSectionProps) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ListingCardType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const maxItems = content?.maxItems || 6;
  const title = content?.title || 'Things I Built';
  const layout = content?.layout || 'grid';

  // Load project-type listings
  useEffect(() => {
    async function loadProjects() {
      if (!user.username) return;

      setIsLoading(true);
      try {
        // Fetch listings that are project-type (apps, agents, mcp-servers, etc.)
        // The backend should support filtering by listing type category
        const data = await getListings({
          username: user.username,
          intent: 'offer',
          // listing_type__parent__slug: 'project' - this filter would be ideal
          // For now, we filter client-side or use a specific endpoint
        });

        // Filter to project types (app, agent, listing-mcp-server, side-project)
        const projectTypeSlugs = content?.listingTypes || [
          'app',
          'agent',
          'listing-mcp-server',
          'side-project',
        ];

        const projectListings = data.results.filter((listing) =>
          projectTypeSlugs.includes(listing.listingTypeSlug || '')
        );

        setProjects(projectListings.slice(0, maxItems));
      } catch (err) {
        console.error('Failed to load project listings:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadProjects();
  }, [user.username, maxItems, content?.listingTypes]);

  // Handle edit click
  const handleEditProject = (listingSlug: string) => {
    navigate(`/listings/${listingSlug}/edit`);
  };

  // Handle create new
  const handleCreateNew = () => {
    navigate('/listings/new?intent=offer&type=app');
  };

  // Empty state when nothing to show and not owner
  if (projects.length === 0 && !isOwnProfile && !isEditing && !isLoading) {
    return null;
  }

  return (
    <div className="py-6 w-full group/section">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
            <FolderIcon className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          {projects.length > 0 && (
            <span className="text-sm text-gray-500">({projects.length})</span>
          )}
        </div>

        {isOwnProfile && (
          <button
            onClick={handleCreateNew}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20 transition-all"
          >
            <PlusIcon className="w-4 h-4" />
            Add Project
          </button>
        )}
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
          {projects.length > 0 ? (
            <div
              className={clsx(
                'gap-4',
                layout === 'masonry'
                  ? 'columns-1 md:columns-2 lg:columns-3 space-y-4'
                  : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              )}
            >
              {projects.map((project) => (
                <div key={project.id} className={layout === 'masonry' ? 'break-inside-avoid' : ''}>
                  <ListingCard
                    listing={project as any}
                    isEditable={isOwnProfile}
                    onEdit={() => handleEditProject(project.slug)}
                  />
                </div>
              ))}
            </div>
          ) : (
            /* Empty state for owners */
            <div className="rounded-lg p-8 text-center bg-gray-800/30 border border-dashed border-cyan-500/30">
              <FolderIcon className="w-12 h-12 mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400 mb-4">
                {isOwnProfile
                  ? "You haven't added any projects yet. Share what you've built!"
                  : 'No projects to show.'}
              </p>
              {isOwnProfile && (
                <button
                  onClick={handleCreateNew}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded font-medium text-sm bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30 transition-all"
                >
                  <PlusIcon className="w-4 h-4" />
                  Add Your First Project
                </button>
              )}
            </div>
          )}

          {/* View All link */}
          {projects.length >= maxItems && (
            <div className="mt-4 flex justify-end">
              <Link
                to={`/@${user.username}?tab=listings&filter=projects`}
                className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-cyan-400 transition-colors"
              >
                View all projects
                <ChevronRightIcon className="w-4 h-4" />
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ListingProjectsSection;
