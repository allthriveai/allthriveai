/**
 * FeaturedProjectsSection - Curated selection of projects in a featured grid
 *
 * Uses a hero-style layout with the first project larger and remaining
 * projects in a responsive grid with detailed cards.
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusIcon, XMarkIcon, CheckIcon, ArrowTopRightOnSquareIcon, EyeIcon, TrophyIcon, StarIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import type { FeaturedProjectsSectionContent } from '@/types/profileSections';
import type { ProfileUser } from './ProfileSectionRenderer';
import type { Project } from '@/types/models';
import { api } from '@/services/api';

// Check if a project is a battle project
function isBattleProject(project: Project): boolean {
  return project.type === 'battle' && !!project.content?.battleResult;
}

interface FeaturedProjectsSectionProps {
  content: FeaturedProjectsSectionContent;
  user: ProfileUser;
  isEditing?: boolean;
  onUpdate?: (content: FeaturedProjectsSectionContent) => void;
}

// Featured Project Card - detailed card for the grid
function FeaturedProjectCard({
  project,
  user,
  isHero = false,
  isEditing,
  onRemove,
  onMakeHero,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  position,
}: {
  project: Project;
  user: ProfileUser;
  isHero?: boolean;
  isEditing?: boolean;
  onRemove?: () => void;
  onMakeHero?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  position?: number;
}) {
  const imageUrl = project.featuredImageUrl || project.bannerUrl;
  const projectUrl = `/${user.username}/${project.slug}`;
  const hasExternalUrl = project.externalUrl;

  return (
    <div className={`group relative rounded-xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-all duration-300 ${isHero ? 'md:col-span-2 md:row-span-2' : ''}`}>
      {/* Edit controls when editing */}
      {isEditing && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Position indicator and reorder buttons */}
          <div className="flex items-center gap-0.5 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1">
            {/* Move up button */}
            {canMoveUp && onMoveUp && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onMoveUp();
                }}
                className="p-1.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Move up"
              >
                <ArrowUpIcon className="w-4 h-4" />
              </button>
            )}
            {/* Position number */}
            {position !== undefined && (
              <span className="px-2 py-1 text-xs font-bold text-gray-500 dark:text-gray-400 min-w-[24px] text-center">
                {position}
              </span>
            )}
            {/* Move down button */}
            {canMoveDown && onMoveDown && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onMoveDown();
                }}
                className="p-1.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Move down"
              >
                <ArrowDownIcon className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Make Hero button (only for non-hero cards) */}
          {!isHero && onMakeHero && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMakeHero();
              }}
              className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/70 transition-colors shadow-lg"
              title="Make featured (large)"
            >
              <StarIcon className="w-4 h-4" />
            </button>
          )}

          {/* Hero indicator (for hero card) */}
          {isHero && (
            <div className="p-2 rounded-full bg-amber-500 text-white shadow-lg" title="Featured project">
              <StarIconSolid className="w-4 h-4" />
            </div>
          )}

          {/* Remove button */}
          {onRemove && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemove();
              }}
              className="p-2 rounded-full bg-red-100 dark:bg-red-900/50 text-red-500 hover:bg-red-200 dark:hover:bg-red-900/70 transition-colors shadow-lg"
              title="Remove"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      <Link to={projectUrl} className="block">
        {/* Image */}
        <div className={`relative overflow-hidden ${isHero ? 'aspect-[16/9]' : 'aspect-[16/10]'}`}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={project.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary-500/20 via-cyan-500/20 to-secondary-500/20 flex items-center justify-center">
              <span className={`font-bold text-gray-300 dark:text-gray-600 ${isHero ? 'text-6xl' : 'text-4xl'}`}>
                {project.title.charAt(0)}
              </span>
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          {/* Type badge */}
          {project.type && (
            <span className="absolute top-3 left-3 px-2.5 py-1 text-xs font-medium bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-300 rounded-full backdrop-blur-sm">
              {project.type}
            </span>
          )}

          {/* External link indicator - hide for github_repo since they link to internal pages */}
          {hasExternalUrl && project.type !== 'github_repo' && (
            <span className="absolute top-3 right-3 p-1.5 bg-white/90 dark:bg-gray-900/90 rounded-full backdrop-blur-sm">
              <ArrowTopRightOnSquareIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </span>
          )}

          {/* Stats overlay */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3">
            {project.viewCount !== undefined && project.viewCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-white/90">
                <EyeIcon className="w-4 h-4" />
                {project.viewCount.toLocaleString()}
              </span>
            )}
            {project.likesCount !== undefined && project.likesCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-white/90">
                <HeartIconSolid className="w-4 h-4 text-red-400" />
                {project.likesCount.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className={`p-4 ${isHero ? 'md:p-6' : ''}`}>
          {/* Title */}
          <h3 className={`font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors ${isHero ? 'text-xl md:text-2xl' : 'text-base'} ${isHero ? 'line-clamp-2' : 'line-clamp-1'}`}>
            {project.title}
          </h3>

          {/* Description */}
          {project.description && (
            <p className={`mt-2 text-gray-600 dark:text-gray-400 ${isHero ? 'text-base line-clamp-3' : 'text-sm line-clamp-2'}`}>
              {project.description}
            </p>
          )}

          {/* Tools/Topics */}
          {((project.tools && project.tools.length > 0) || (project.topics && project.topics.length > 0)) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {project.tools?.slice(0, isHero ? 5 : 3).map((tool: any, idx: number) => (
                <span
                  key={typeof tool === 'string' ? tool : (tool.slug || tool.name || `tool-${idx}`)}
                  className="px-2 py-0.5 text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded"
                >
                  {typeof tool === 'string' ? tool : tool.name}
                </span>
              ))}
              {project.topics?.slice(0, isHero ? 3 : 2).map((topic: string) => (
                <span
                  key={topic}
                  className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}

// Featured Battle Card - Special card for battle projects with VS layout
function FeaturedBattleCard({
  project,
  user,
  isHero = false,
  isEditing,
  onRemove,
  onMakeHero,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  position,
}: {
  project: Project;
  user: ProfileUser;
  isHero?: boolean;
  isEditing?: boolean;
  onRemove?: () => void;
  onMakeHero?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  position?: number;
}) {
  const navigate = useNavigate();
  const projectUrl = `/${user.username}/${project.slug}`;
  const battleResult = project.content?.battleResult;

  if (!battleResult) return null;

  const { mySubmission, opponentSubmission, opponent, won, isTie, challengeText } = battleResult;

  return (
    <div className={`group relative rounded-xl overflow-hidden bg-slate-900 border border-gray-700 shadow-sm hover:shadow-lg transition-all duration-300 ${isHero ? 'md:col-span-2 md:row-span-2' : ''}`}>
      {/* Edit controls when editing */}
      {isEditing && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Position indicator and reorder buttons */}
          <div className="flex items-center gap-0.5 bg-slate-800/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-600 p-1">
            {/* Move up button */}
            {canMoveUp && onMoveUp && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onMoveUp();
                }}
                className="p-1.5 rounded text-gray-400 hover:bg-slate-700 transition-colors"
                title="Move up"
              >
                <ArrowUpIcon className="w-4 h-4" />
              </button>
            )}
            {/* Position number */}
            {position !== undefined && (
              <span className="px-2 py-1 text-xs font-bold text-gray-400 min-w-[24px] text-center">
                {position}
              </span>
            )}
            {/* Move down button */}
            {canMoveDown && onMoveDown && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onMoveDown();
                }}
                className="p-1.5 rounded text-gray-400 hover:bg-slate-700 transition-colors"
                title="Move down"
              >
                <ArrowDownIcon className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Make Hero button (only for non-hero cards) */}
          {!isHero && onMakeHero && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMakeHero();
              }}
              className="p-2 rounded-full bg-amber-900/50 text-amber-400 hover:bg-amber-900/70 transition-colors shadow-lg"
              title="Make featured (large)"
            >
              <StarIcon className="w-4 h-4" />
            </button>
          )}

          {/* Hero indicator (for hero card) */}
          {isHero && (
            <div className="p-2 rounded-full bg-amber-500 text-white shadow-lg" title="Featured project">
              <StarIconSolid className="w-4 h-4" />
            </div>
          )}

          {/* Remove button */}
          {onRemove && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemove();
              }}
              className="p-2 rounded-full bg-red-900/50 text-red-500 hover:bg-red-900/70 transition-colors shadow-lg"
              title="Remove"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      <Link to={projectUrl} className="block">
        {/* Battle Images - VS Layout */}
        <div className={`relative ${isHero ? 'aspect-[16/9]' : 'aspect-[4/3]'}`}>
          <div className="absolute inset-0 flex">
            {/* My submission - left side */}
            <div className="flex-1 relative overflow-hidden">
              {mySubmission?.imageUrl ? (
                <img
                  src={mySubmission.imageUrl}
                  alt="Your submission"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                  <span className="text-slate-600 text-sm">No image</span>
                </div>
              )}
              {/* Winner badge on my image */}
              {won && (
                <div className="absolute top-2 left-2 p-1.5 rounded-full bg-amber-500 shadow-lg">
                  <TrophyIcon className="w-4 h-4 text-white" />
                </div>
              )}
              {/* "YOU" label */}
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/80 text-white">
                YOU
              </div>
            </div>

            {/* Divider */}
            <div className="w-1 bg-slate-900" />

            {/* Opponent submission - right side */}
            <div className="flex-1 relative overflow-hidden">
              {opponentSubmission?.imageUrl ? (
                <img
                  src={opponentSubmission.imageUrl}
                  alt="Opponent submission"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                  <span className="text-slate-600 text-sm">No image</span>
                </div>
              )}
              {/* Winner badge on opponent image */}
              {!won && !isTie && (
                <div className="absolute top-2 right-2 p-1.5 rounded-full bg-amber-500 shadow-lg">
                  <TrophyIcon className="w-4 h-4 text-white" />
                </div>
              )}
              {/* Opponent label */}
              <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold bg-violet-500/80 text-white">
                {opponent?.isAi ? 'PIP' : opponent?.username?.toUpperCase() || 'OPPONENT'}
              </div>
            </div>
          </div>

          {/* VS Badge in center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <div className={`${isHero ? 'w-14 h-14' : 'w-10 h-10'} rounded-full bg-slate-800 border-2 border-cyan-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.4)]`}>
              <span className={`${isHero ? 'text-sm' : 'text-xs'} font-black bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent`}>
                VS
              </span>
            </div>
          </div>

          {/* Result banner at top */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
            <div className={`px-3 py-1 rounded-full text-xs font-bold shadow-lg ${
              isTie
                ? 'bg-slate-700 text-slate-300'
                : won
                ? 'bg-amber-500/90 text-white'
                : 'bg-slate-700/90 text-slate-300'
            }`}>
              {isTie ? 'TIE' : won ? 'VICTORY' : 'DEFEAT'}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className={`p-4 ${isHero ? 'md:p-6' : ''}`}>
          {/* Title */}
          <h3 className={`font-semibold text-white group-hover:text-cyan-400 transition-colors ${isHero ? 'text-xl md:text-2xl' : 'text-base'} ${isHero ? 'line-clamp-2' : 'line-clamp-1'}`}>
            {project.title}
          </h3>

          {/* Challenge text */}
          {challengeText && (
            <p className={`mt-2 text-gray-400 ${isHero ? 'text-base line-clamp-2' : 'text-sm line-clamp-1'}`}>
              {challengeText}
            </p>
          )}

          {/* Battle type badge */}
          <div className="mt-3 flex items-center gap-2">
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate('/play/prompt-battles');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate('/play/prompt-battles');
                }
              }}
              className="px-2 py-0.5 text-xs bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-cyan-400 rounded border border-cyan-500/30 hover:from-cyan-500/30 hover:to-violet-500/30 hover:text-cyan-300 transition-colors cursor-pointer"
            >
              All Thrive Prompt Battle
            </span>
            {opponent && (
              <span className="text-xs text-gray-500">
                vs {opponent.isAi ? 'Pip' : opponent.username}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

export function FeaturedProjectsSection({
  content,
  user,
  isEditing,
  onUpdate,
}: FeaturedProjectsSectionProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [allUserProjects, setAllUserProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);

  const projectIds = content?.projectIds || [];
  const maxProjects = content?.maxProjects || 6;

  // Fetch all user projects for the picker
  const fetchAllProjects = async () => {
    if (allUserProjects.length > 0) return; // Already fetched
    setPickerLoading(true);
    try {
      const response = await api.get(`/users/${user.username}/projects/`);
      const data = response.data;
      // Handle both showcase/playground structure and flat array
      let projectList: Project[] = [];
      if (data.showcase || data.playground) {
        // Combine and deduplicate by ID (projects can be in both showcase and playground)
        const combined = [...(data.showcase || []), ...(data.playground || [])];
        const seen = new Set<number>();
        projectList = combined.filter((p: Project) => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });
      } else if (Array.isArray(data.results)) {
        projectList = data.results;
      } else if (Array.isArray(data)) {
        projectList = data;
      }
      setAllUserProjects(projectList);
    } catch (error) {
      console.error('Failed to fetch all projects:', error);
    } finally {
      setPickerLoading(false);
    }
  };

  // Fetch project details for featured IDs
  useEffect(() => {
    const fetchProjects = async () => {
      if (projectIds.length === 0) {
        setProjects([]);
        setLoading(false);
        return;
      }

      try {
        // Fetch user's projects and filter by featured IDs
        const response = await api.get(`/users/${user.username}/projects/`);
        const data = response.data;
        // Handle both showcase/playground structure and flat array
        let allProjects: Project[] = [];
        if (data.showcase || data.playground) {
          // Combine and deduplicate by ID (projects can be in both showcase and playground)
          const combined = [...(data.showcase || []), ...(data.playground || [])];
          const seen = new Set<number>();
          allProjects = combined.filter((p: Project) => {
            if (seen.has(p.id)) return false;
            seen.add(p.id);
            return true;
          });
        } else if (Array.isArray(data.results)) {
          allProjects = data.results;
        } else if (Array.isArray(data)) {
          allProjects = data;
        }
        const featured = projectIds
          .map((id: number) => allProjects.find((p: Project) => p.id === id))
          .filter(Boolean) as Project[];
        setProjects(featured);
        setAllUserProjects(allProjects); // Cache for picker
      } catch (error) {
        console.error('Failed to fetch featured projects:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [projectIds, user.username]);

  const handleRemoveProject = (projectId: number) => {
    if (onUpdate) {
      const newIds = projectIds.filter((id: number) => id !== projectId);
      onUpdate({ ...content, projectIds: newIds });
    }
  };

  const handleToggleProject = (projectId: number) => {
    if (!onUpdate) return;

    if (projectIds.includes(projectId)) {
      // Remove project
      const newIds = projectIds.filter((id: number) => id !== projectId);
      onUpdate({ ...content, projectIds: newIds });
    } else if (projectIds.length < maxProjects) {
      // Add project
      onUpdate({ ...content, projectIds: [...projectIds, projectId] });
    }
  };

  const handleOpenPicker = () => {
    fetchAllProjects();
    setShowPicker(true);
  };

  // Move project to hero position (first)
  const handleMakeHero = (projectId: number) => {
    if (!onUpdate) return;
    const currentIndex = projectIds.indexOf(projectId);
    if (currentIndex <= 0) return; // Already hero or not found

    const newIds = [...projectIds];
    // Remove from current position
    newIds.splice(currentIndex, 1);
    // Add to front
    newIds.unshift(projectId);
    onUpdate({ ...content, projectIds: newIds });
  };

  // Move project up (towards hero position)
  const handleMoveUp = (projectId: number) => {
    if (!onUpdate) return;
    const currentIndex = projectIds.indexOf(projectId);
    if (currentIndex <= 0) return; // Already first or not found

    const newIds = [...projectIds];
    // Swap with previous
    [newIds[currentIndex - 1], newIds[currentIndex]] = [newIds[currentIndex], newIds[currentIndex - 1]];
    onUpdate({ ...content, projectIds: newIds });
  };

  // Move project down (away from hero position)
  const handleMoveDown = (projectId: number) => {
    if (!onUpdate) return;
    const currentIndex = projectIds.indexOf(projectId);
    if (currentIndex < 0 || currentIndex >= projectIds.length - 1) return; // Last or not found

    const newIds = [...projectIds];
    // Swap with next
    [newIds[currentIndex], newIds[currentIndex + 1]] = [newIds[currentIndex + 1], newIds[currentIndex]];
    onUpdate({ ...content, projectIds: newIds });
  };

  // Empty state when not editing
  if (projects.length === 0 && !isEditing) {
    return null;
  }

  // Split projects into hero (first) and rest
  const heroProject = projects[0];
  const restProjects = projects.slice(1);

  return (
    <div className="py-6 w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Featured Projects
        </h2>
        {isEditing && projectIds.length < maxProjects && (
          <button
            onClick={handleOpenPicker}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Add Project
          </button>
        )}
      </div>

      {loading ? (
        // Loading skeleton
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className={`animate-pulse rounded-xl overflow-hidden ${i === 1 ? 'md:col-span-2 md:row-span-2' : ''}`}>
              <div className={`bg-gray-200 dark:bg-gray-700 ${i === 1 ? 'aspect-[16/9]' : 'aspect-[16/10]'}`} />
              <div className="p-4 bg-gray-100 dark:bg-gray-800">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-1" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No featured projects yet
          </p>
          {isEditing && (
            <button
              onClick={handleOpenPicker}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Select Projects
            </button>
          )}
        </div>
      ) : (
        // Featured grid layout
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Hero project (first one, larger) */}
          {heroProject && (
            isBattleProject(heroProject) ? (
              <FeaturedBattleCard
                project={heroProject}
                user={user}
                isHero={projects.length > 1}
                isEditing={isEditing}
                onRemove={() => handleRemoveProject(heroProject.id)}
                position={1}
                canMoveUp={false}
                canMoveDown={projects.length > 1}
                onMoveDown={() => handleMoveDown(heroProject.id)}
              />
            ) : (
              <FeaturedProjectCard
                project={heroProject}
                user={user}
                isHero={projects.length > 1}
                isEditing={isEditing}
                onRemove={() => handleRemoveProject(heroProject.id)}
                position={1}
                canMoveUp={false}
                canMoveDown={projects.length > 1}
                onMoveDown={() => handleMoveDown(heroProject.id)}
              />
            )
          )}

          {/* Remaining projects */}
          {restProjects.map((project, index) => {
            const position = index + 2; // +2 because hero is position 1
            const canMoveUp = true; // Can always move up (towards hero)
            const canMoveDown = index < restProjects.length - 1;

            return isBattleProject(project) ? (
              <FeaturedBattleCard
                key={project.id}
                project={project}
                user={user}
                isEditing={isEditing}
                onRemove={() => handleRemoveProject(project.id)}
                position={position}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                onMakeHero={() => handleMakeHero(project.id)}
                onMoveUp={() => handleMoveUp(project.id)}
                onMoveDown={() => handleMoveDown(project.id)}
              />
            ) : (
              <FeaturedProjectCard
                key={project.id}
                project={project}
                user={user}
                isEditing={isEditing}
                onRemove={() => handleRemoveProject(project.id)}
                position={position}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                onMakeHero={() => handleMakeHero(project.id)}
                onMoveUp={() => handleMoveUp(project.id)}
                onMoveDown={() => handleMoveDown(project.id)}
              />
            );
          })}
        </div>
      )}

      {/* Project Picker Modal */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Select Projects
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {projectIds.length} of {maxProjects} selected
                </p>
              </div>
              <button
                onClick={() => setShowPicker(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Project Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {pickerLoading ? (
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="animate-pulse">
                      <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg mb-2" />
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                    </div>
                  ))}
                </div>
              ) : allUserProjects.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">
                    No projects found. Create some projects first!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {allUserProjects.map(project => {
                    const isSelected = projectIds.includes(project.id);
                    const isDisabled = !isSelected && projectIds.length >= maxProjects;
                    const imageUrl = project.featuredImageUrl || project.bannerUrl;

                    return (
                      <button
                        key={project.id}
                        onClick={() => handleToggleProject(project.id)}
                        disabled={isDisabled}
                        className={`relative text-left rounded-lg overflow-hidden border-2 transition-all ${
                          isSelected
                            ? 'border-primary-500 ring-2 ring-primary-500/20'
                            : isDisabled
                            ? 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        {/* Thumbnail */}
                        {imageUrl ? (
                          <div className="h-24 overflow-hidden">
                            <img
                              src={imageUrl}
                              alt={project.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="h-24 bg-gradient-to-br from-primary-500/20 to-secondary-500/20 flex items-center justify-center">
                            <span className="text-2xl font-bold text-gray-300 dark:text-gray-600">
                              {project.title.charAt(0)}
                            </span>
                          </div>
                        )}

                        {/* Info */}
                        <div className="p-3">
                          <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate">
                            {project.title}
                          </h4>
                          {project.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                              {project.description}
                            </p>
                          )}
                        </div>

                        {/* Selected Indicator */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center">
                            <CheckIcon className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowPicker(false)}
                className="w-full px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
