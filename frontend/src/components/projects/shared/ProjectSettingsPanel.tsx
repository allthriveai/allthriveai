/**
 * ProjectSettingsPanel - Consolidated right-side settings tray for project editing
 *
 * Consolidates:
 * - Hero Display editing
 * - Background/gradient settings
 * - Metadata (content type, difficulty, time investment, pricing)
 * - URL Redirects
 * - Delete project
 */

import { useState, useEffect, useCallback } from 'react';
import {
  XMarkIcon,
  SwatchIcon,
  PhotoIcon,
  TagIcon,
  LinkIcon,
  TrashIcon,
  ChevronRightIcon,
  SparklesIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline';
import { updateProject, deleteProjectRedirect } from '@/services/projects';
import { getTaxonomiesByType } from '@/services/personalization';
import type { Project, Taxonomy } from '@/types/models';

interface ProjectSettingsPanelProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onProjectUpdate: (project: Project) => void;
  onOpenHeroEditor: () => void;
  onDelete: () => void;
}

// Sections in the panel
type SettingsSection = 'main' | 'background' | 'metadata' | 'redirects';

export function ProjectSettingsPanel({
  project,
  isOpen,
  onClose,
  onProjectUpdate,
  onOpenHeroEditor,
  onDelete,
}: ProjectSettingsPanelProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('main');
  const [isSaving, setIsSaving] = useState(false);

  // Metadata taxonomy options
  const [contentTypes, setContentTypes] = useState<Taxonomy[]>([]);
  const [difficulties, setDifficulties] = useState<Taxonomy[]>([]);
  const [timeInvestments, setTimeInvestments] = useState<Taxonomy[]>([]);
  const [pricingOptions, setPricingOptions] = useState<Taxonomy[]>([]);
  const [taxonomiesLoading, setTaxonomiesLoading] = useState(false);

  // Background gradient state
  const [gradientFrom, setGradientFrom] = useState(project.content?.heroGradientFrom || '');
  const [gradientTo, setGradientTo] = useState(project.content?.heroGradientTo || '');

  // Reset to main when panel closes
  useEffect(() => {
    if (!isOpen) {
      setActiveSection('main');
    }
  }, [isOpen]);

  // Sync gradient state when project changes
  useEffect(() => {
    setGradientFrom(project.content?.heroGradientFrom || '');
    setGradientTo(project.content?.heroGradientTo || '');
  }, [project.content?.heroGradientFrom, project.content?.heroGradientTo]);

  // Load taxonomies when metadata section opens
  useEffect(() => {
    if (activeSection === 'metadata' && contentTypes.length === 0 && !taxonomiesLoading) {
      setTaxonomiesLoading(true);
      Promise.all([
        getTaxonomiesByType('content_type'),
        getTaxonomiesByType('difficulty'),
        getTaxonomiesByType('time_investment'),
        getTaxonomiesByType('pricing'),
      ])
        .then(([ct, diff, time, price]) => {
          setContentTypes(ct);
          setDifficulties(diff);
          setTimeInvestments(time);
          setPricingOptions(price);
        })
        .catch(console.error)
        .finally(() => setTaxonomiesLoading(false));
    }
  }, [activeSection, contentTypes.length, taxonomiesLoading]);

  // Handle gradient change
  const handleGradientChange = useCallback(async (fromColor: string, toColor: string) => {
    try {
      setIsSaving(true);
      setGradientFrom(fromColor);
      setGradientTo(toColor);
      const updatedContent = {
        ...project.content,
        heroGradientFrom: fromColor || undefined,
        heroGradientTo: toColor || undefined,
      };
      const updated = await updateProject(project.id, { content: updatedContent });
      onProjectUpdate(updated);
    } catch (error) {
      console.error('Failed to update background gradient:', error);
    } finally {
      setIsSaving(false);
    }
  }, [project.id, project.content, onProjectUpdate]);

  // Handle metadata change
  const handleMetadataChange = useCallback(async (field: string, value: number | boolean | null) => {
    try {
      setIsSaving(true);
      const updated = await updateProject(project.id, { [field]: value });
      onProjectUpdate(updated);
    } catch (error) {
      console.error(`Failed to update ${field}:`, error);
    } finally {
      setIsSaving(false);
    }
  }, [project.id, onProjectUpdate]);

  // Handle redirect deletion
  const handleDeleteRedirect = useCallback(async (redirectId: number) => {
    if (!confirm('Delete this redirect? The old URL will no longer work.')) return;
    try {
      await deleteProjectRedirect(project.id, redirectId);
      // Refresh project to get updated redirects
      const updated = await updateProject(project.id, {});
      onProjectUpdate(updated);
    } catch (error) {
      console.error('Failed to delete redirect:', error);
    }
  }, [project.id, onProjectUpdate]);

  // Gradient presets
  const gradientPresets = [
    { from: '#7c3aed', to: '#4f46e5', name: 'Violet' },
    { from: '#0ea5e9', to: '#6366f1', name: 'Sky' },
    { from: '#10b981', to: '#06b6d4', name: 'Emerald' },
    { from: '#f59e0b', to: '#ef4444', name: 'Sunset' },
    { from: '#ec4899', to: '#8b5cf6', name: 'Pink' },
    { from: '#0a0a12', to: '#1e1b4b', name: 'Dark' },
    { from: '#1e3a5f', to: '#0f172a', name: 'Navy' },
    { from: '#064e3b', to: '#0f172a', name: 'Forest' },
    { from: '#4c1d95', to: '#0f172a', name: 'Plum' },
    { from: '#7f1d1d', to: '#0f172a', name: 'Wine' },
  ];

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-80 bg-gray-900/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-50 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            {activeSection !== 'main' && (
              <button
                onClick={() => setActiveSection('main')}
                className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              >
                <ChevronRightIcon className="w-4 h-4 rotate-180" />
              </button>
            )}
            <h2 className="text-lg font-semibold text-white">
              {activeSection === 'main' && 'Project Settings'}
              {activeSection === 'background' && 'Background'}
              {activeSection === 'metadata' && 'Metadata'}
              {activeSection === 'redirects' && 'Redirects'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeSection === 'main' && (
            <div className="p-4 space-y-2">
              {/* Hero Display */}
              <button
                onClick={() => {
                  onClose();
                  onOpenHeroEditor();
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors group"
              >
                <PhotoIcon className="w-5 h-5 text-primary-400" />
                <div className="flex-1 text-left">
                  <p className="font-medium">Hero Display</p>
                  <p className="text-sm text-white/60">Image, video, slideshow, quote</p>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-white/40 group-hover:text-white/60" />
              </button>

              {/* Background */}
              <button
                onClick={() => setActiveSection('background')}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors group"
              >
                <SwatchIcon className="w-5 h-5 text-violet-400" />
                <div className="flex-1 text-left">
                  <p className="font-medium">Background</p>
                  <p className="text-sm text-white/60">Gradient colors</p>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-white/40 group-hover:text-white/60" />
              </button>

              {/* Metadata */}
              <button
                onClick={() => setActiveSection('metadata')}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors group"
              >
                <TagIcon className="w-5 h-5 text-emerald-400" />
                <div className="flex-1 text-left">
                  <p className="font-medium flex items-center gap-2">
                    Metadata
                    {project.contentTypeDetails && (
                      <SparklesIcon className="w-3 h-3 text-amber-400" title="AI tagged" />
                    )}
                  </p>
                  <p className="text-sm text-white/60">Type, difficulty, time</p>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-white/40 group-hover:text-white/60" />
              </button>

              {/* Redirects */}
              <button
                onClick={() => setActiveSection('redirects')}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors group"
              >
                <LinkIcon className="w-5 h-5 text-sky-400" />
                <div className="flex-1 text-left">
                  <p className="font-medium">Redirects</p>
                  <p className="text-sm text-white/60">
                    {project.redirects?.length || 0} active redirect{(project.redirects?.length || 0) !== 1 ? 's' : ''}
                  </p>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-white/40 group-hover:text-white/60" />
              </button>

              {/* Divider */}
              <div className="!my-4 border-t border-white/10" />

              {/* Delete */}
              <button
                onClick={onDelete}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors group"
              >
                <TrashIcon className="w-5 h-5" />
                <div className="flex-1 text-left">
                  <p className="font-medium">Delete Project</p>
                  <p className="text-sm text-red-400/60">This cannot be undone</p>
                </div>
              </button>
            </div>
          )}

          {activeSection === 'background' && (
            <div className="p-4 space-y-4">
              {/* Preview */}
              <div
                className="w-full h-20 rounded-xl border border-white/10"
                style={{
                  background: gradientFrom && gradientTo
                    ? `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)`
                    : 'linear-gradient(135deg, #0a0a12 0%, #1e1b4b 100%)'
                }}
              />

              {/* Presets */}
              <div>
                <label className="block text-sm text-white/60 mb-2">Presets</label>
                <div className="grid grid-cols-5 gap-2">
                  {gradientPresets.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => handleGradientChange(preset.from, preset.to)}
                      disabled={isSaving}
                      className={`h-10 rounded-lg border-2 transition-all hover:scale-105 disabled:opacity-50 ${
                        gradientFrom === preset.from && gradientTo === preset.to
                          ? 'border-white'
                          : 'border-transparent'
                      }`}
                      style={{
                        background: `linear-gradient(135deg, ${preset.from} 0%, ${preset.to} 100%)`
                      }}
                      title={preset.name}
                    />
                  ))}
                </div>
              </div>

              {/* Custom Colors */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">From</label>
                  <input
                    type="color"
                    value={gradientFrom || '#0a0a12'}
                    onChange={(e) => handleGradientChange(e.target.value, gradientTo || '#1e1b4b')}
                    disabled={isSaving}
                    className="w-full h-10 rounded-lg cursor-pointer border border-white/20 bg-transparent disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">To</label>
                  <input
                    type="color"
                    value={gradientTo || '#1e1b4b'}
                    onChange={(e) => handleGradientChange(gradientFrom || '#0a0a12', e.target.value)}
                    disabled={isSaving}
                    className="w-full h-10 rounded-lg cursor-pointer border border-white/20 bg-transparent disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Reset */}
              {(gradientFrom || gradientTo) && (
                <button
                  onClick={() => handleGradientChange('', '')}
                  disabled={isSaving}
                  className="w-full px-4 py-2 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition-colors border border-white/10 disabled:opacity-50"
                >
                  Reset to default
                </button>
              )}
            </div>
          )}

          {activeSection === 'metadata' && (
            <div className="p-4 space-y-4">
              {/* AI Badge */}
              {project.contentTypeDetails && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <SparklesIcon className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-amber-200">
                    AI-generated tags. Override manually below.
                  </span>
                </div>
              )}

              {taxonomiesLoading ? (
                <div className="text-center py-8 text-white/60">Loading options...</div>
              ) : (
                <>
                  {/* Content Type */}
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Content Type</label>
                    <select
                      value={project.contentTypeTaxonomy || ''}
                      onChange={(e) => handleMetadataChange('contentTypeTaxonomy', e.target.value ? parseInt(e.target.value) : null)}
                      disabled={isSaving}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-primary-500 focus:outline-none disabled:opacity-50"
                    >
                      <option value="">Select content type...</option>
                      {contentTypes.map((ct) => (
                        <option key={ct.id} value={ct.id}>{ct.name}</option>
                      ))}
                    </select>
                    {project.contentTypeDetails && (
                      <p className="mt-1 text-xs text-white/40">
                        Current: {project.contentTypeDetails.name}
                      </p>
                    )}
                  </div>

                  {/* Difficulty */}
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Difficulty</label>
                    <select
                      value={project.difficultyTaxonomy || ''}
                      onChange={(e) => handleMetadataChange('difficultyTaxonomy', e.target.value ? parseInt(e.target.value) : null)}
                      disabled={isSaving}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-primary-500 focus:outline-none disabled:opacity-50"
                    >
                      <option value="">Select difficulty...</option>
                      {difficulties.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    {project.difficultyDetails && (
                      <p className="mt-1 text-xs text-white/40">
                        Current: {project.difficultyDetails.name}
                      </p>
                    )}
                  </div>

                  {/* Time Investment */}
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Time Investment</label>
                    <select
                      value={project.timeInvestment || ''}
                      onChange={(e) => handleMetadataChange('timeInvestment', e.target.value ? parseInt(e.target.value) : null)}
                      disabled={isSaving}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-primary-500 focus:outline-none disabled:opacity-50"
                    >
                      <option value="">Select time investment...</option>
                      {timeInvestments.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    {project.timeInvestmentDetails && (
                      <p className="mt-1 text-xs text-white/40">
                        Current: {project.timeInvestmentDetails.name}
                      </p>
                    )}
                  </div>

                  {/* Pricing */}
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Pricing</label>
                    <select
                      value={project.pricingTaxonomy || ''}
                      onChange={(e) => handleMetadataChange('pricingTaxonomy', e.target.value ? parseInt(e.target.value) : null)}
                      disabled={isSaving}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-primary-500 focus:outline-none disabled:opacity-50"
                    >
                      <option value="">Select pricing...</option>
                      {pricingOptions.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    {project.pricingDetails && (
                      <p className="mt-1 text-xs text-white/40">
                        Current: {project.pricingDetails.name}
                      </p>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="!my-4 border-t border-white/10" />

                  {/* Lesson Library Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center gap-3">
                      <AcademicCapIcon className="w-5 h-5 text-emerald-400" />
                      <div>
                        <p className="text-sm font-medium text-white">Lesson Library</p>
                        <p className="text-xs text-white/60">Include in curated educational content</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleMetadataChange('isLesson', !project.isLesson)}
                      disabled={isSaving}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                        project.isLesson ? 'bg-emerald-500' : 'bg-white/20'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          project.isLesson ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {activeSection === 'redirects' && (
            <div className="p-4 space-y-4">
              <p className="text-sm text-white/60">
                Old URLs that redirect to this project. These are created automatically when you change the project URL.
              </p>

              {project.redirects && project.redirects.length > 0 ? (
                <div className="space-y-2">
                  {project.redirects.map((redirect) => (
                    <div
                      key={redirect.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono text-white truncate">
                          /{project.username}/{redirect.oldSlug}
                        </p>
                        <p className="text-xs text-white/40">
                          Created {new Date(redirect.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteRedirect(redirect.id)}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Delete redirect"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-white/40">
                  <LinkIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No redirects yet</p>
                  <p className="text-xs mt-1">Redirects are created when you change the project URL</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Saving indicator */}
        {isSaving && (
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-center gap-2 p-2 rounded-lg bg-primary-500/20 text-primary-300 text-sm">
            <div className="w-4 h-4 border-2 border-primary-300 border-t-transparent rounded-full animate-spin" />
            Saving...
          </div>
        )}
      </div>
    </>
  );
}
