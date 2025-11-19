import { useState, useEffect } from 'react';
import {
  getUserPersonalization,
  bulkCreateTags,
  deleteUserTag,
} from '@/services/personalization';
import type { Taxonomy, UserTag, TaxonomyCategory } from '@/types/models';
import {
  SparklesIcon,
  TagIcon,
  XMarkIcon,
  CheckIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

export function Personalization() {
  const [manualTags, setManualTags] = useState<UserTag[]>([]);
  const [autoTags, setAutoTags] = useState<UserTag[]>([]);
  const [taxonomies, setTaxonomies] = useState<Taxonomy[]>([]);
  const [selectedTaxonomies, setSelectedTaxonomies] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<TaxonomyCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPersonalization();
  }, []);

  async function loadPersonalization() {
    try {
      setIsLoading(true);
      const data = await getUserPersonalization();
      console.log('Personalization data:', data);
      setManualTags(data.manual_tags || []);
      setAutoTags(data.auto_generated_tags || []);
      setTaxonomies(data.available_taxonomies || []);
      
      // Pre-select existing manual tags
      const existingTaxonomyIds = new Set(
        (data.manual_tags || [])
          .filter(tag => tag.taxonomy)
          .map(tag => tag.taxonomy!)
      );
      setSelectedTaxonomies(existingTaxonomyIds);
    } catch (err: any) {
      console.error('Failed to load personalization:', err);
      setError(err?.error || 'Failed to load personalization data');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveTaxonomies() {
    try {
      setIsSaving(true);
      setError(null);
      
      // Find which taxonomies to add (newly selected)
      const existingIds = new Set(
        manualTags.filter(tag => tag.taxonomy).map(tag => tag.taxonomy!)
      );
      const toAdd = Array.from(selectedTaxonomies).filter(id => !existingIds.has(id));
      
      // Find which tags to remove (unselected taxonomies)
      const toRemove = manualTags.filter(
        tag => tag.taxonomy && !selectedTaxonomies.has(tag.taxonomy)
      );
      
      // Add new tags
      if (toAdd.length > 0) {
        const newTags = await bulkCreateTags(toAdd);
        setManualTags(prev => [...prev, ...newTags]);
      }
      
      // Remove unselected tags
      for (const tag of toRemove) {
        await deleteUserTag(tag.id);
        setManualTags(prev => prev.filter(t => t.id !== tag.id));
      }
    } catch (err: any) {
      console.error('Failed to save taxonomies:', err);
      setError(err?.error || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  }

  function toggleTaxonomy(id: number) {
    setSelectedTaxonomies(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleRemoveAutoTag(tagId: number) {
    try {
      await deleteUserTag(tagId);
      setAutoTags(prev => prev.filter(t => t.id !== tagId));
    } catch (err: any) {
      console.error('Failed to remove tag:', err);
      setError(err?.error || 'Failed to remove tag');
    }
  }

  const categories = [
    { id: 'all' as const, label: 'All', icon: TagIcon },
    { id: 'interest' as const, label: 'Interests', icon: SparklesIcon },
    { id: 'skill' as const, label: 'Skills', icon: SparklesIcon },
    { id: 'goal' as const, label: 'Goals', icon: SparklesIcon },
    { id: 'topic' as const, label: 'Topics', icon: SparklesIcon },
    { id: 'industry' as const, label: 'Industries', icon: SparklesIcon },
    { id: 'tool' as const, label: 'Tools', icon: SparklesIcon },
  ];

  // Filter by category and search query
  const filteredTaxonomies = taxonomies
    .filter(t => activeCategory === 'all' || t.category === activeCategory)
    .filter(t => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query)
      );
    });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="glass-subtle rounded-xl p-6">
          <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-1/4 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-300 dark:bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-subtle rounded-xl p-6 border border-gray-200 dark:border-gray-800">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Personalization
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Select your interests and preferences to personalize your experience. 
          We also automatically generate tags based on your activity.
        </p>
      </div>

      {error && (
        <div className="glass-subtle rounded-xl p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Your Selections */}
      <div className="glass-subtle rounded-xl p-6 border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TagIcon className="w-5 h-5" />
            Your Selections
          </h3>
          <button
            onClick={handleSaveTaxonomies}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm font-medium"
          >
            {isSaving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckIcon className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search taxonomies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Clear search"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Found {filteredTaxonomies.length} taxonom{filteredTaxonomies.length === 1 ? 'y' : 'ies'}
            </p>
          )}
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-primary-500 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Taxonomy Selection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredTaxonomies.map((taxonomy) => (
            <button
              key={taxonomy.id}
              onClick={() => toggleTaxonomy(taxonomy.id)}
              className={`text-left p-4 rounded-lg border-2 transition-all ${
                selectedTaxonomies.has(taxonomy.id)
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {taxonomy.name}
                    </h4>
                    {selectedTaxonomies.has(taxonomy.id) && (
                      <CheckIcon className="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {taxonomy.categoryDisplay}
                  </p>
                  {taxonomy.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {taxonomy.description}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {filteredTaxonomies.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery
                ? `No taxonomies found matching "${searchQuery}"`
                : 'No taxonomies available in this category'}
            </p>
          </div>
        )}
      </div>

      {/* Auto-generated Tags */}
      {autoTags.length > 0 && (
        <div className="glass-subtle rounded-xl p-6 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <SparklesIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Auto-generated Tags
            </h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            These tags were automatically generated based on your activity on the site.
          </p>
          
          <div className="flex flex-wrap gap-2">
            {autoTags.map((tag) => (
              <div
                key={tag.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-primary-100 to-secondary-100 dark:from-primary-900/30 dark:to-secondary-900/30 text-gray-900 dark:text-white rounded-full text-sm border border-primary-200 dark:border-primary-800"
              >
                <span>{tag.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({tag.interactionCount})
                </span>
                <button
                  onClick={() => handleRemoveAutoTag(tag.id)}
                  className="hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  aria-label="Remove tag"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Future Content Filtering Placeholder */}
      <div className="glass-subtle rounded-xl p-6 border border-gray-200 dark:border-gray-800 opacity-60">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
          Personalized Content
        </h3>
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">Coming soon</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            We'll use your preferences to show you relevant content as you browse
          </p>
        </div>
      </div>
    </div>
  );
}
