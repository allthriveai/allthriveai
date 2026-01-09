/**
 * Brand Voice Settings Page
 *
 * Allows users to create and manage brand voice profiles for content creation.
 * Brand voices help personalize AI-generated content to match the user's style.
 */

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SettingsLayout } from '@/components/layouts/SettingsLayout';
import {
  getBrandVoices,
  createBrandVoice,
  updateBrandVoice,
  deleteBrandVoice,
  setDefaultBrandVoice,
  BRAND_VOICE_TONES,
} from '@/services/brandVoice';
import type { BrandVoice, BrandVoiceFormData, BrandVoiceTone } from '@/types/models';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  StarIcon,
  CheckIcon,
  XMarkIcon,
  MegaphoneIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

// Editable tag list component
function TagInput({
  label,
  value,
  onChange,
  placeholder,
  maxItems = 10,
}: {
  label: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
  maxItems?: number;
}) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      if (value.length < maxItems && !value.includes(inputValue.trim())) {
        onChange([...value, inputValue.trim()]);
        setInputValue('');
      }
    }
  };

  const removeTag = (indexToRemove: number) => {
    onChange(value.filter((_, i) => i !== indexToRemove));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
        {label}
      </label>
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((tag, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary-500/20 text-primary-600 dark:text-primary-300 text-sm border border-primary-500/30"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="p-0.5 hover:bg-primary-500/30 rounded"
            >
              <XMarkIcon className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      {value.length < maxItems && (
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-white/10 rounded text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 focus:outline-none"
        />
      )}
      <p className="text-xs text-slate-500 mt-1">
        Press Enter to add. {value.length}/{maxItems} items.
      </p>
    </div>
  );
}

// Brand voice form component
function BrandVoiceForm({
  voice,
  onSave,
  onCancel,
  isNew = false,
}: {
  voice?: BrandVoice;
  onSave: (data: BrandVoiceFormData) => Promise<void>;
  onCancel: () => void;
  isNew?: boolean;
}) {
  const [formData, setFormData] = useState<BrandVoiceFormData>({
    name: voice?.name || '',
    targetAudience: voice?.targetAudience || '',
    tone: voice?.tone || 'professional',
    description: voice?.description || '',
    catchphrases: voice?.catchphrases || [],
    topicsToAvoid: voice?.topicsToAvoid || [],
    exampleHooks: voice?.exampleHooks || [],
    keywords: voice?.keywords || [],
    isDefault: voice?.isDefault || false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSave(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Brand Voice Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., LinkedIn Professional, Twitter Casual"
          className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-white/10 rounded text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 focus:outline-none"
          required
        />
      </div>

      {/* Target Audience */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Target Audience
        </label>
        <textarea
          value={formData.targetAudience}
          onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
          placeholder="Who is your content for? e.g., 'Tech professionals learning AI', 'Small business owners looking to automate'"
          rows={2}
          className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-white/10 rounded text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 focus:outline-none resize-none"
        />
      </div>

      {/* Tone */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Communication Tone
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {BRAND_VOICE_TONES.map((tone) => (
            <button
              key={tone.value}
              type="button"
              onClick={() => setFormData({ ...formData, tone: tone.value as BrandVoiceTone })}
              className={`p-3 rounded border text-left transition-all ${
                formData.tone === tone.value
                  ? 'bg-primary-500/20 border-primary-500/50 text-primary-600 dark:text-primary-300'
                  : 'bg-slate-100 dark:bg-slate-800/30 border-slate-300 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-white/20'
              }`}
            >
              <div className="font-medium text-sm mb-0.5">{tone.label}</div>
              <div className="text-xs opacity-70">{tone.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Style Notes
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Any additional notes about your brand voice or style preferences..."
          rows={3}
          className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-white/10 rounded text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 focus:outline-none resize-none"
        />
      </div>

      {/* Catchphrases */}
      <TagInput
        label="Signature Phrases"
        value={formData.catchphrases || []}
        onChange={(tags) => setFormData({ ...formData, catchphrases: tags })}
        placeholder="Add a phrase you like to use..."
        maxItems={10}
      />

      {/* Example Hooks */}
      <TagInput
        label="Example Hooks That Work"
        value={formData.exampleHooks || []}
        onChange={(tags) => setFormData({ ...formData, exampleHooks: tags })}
        placeholder="Add a hook that performed well..."
        maxItems={10}
      />

      {/* Keywords */}
      <TagInput
        label="Key Terms & Jargon"
        value={formData.keywords || []}
        onChange={(tags) => setFormData({ ...formData, keywords: tags })}
        placeholder="Add relevant keywords..."
        maxItems={30}
      />

      {/* Topics to Avoid */}
      <TagInput
        label="Topics to Avoid"
        value={formData.topicsToAvoid || []}
        onChange={(tags) => setFormData({ ...formData, topicsToAvoid: tags })}
        placeholder="Add a topic to avoid..."
        maxItems={20}
      />

      {/* Set as Default */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setFormData({ ...formData, isDefault: !formData.isDefault })}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 ${
            formData.isDefault ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              formData.isDefault ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
        <span className="text-sm text-slate-700 dark:text-slate-300">Set as default brand voice</span>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
        <button
          type="submit"
          disabled={isSaving}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded transition-colors disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckIcon className="w-4 h-4" />
              {isNew ? 'Create Brand Voice' : 'Save Changes'}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-slate-200 dark:bg-slate-700/50 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// Brand voice card component
function BrandVoiceCard({
  voice,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  voice: BrandVoice;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const toneInfo = BRAND_VOICE_TONES.find((t) => t.value === voice.tone);

  return (
    <div className="bg-white dark:bg-white/5 rounded-xl p-5 border border-slate-200 dark:border-white/20 shadow-sm dark:shadow-none">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
              {voice.name}
            </h3>
            {voice.isDefault && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <StarIconSolid className="w-3 h-3" />
                Default
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700/50">
              {toneInfo?.label || voice.tone}
            </span>
            {voice.targetAudience && (
              <span className="truncate">{voice.targetAudience}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!voice.isDefault && (
            <button
              onClick={onSetDefault}
              title="Set as default"
              className="p-2 text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-amber-500/10 rounded transition-colors"
            >
              <StarIcon className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-2 text-slate-400 hover:text-primary-500 dark:hover:text-primary-400 hover:bg-primary-500/10 rounded transition-colors"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preview of content */}
      {(voice.catchphrases.length > 0 || voice.exampleHooks.length > 0) && (
        <div className="space-y-3 text-sm">
          {voice.catchphrases.length > 0 && (
            <div>
              <span className="text-slate-500">Phrases:</span>{' '}
              <span className="text-slate-700 dark:text-slate-300">
                {voice.catchphrases.slice(0, 3).join(', ')}
                {voice.catchphrases.length > 3 && ` +${voice.catchphrases.length - 3} more`}
              </span>
            </div>
          )}
          {voice.exampleHooks.length > 0 && (
            <div>
              <span className="text-slate-500">Sample hook:</span>{' '}
              <span className="text-slate-700 dark:text-slate-300 italic">"{voice.exampleHooks[0]}"</span>
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="mt-4 p-3 rounded bg-red-500/10 border border-red-500/30">
          <p className="text-sm text-red-600 dark:text-red-300 mb-3">
            Delete this brand voice? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded transition-colors disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700/50 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BrandVoiceSettingsPage() {
  const [voices, setVoices] = useState<BrandVoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingVoice, setEditingVoice] = useState<BrandVoice | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch brand voices
  const fetchVoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getBrandVoices();
      setVoices(data);
    } catch (error) {
      console.error('Failed to fetch brand voices:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVoices();
  }, [fetchVoices]);

  // Create new brand voice
  const handleCreate = async (data: BrandVoiceFormData) => {
    await createBrandVoice(data);
    setIsCreating(false);
    await fetchVoices();
  };

  // Update existing brand voice
  const handleUpdate = async (data: BrandVoiceFormData) => {
    if (!editingVoice) return;
    await updateBrandVoice(editingVoice.id, data);
    setEditingVoice(null);
    await fetchVoices();
  };

  // Delete brand voice
  const handleDelete = async (id: number) => {
    await deleteBrandVoice(id);
    await fetchVoices();
  };

  // Set default brand voice
  const handleSetDefault = async (id: number) => {
    await setDefaultBrandVoice(id);
    await fetchVoices();
  };

  return (
    <DashboardLayout>
      <SettingsLayout>
        <div className="p-4 md:p-8">
          {/* Header */}
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Brand Voice
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Create brand voice profiles to personalize your AI-generated content
            </p>
          </div>

          {isLoading ? (
            // Loading state
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white dark:bg-white/5 rounded-xl p-6 border border-slate-200 dark:border-white/20 animate-pulse">
                  <div className="h-6 w-40 bg-slate-200 dark:bg-slate-700 rounded mb-3"></div>
                  <div className="h-4 w-64 bg-slate-200 dark:bg-slate-700 rounded"></div>
                </div>
              ))}
            </div>
          ) : isCreating ? (
            // Create form
            <div className="bg-white dark:bg-white/5 rounded-xl p-6 border border-slate-200 dark:border-white/20 shadow-sm dark:shadow-none">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded bg-primary-500/10">
                  <SparklesIcon className="w-5 h-5 text-primary-500 dark:text-primary-400" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">New Brand Voice</h2>
              </div>
              <BrandVoiceForm
                onSave={handleCreate}
                onCancel={() => setIsCreating(false)}
                isNew
              />
            </div>
          ) : editingVoice ? (
            // Edit form
            <div className="bg-white dark:bg-white/5 rounded-xl p-6 border border-slate-200 dark:border-white/20 shadow-sm dark:shadow-none">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded bg-primary-500/10">
                  <PencilIcon className="w-5 h-5 text-primary-500 dark:text-primary-400" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit {editingVoice.name}</h2>
              </div>
              <BrandVoiceForm
                voice={editingVoice}
                onSave={handleUpdate}
                onCancel={() => setEditingVoice(null)}
              />
            </div>
          ) : voices.length === 0 ? (
            // Empty state
            <div className="bg-white dark:bg-white/5 rounded-xl p-8 border border-slate-200 dark:border-white/20 shadow-sm dark:shadow-none text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-500/10 flex items-center justify-center">
                <MegaphoneIcon className="w-8 h-8 text-primary-500 dark:text-primary-400" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Define Your Brand Voice
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
                Create a brand voice profile so AI-generated content matches your style,
                tone, and target audience. Great for consistent social media content.
              </p>
              <button
                onClick={() => setIsCreating(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded transition-colors"
              >
                <PlusIcon className="w-5 h-5" />
                Create Your First Brand Voice
              </button>
            </div>
          ) : (
            // Brand voice list
            <div className="space-y-4">
              {/* Add new button */}
              <button
                onClick={() => setIsCreating(true)}
                className="w-full p-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-white/20 hover:border-primary-500/50 text-slate-500 dark:text-slate-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors flex items-center justify-center gap-2"
              >
                <PlusIcon className="w-5 h-5" />
                Add Another Brand Voice
              </button>

              {/* Voice cards */}
              {voices.map((voice) => (
                <BrandVoiceCard
                  key={voice.id}
                  voice={voice}
                  onEdit={() => setEditingVoice(voice)}
                  onDelete={() => handleDelete(voice.id)}
                  onSetDefault={() => handleSetDefault(voice.id)}
                />
              ))}

              {/* Info box */}
              <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/30 border border-slate-200 dark:border-white/10">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  <strong className="text-slate-700 dark:text-slate-300">Tip:</strong> Set a default brand voice
                  to automatically use it when creating content. You can also select a specific
                  voice when creating social clips or other content.
                </p>
              </div>
            </div>
          )}
        </div>
      </SettingsLayout>
    </DashboardLayout>
  );
}
