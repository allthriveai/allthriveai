/**
 * ListingEditView - Full inline editing UI for listings
 *
 * Renders all editable fields with inline editing, conditional display based on
 * listing type, and auto-save functionality (via ListingEditor parent).
 */

import React, { useCallback, useState } from 'react';
import {
  InlineEditableTitle,
  InlineEditableText,
  EditModeIndicator,
} from '@/components/projects/shared/InlineEditable';
import type { ListingEditorRenderProps } from './ListingEditor';
import { shouldShowFieldGroup } from '@/types/listings';
import clsx from 'clsx';

interface ListingEditViewProps extends ListingEditorRenderProps {
  /** Toggle edit mode callback */
  onToggleEdit?: () => void;
  /** Whether in edit mode */
  isEditMode?: boolean;
}

/**
 * Section wrapper with conditional rendering
 */
function FieldSection({
  title,
  show,
  children,
  collapsed = false,
}: {
  title: string;
  show: boolean;
  children: React.ReactNode;
  collapsed?: boolean;
}) {
  if (!show) return null;

  return (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-gray-400 mb-3">{title}</h3>
      <div className={clsx('space-y-4', collapsed && 'opacity-60')}>
        {children}
      </div>
    </div>
  );
}

/**
 * Simple inline input for text fields
 */
function InlineInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  isEditable = true,
}: {
  label: string;
  value: string | number | null;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'number' | 'url' | 'date';
  isEditable?: boolean;
}) {
  if (!isEditable) {
    return (
      <div>
        <label className="block text-xs text-gray-500 mb-1">{label}</label>
        <div className="text-gray-300">
          {value || <span className="text-gray-500 italic">Not set</span>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
      />
    </div>
  );
}

/**
 * Simple inline textarea for longer text
 */
function InlineTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  isEditable = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  isEditable?: boolean;
}) {
  if (!isEditable) {
    return (
      <div>
        <label className="block text-xs text-gray-500 mb-1">{label}</label>
        <div className="text-gray-300 whitespace-pre-wrap">
          {value || <span className="text-gray-500 italic">Not set</span>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 resize-none"
      />
    </div>
  );
}

/**
 * Simple select dropdown
 */
function InlineSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  isEditable = true,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  isEditable?: boolean;
}) {
  if (!isEditable) {
    const selected = options.find((o) => o.value === value);
    return (
      <div>
        <label className="block text-xs text-gray-500 mb-1">{label}</label>
        <div className="text-gray-300">{selected?.label || value}</div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Toggle switch
 */
function InlineToggle({
  label,
  value,
  onChange,
  isEditable = true,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  isEditable?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm text-gray-300">{label}</label>
      <button
        type="button"
        onClick={() => isEditable && onChange(!value)}
        disabled={!isEditable}
        className={clsx(
          'relative w-11 h-6 rounded-full transition-colors',
          value ? 'bg-cyan-500' : 'bg-gray-700',
          isEditable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform',
            value && 'translate-x-5'
          )}
        />
      </button>
    </div>
  );
}

/**
 * Multi-select for tools (checkboxes with search)
 */
function ToolsMultiSelect({
  selectedIds,
  allTools,
  onChange,
  isEditable = true,
}: {
  selectedIds: number[];
  allTools: { id: number; name: string; logoUrl?: string }[];
  onChange: (ids: number[]) => void;
  isEditable?: boolean;
}) {
  const [search, setSearch] = useState('');

  const filteredTools = allTools.filter((tool) =>
    tool.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleTool = (id: number) => {
    if (!isEditable) return;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((tid) => tid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectedTools = allTools.filter((t) => selectedIds.includes(t.id));

  return (
    <div className="space-y-3">
      {/* Selected tools display */}
      {selectedTools.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTools.map((tool) => (
            <span
              key={tool.id}
              className="inline-flex items-center gap-1.5 px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm"
            >
              {tool.logoUrl && (
                <img src={tool.logoUrl} alt="" className="w-4 h-4 rounded" />
              )}
              {tool.name}
              {isEditable && (
                <button
                  onClick={() => toggleTool(tool.id)}
                  className="ml-1 hover:text-cyan-300"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Search and add */}
      {isEditable && (
        <>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tools..."
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
          />

          {search && filteredTools.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1 bg-gray-800/50 border border-gray-700 rounded-lg p-2">
              {filteredTools.slice(0, 10).map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => {
                    toggleTool(tool.id);
                    setSearch('');
                  }}
                  className={clsx(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors',
                    selectedIds.includes(tool.id)
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'hover:bg-gray-700 text-gray-300'
                  )}
                >
                  {tool.logoUrl && (
                    <img src={tool.logoUrl} alt="" className="w-4 h-4 rounded" />
                  )}
                  {tool.name}
                  {selectedIds.includes(tool.id) && (
                    <span className="ml-auto text-cyan-400">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Simple image upload with preview
 */
function ImageUploadField({
  label,
  value,
  onChange,
  onUpload,
  isUploading = false,
  isEditable = true,
  placeholder = 'https://...',
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  onUpload?: (file: File) => Promise<void>;
  isUploading?: boolean;
  isEditable?: boolean;
  placeholder?: string;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpload) {
      await onUpload(file);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs text-gray-500">{label}</label>

      {/* Preview */}
      {value && (
        <div className="relative w-full h-32 rounded-lg overflow-hidden bg-gray-800 mb-2">
          <img
            src={value}
            alt="Preview"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          {isEditable && (
            <button
              onClick={() => onChange('')}
              className="absolute top-2 right-2 p-1 bg-red-500/80 hover:bg-red-500 text-white rounded-full"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* URL Input */}
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={!isEditable}
        className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 disabled:opacity-50"
      />

      {/* Upload button */}
      {isEditable && onUpload && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 rounded-lg text-sm transition-colors"
          >
            {isUploading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Upload Image
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Multi-select for taxonomies (topics, tags)
 */
function TaxonomyMultiSelect({
  label,
  selectedIds,
  allItems,
  onChange,
  placeholder = 'Search...',
  chipColor = 'cyan',
  isEditable = true,
}: {
  label: string;
  selectedIds: number[];
  allItems: { id: number; name: string }[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  chipColor?: 'cyan' | 'purple' | 'emerald' | 'amber';
  isEditable?: boolean;
}) {
  const [search, setSearch] = useState('');

  const colorClasses = {
    cyan: 'bg-cyan-500/20 text-cyan-400',
    purple: 'bg-purple-500/20 text-purple-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
    amber: 'bg-amber-500/20 text-amber-400',
  };

  const filteredItems = allItems.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) &&
      !selectedIds.includes(item.id)
  );

  const toggleItem = (id: number) => {
    if (!isEditable) return;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((tid) => tid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectedItems = allItems.filter((t) => selectedIds.includes(t.id));

  return (
    <div className="space-y-2">
      <label className="block text-xs text-gray-500">{label}</label>

      {/* Selected items display */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedItems.map((item) => (
            <span
              key={item.id}
              className={clsx(
                'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm',
                colorClasses[chipColor]
              )}
            >
              {item.name}
              {isEditable && (
                <button
                  onClick={() => toggleItem(item.id)}
                  className="ml-1 opacity-70 hover:opacity-100"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Search and add */}
      {isEditable && (
        <>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
          />

          {search && filteredItems.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1 bg-gray-800/50 border border-gray-700 rounded-lg p-2">
              {filteredItems.slice(0, 8).map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    toggleItem(item.id);
                    setSearch('');
                  }}
                  className="w-full flex items-center px-2 py-1.5 rounded text-left text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  {item.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function ListingEditView(props: ListingEditViewProps) {
  const {
    // State
    title,
    description,
    body,
    intent,
    listingTypeId,
    listingTypeSlug,
    customListingType,
    // categoryId, // Using listing type categories now
    // availableCategories, // Using listing type categories now
    availableListingTypes,
    availableTopics,
    availableTags,
    topicIds,
    tagIds,
    toolIds,
    allTools,
    featuredImageUrl,
    bannerUrl,
    isPaid,
    price,
    pricingType,
    // currency, // TODO: Add currency selector UI
    budgetMin,
    budgetMax,
    isNegotiable,
    isAvailable,
    capacity,
    responseTime,
    deadline,
    location,
    timezone,
    requirements,
    idealMatch,
    isRecurring,
    recurrenceType,
    externalUrl,
    sourceUrl,
    status,
    visibility,
    ownerId,
    isSaving,
    lastSaved,
    isOwner,

    // Setters
    setTitle,
    setDescription,
    setBody,
    setIntent,
    setListingTypeId,
    setCustomListingType,
    // setCategoryId, // Using listing type categories now
    setTopicIds,
    setTagIds,
    setToolIds,
    setFeaturedImageUrl,
    setBannerUrl,
    setIsPaid,
    setPrice,
    setPricingType,
    setBudgetMin,
    setBudgetMax,
    setIsNegotiable,
    setIsAvailable,
    setCapacity,
    setResponseTime,
    setDeadline,
    setLocation,
    setTimezone,
    setRequirements,
    setIdealMatch,
    setIsRecurring,
    setRecurrenceType,
    setExternalUrl,
    setSourceUrl,
    setStatus,
    setVisibility,
    setOwnerId,
  } = props;

  const isEditMode = props.isEditMode ?? true;

  // Handlers for inline editing
  const handleTitleChange = useCallback(async (newTitle: string) => {
    setTitle(newTitle);
  }, [setTitle]);

  const handleDescriptionChange = useCallback(async (newDesc: string) => {
    setDescription(newDesc);
  }, [setDescription]);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      {/* Save Status */}
      <div className="flex items-center justify-between text-sm">
        <div className="text-gray-500">
          {isSaving && <span className="text-cyan-400">Saving...</span>}
          {!isSaving && lastSaved && (
            <span>Saved {lastSaved.toLocaleTimeString()}</span>
          )}
        </div>
        {props.onToggleEdit && (
          <EditModeIndicator
            isOwner={isOwner}
            isEditMode={isEditMode}
            onToggle={props.onToggleEdit}
            isSaving={isSaving}
          />
        )}
      </div>

      {/* ===================================================================
          CORE FIELDS - Always shown
          =================================================================== */}
      <FieldSection title="Core" show={true}>
        {/* Title */}
        <InlineEditableTitle
          value={title}
          isEditable={isOwner && isEditMode}
          onChange={handleTitleChange}
          placeholder="Add a title..."
          className="text-3xl font-bold text-white"
          as="h1"
        />

        {/* Description */}
        <InlineEditableText
          value={description}
          isEditable={isOwner && isEditMode}
          onChange={handleDescriptionChange}
          placeholder="Add a short description..."
          className="text-lg text-gray-300"
          multiline
          rows={2}
        />

        {/* Intent Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setIntent('offer')}
            disabled={!isEditMode}
            className={clsx(
              'px-4 py-2 rounded-lg font-medium transition-colors',
              intent === 'offer'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
            )}
          >
            Offer
          </button>
          <button
            onClick={() => setIntent('ask')}
            disabled={!isEditMode}
            className={clsx(
              'px-4 py-2 rounded-lg font-medium transition-colors',
              intent === 'ask'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
            )}
          >
            Ask
          </button>
        </div>

        {/* Listing Type - Grouped by Category */}
        {(() => {
          // Split into categories (no parent) and subtypes (has parent)
          const categories = availableListingTypes.filter((t) => !t.parentId);
          const subtypes = availableListingTypes.filter((t) => t.parentId);

          // Find the selected type and its category
          const selectedType = availableListingTypes.find((t) => t.id === listingTypeId);
          const selectedCategoryId = selectedType?.parentId || (categories.find((c) => c.id === listingTypeId)?.id);
          const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

          // Get subtypes for the selected category
          const categorySubtypes = subtypes.filter((s) => s.parentId === selectedCategoryId);

          return (
            <>
              {/* Category Selection */}
              <InlineSelect
                label="Category"
                value={String(selectedCategoryId ?? '')}
                onChange={(val) => {
                  if (val === 'other') {
                    setListingTypeId(-1);
                  } else {
                    // When category changes, set to the category itself initially
                    setListingTypeId(val ? Number(val) : null);
                    setCustomListingType('');
                  }
                }}
                options={[
                  { value: '', label: 'Select category...' },
                  ...categories.map((c) => ({
                    value: String(c.id),
                    label: c.name,
                  })),
                  { value: 'other', label: 'Other...' },
                ]}
                isEditable={isEditMode}
              />

              {/* Subtype Selection (if category has subtypes) */}
              {selectedCategory && categorySubtypes.length > 0 && (
                <InlineSelect
                  label="Type"
                  value={String(listingTypeId ?? '')}
                  onChange={(val) => setListingTypeId(val ? Number(val) : null)}
                  options={[
                    { value: String(selectedCategoryId), label: `${selectedCategory.name} (general)` },
                    ...categorySubtypes.map((s) => ({
                      value: String(s.id),
                      label: s.name,
                    })),
                  ]}
                  isEditable={isEditMode}
                />
              )}

              {/* Custom Type Input */}
              {listingTypeId === -1 && (
                <InlineInput
                  label="Custom Type"
                  value={customListingType}
                  onChange={setCustomListingType}
                  placeholder="e.g., Workshop, Podcast Guest, etc."
                  isEditable={isEditMode}
                />
              )}
            </>
          );
        })()}

        {/* Body */}
        <InlineTextarea
          label="Details (Markdown)"
          value={body}
          onChange={setBody}
          placeholder="Add more details..."
          rows={6}
          isEditable={isEditMode}
        />
      </FieldSection>

      {/* ===================================================================
          CATEGORIZATION FIELDS - Topics and Tags for discovery
          =================================================================== */}
      <FieldSection
        title="Topics & Tags"
        show={shouldShowFieldGroup(listingTypeSlug ?? undefined, 'categorization', intent)}
      >
        <p className="text-sm text-gray-500 mb-3">
          Help people discover this listing by adding relevant topics and tags.
        </p>

        <TaxonomyMultiSelect
          label="Topics"
          selectedIds={topicIds}
          allItems={availableTopics}
          onChange={setTopicIds}
          placeholder="Search topics (e.g., Chatbots, Video, Marketing)..."
          chipColor="purple"
          isEditable={isEditMode}
        />

        <TaxonomyMultiSelect
          label="Tags (Skills & Interests)"
          selectedIds={tagIds}
          allItems={availableTags}
          onChange={setTagIds}
          placeholder="Search tags (e.g., Python, Design, Writing)..."
          chipColor="emerald"
          isEditable={isEditMode}
        />
      </FieldSection>

      {/* ===================================================================
          MEDIA FIELDS
          =================================================================== */}
      <FieldSection
        title="Media"
        show={shouldShowFieldGroup(listingTypeSlug ?? undefined, 'media', intent)}
      >
        <ImageUploadField
          label="Featured Image"
          value={featuredImageUrl}
          onChange={setFeaturedImageUrl}
          onUpload={props.handleFeaturedImageUpload}
          isUploading={props.isUploadingFeatured}
          isEditable={isEditMode}
        />
        <ImageUploadField
          label="Banner Image"
          value={bannerUrl}
          onChange={setBannerUrl}
          onUpload={props.handleBannerUpload}
          isUploading={props.isUploadingBanner}
          isEditable={isEditMode}
        />
      </FieldSection>

      {/* ===================================================================
          TOOLS FIELDS - What AI tools are used/needed
          =================================================================== */}
      <FieldSection
        title="Tools & Technologies"
        show={shouldShowFieldGroup(listingTypeSlug ?? undefined, 'tools', intent)}
      >
        <p className="text-sm text-gray-500 mb-2">
          {intent === 'offer'
            ? 'What tools or technologies does this involve?'
            : 'What tools or technologies do you need help with?'}
        </p>
        <ToolsMultiSelect
          selectedIds={toolIds}
          allTools={allTools}
          onChange={setToolIds}
          isEditable={isEditMode}
        />
      </FieldSection>

      {/* ===================================================================
          OWNERSHIP FIELDS - For AI agents
          =================================================================== */}
      <FieldSection
        title="Agent Profile"
        show={shouldShowFieldGroup(listingTypeSlug ?? undefined, 'ownership', intent)}
      >
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mb-4">
          <p className="text-sm text-purple-300 mb-2">
            <strong>AI Agent Profile</strong>
          </p>
          <p className="text-sm text-gray-400">
            This agent will have its own profile page and can interact with the community,
            but is linked to your account. You&apos;re responsible for the agent&apos;s actions.
          </p>
        </div>
        <InlineInput
          label="Owner (Your User ID)"
          value={ownerId}
          onChange={(val) => setOwnerId(val ? Number(val) : null)}
          placeholder="Your user ID (auto-filled on save)"
          type="number"
          isEditable={isEditMode}
        />
        <p className="text-xs text-gray-500 mt-1">
          Leave blank to automatically use your account as the owner.
        </p>
      </FieldSection>

      {/* ===================================================================
          PRICING FIELDS (Offers)
          =================================================================== */}
      <FieldSection
        title="Pricing"
        show={shouldShowFieldGroup(listingTypeSlug ?? undefined, 'pricing', intent)}
      >
        <InlineToggle
          label="Paid"
          value={isPaid}
          onChange={setIsPaid}
          isEditable={isEditMode}
        />
        {isPaid && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <InlineInput
                label="Price"
                value={price}
                onChange={(val) => setPrice(val ? Number(val) : null)}
                placeholder="0.00"
                type="number"
                isEditable={isEditMode}
              />
              <InlineSelect
                label="Pricing Type"
                value={pricingType}
                onChange={setPricingType}
                options={[
                  { value: 'one_time', label: 'One-Time' },
                  { value: 'hourly', label: 'Hourly' },
                  { value: 'monthly', label: 'Monthly' },
                  { value: 'custom', label: 'Custom' },
                ]}
                isEditable={isEditMode}
              />
            </div>
            <InlineToggle
              label="Price Negotiable"
              value={isNegotiable}
              onChange={setIsNegotiable}
              isEditable={isEditMode}
            />
          </>
        )}
      </FieldSection>

      {/* ===================================================================
          BUDGET FIELDS (Asks)
          =================================================================== */}
      <FieldSection
        title="Budget"
        show={shouldShowFieldGroup(listingTypeSlug ?? undefined, 'budget', intent)}
      >
        <div className="grid grid-cols-2 gap-4">
          <InlineInput
            label="Budget Min ($)"
            value={budgetMin}
            onChange={(val) => setBudgetMin(val ? Number(val) : null)}
            placeholder="0"
            type="number"
            isEditable={isEditMode}
          />
          <InlineInput
            label="Budget Max ($)"
            value={budgetMax}
            onChange={(val) => setBudgetMax(val ? Number(val) : null)}
            placeholder="0"
            type="number"
            isEditable={isEditMode}
          />
        </div>
        <InlineToggle
          label="Budget Negotiable"
          value={isNegotiable}
          onChange={setIsNegotiable}
          isEditable={isEditMode}
        />
      </FieldSection>

      {/* ===================================================================
          AVAILABILITY FIELDS
          =================================================================== */}
      <FieldSection
        title="Availability"
        show={shouldShowFieldGroup(listingTypeSlug ?? undefined, 'availability', intent)}
      >
        <InlineToggle
          label="Currently Available"
          value={isAvailable}
          onChange={setIsAvailable}
          isEditable={isEditMode}
        />
        <div className="grid grid-cols-2 gap-4">
          <InlineInput
            label="Capacity"
            value={capacity}
            onChange={(val) => setCapacity(val ? Number(val) : null)}
            placeholder="e.g., 3"
            type="number"
            isEditable={isEditMode}
          />
          <InlineInput
            label="Response Time"
            value={responseTime}
            onChange={setResponseTime}
            placeholder="e.g., Usually within 24 hours"
            isEditable={isEditMode}
          />
        </div>
      </FieldSection>

      {/* ===================================================================
          TIMELINE FIELDS
          =================================================================== */}
      <FieldSection
        title="Timeline"
        show={shouldShowFieldGroup(listingTypeSlug ?? undefined, 'timeline', intent)}
      >
        <InlineInput
          label="Deadline"
          value={deadline}
          onChange={setDeadline}
          type="date"
          isEditable={isEditMode}
        />
      </FieldSection>

      {/* ===================================================================
          LOCATION FIELDS
          =================================================================== */}
      <FieldSection
        title="Location"
        show={shouldShowFieldGroup(listingTypeSlug ?? undefined, 'location', intent)}
      >
        <div className="grid grid-cols-2 gap-4">
          <InlineInput
            label="Location"
            value={location}
            onChange={setLocation}
            placeholder="e.g., Remote, NYC, London"
            isEditable={isEditMode}
          />
          <InlineInput
            label="Timezone"
            value={timezone}
            onChange={setTimezone}
            placeholder="e.g., EST, PST, UTC"
            isEditable={isEditMode}
          />
        </div>
      </FieldSection>

      {/* ===================================================================
          RECURRING FIELDS
          =================================================================== */}
      <FieldSection
        title="Recurring"
        show={shouldShowFieldGroup(listingTypeSlug ?? undefined, 'recurring', intent)}
      >
        <InlineToggle
          label="Recurring"
          value={isRecurring}
          onChange={setIsRecurring}
          isEditable={isEditMode}
        />
        {isRecurring && (
          <InlineSelect
            label="Recurrence"
            value={recurrenceType || ''}
            onChange={(val) => setRecurrenceType(val as any)}
            options={[
              { value: '', label: 'Select...' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'as_needed', label: 'As Needed' },
            ]}
            isEditable={isEditMode}
          />
        )}
      </FieldSection>

      {/* ===================================================================
          REQUIREMENTS FIELDS
          =================================================================== */}
      <FieldSection
        title="Requirements & Matching"
        show={shouldShowFieldGroup(listingTypeSlug ?? undefined, 'requirements', intent)}
      >
        <InlineTextarea
          label="Requirements"
          value={requirements}
          onChange={setRequirements}
          placeholder="What you need from responders..."
          rows={3}
          isEditable={isEditMode}
        />
        <InlineTextarea
          label="Ideal Match"
          value={idealMatch}
          onChange={setIdealMatch}
          placeholder="Description of ideal person to connect with..."
          rows={3}
          isEditable={isEditMode}
        />
      </FieldSection>

      {/* ===================================================================
          LINKS FIELDS
          =================================================================== */}
      <FieldSection
        title="Links"
        show={shouldShowFieldGroup(listingTypeSlug ?? undefined, 'links', intent)}
      >
        <InlineInput
          label="External URL"
          value={externalUrl}
          onChange={setExternalUrl}
          placeholder="https://..."
          type="url"
          isEditable={isEditMode}
        />
        <InlineInput
          label="Source URL"
          value={sourceUrl}
          onChange={setSourceUrl}
          placeholder="https://github.com/..."
          type="url"
          isEditable={isEditMode}
        />
      </FieldSection>

      {/* ===================================================================
          PUBLISHING FIELDS - Always shown
          =================================================================== */}
      <FieldSection title="Publishing" show={true}>
        <div className="grid grid-cols-2 gap-4">
          <InlineSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={
              intent === 'ask'
                ? [
                    { value: 'draft', label: 'Draft' },
                    { value: 'open', label: 'Open' },
                    { value: 'in_progress', label: 'In Progress' },
                    { value: 'fulfilled', label: 'Fulfilled' },
                    { value: 'closed', label: 'Closed' },
                  ]
                : [
                    { value: 'draft', label: 'Draft' },
                    { value: 'published', label: 'Published' },
                    { value: 'paused', label: 'Paused' },
                    { value: 'archived', label: 'Archived' },
                  ]
            }
            isEditable={isEditMode}
          />
          <InlineSelect
            label="Visibility"
            value={visibility}
            onChange={setVisibility}
            options={[
              { value: 'public', label: 'Public' },
              { value: 'unlisted', label: 'Unlisted' },
              { value: 'private', label: 'Private' },
            ]}
            isEditable={isEditMode}
          />
        </div>
      </FieldSection>
    </div>
  );
}

export default ListingEditView;
