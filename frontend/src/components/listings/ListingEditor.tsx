import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { ReactNode } from 'react';
import { updateListing } from '@/services/listings';
import { getTools } from '@/services/tools';
import { uploadImage } from '@/services/upload';
import type { Taxonomy, ToolSummary } from '@/types/models';
import type {
  Listing,
  ListingPayload,
  ListingIntent,
  ListingStatus,
  ListingVisibility,
  PricingType,
  RecurrenceType,
} from '@/types/listings';
import { api } from '@/services/api';
import { AUTOSAVE_DEBOUNCE_MS } from '@/components/projects/constants';

// Allow time for React state updates to complete before enabling autosave
const INITIAL_LOAD_GRACE_PERIOD_MS = 100;

export interface ListingEditorProps {
  /** The listing to edit */
  listing: Listing;
  /** Callback when listing is updated */
  onListingUpdate: (updatedListing: Listing) => void;
  /** Render children with editor state and handlers */
  children: (props: ListingEditorRenderProps) => ReactNode;
  /** Optional: custom slug change handler (for page navigation) */
  onSlugChange?: (newSlug: string) => void;
}

export interface ListingEditorRenderProps {
  // =========================================================================
  // State
  // =========================================================================

  // Core
  title: string;
  slug: string;
  customSlugSet: boolean;
  description: string;
  body: string;

  // Intent & Type
  intent: ListingIntent;
  listingTypeId: number | null;
  listingTypeSlug: string | null;
  customListingType: string;

  // Categorization
  categoryId: number | null;
  topicIds: number[];
  tagIds: number[];
  toolIds: number[];
  allTools: ToolSummary[];
  availableCategories: Taxonomy[];
  availableListingTypes: Taxonomy[];
  availableTopics: Taxonomy[];
  availableTags: Taxonomy[]; // interests + skills

  // Media
  featuredImageUrl: string;
  bannerUrl: string;
  logoUrl: string;
  isUploadingFeatured: boolean;
  isUploadingBanner: boolean;

  // Pricing
  isPaid: boolean;
  price: number | null;
  pricingType: PricingType;
  currency: string;
  acceptsCredits: boolean;
  creditPrice: number | null;

  // Budget
  budgetMin: number | null;
  budgetMax: number | null;
  isNegotiable: boolean;

  // Availability
  isAvailable: boolean;
  capacity: number | null;
  responseTime: string;

  // Timeline
  deadline: string;

  // Location
  location: string;
  timezone: string;

  // Requirements
  requirements: string;
  idealMatch: string;

  // Recurring
  isRecurring: boolean;
  recurrenceType: RecurrenceType | '';

  // Links
  externalUrl: string;
  sourceUrl: string;

  // Publishing
  status: ListingStatus;
  visibility: ListingVisibility;
  isArchived: boolean;

  // Ownership (for agents)
  ownerId: number | null;

  // Save state
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;

  // Permissions
  isOwner: boolean;

  // =========================================================================
  // Setters
  // =========================================================================

  // Core
  setTitle: (title: string) => void;
  setSlug: (slug: string) => void;
  setCustomSlugSet: (set: boolean) => void;
  setDescription: (desc: string) => void;
  setBody: (body: string) => void;

  // Intent & Type
  setIntent: (intent: ListingIntent) => void;
  setListingTypeId: (id: number | null) => void;
  setCustomListingType: (type: string) => void;

  // Categorization
  setCategoryId: (id: number | null) => void;
  setTopicIds: (ids: number[]) => void;
  setTagIds: (ids: number[]) => void;
  setToolIds: (ids: number[]) => void;

  // Media
  setFeaturedImageUrl: (url: string) => void;
  setBannerUrl: (url: string) => void;
  setLogoUrl: (url: string) => void;

  // Pricing
  setIsPaid: (isPaid: boolean) => void;
  setPrice: (price: number | null) => void;
  setPricingType: (type: PricingType) => void;
  setCurrency: (currency: string) => void;
  setAcceptsCredits: (accepts: boolean) => void;
  setCreditPrice: (price: number | null) => void;

  // Budget
  setBudgetMin: (min: number | null) => void;
  setBudgetMax: (max: number | null) => void;
  setIsNegotiable: (negotiable: boolean) => void;

  // Availability
  setIsAvailable: (available: boolean) => void;
  setCapacity: (capacity: number | null) => void;
  setResponseTime: (time: string) => void;

  // Timeline
  setDeadline: (deadline: string) => void;

  // Location
  setLocation: (location: string) => void;
  setTimezone: (timezone: string) => void;

  // Requirements
  setRequirements: (requirements: string) => void;
  setIdealMatch: (match: string) => void;

  // Recurring
  setIsRecurring: (recurring: boolean) => void;
  setRecurrenceType: (type: RecurrenceType | '') => void;

  // Links
  setExternalUrl: (url: string) => void;
  setSourceUrl: (url: string) => void;

  // Publishing
  setStatus: (status: ListingStatus) => void;
  setVisibility: (visibility: ListingVisibility) => void;
  setIsArchived: (archived: boolean) => void;

  // Ownership
  setOwnerId: (id: number | null) => void;

  // =========================================================================
  // Handlers
  // =========================================================================

  handleSave: () => Promise<void>;
  handleFeaturedImageUpload: (file: File) => Promise<void>;
  handleBannerUpload: (file: File) => Promise<void>;
}

/**
 * ListingEditor - Core component for listing editing with render props
 *
 * Manages all state and auto-save logic for editing listings.
 * Uses the same pattern as ProjectEditor for consistency.
 *
 * Usage:
 * ```tsx
 * <ListingEditor listing={listing} onListingUpdate={handleUpdate}>
 *   {(editorProps) => (
 *     <ListingEditView {...editorProps} />
 *   )}
 * </ListingEditor>
 * ```
 */
export function ListingEditor({
  listing,
  onListingUpdate,
  children,
  onSlugChange,
}: ListingEditorProps) {
  // =========================================================================
  // Save State
  // =========================================================================
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const isInitialLoadRef = useRef(true);
  const saveVersionRef = useRef(0);

  // =========================================================================
  // Core State
  // =========================================================================
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [customSlugSet, setCustomSlugSet] = useState(false);
  const [description, setDescription] = useState('');
  const [body, setBody] = useState('');

  // =========================================================================
  // Intent & Type State
  // =========================================================================
  const [intent, setIntent] = useState<ListingIntent>('offer');
  const [listingTypeId, setListingTypeId] = useState<number | null>(null);
  const [customListingType, setCustomListingType] = useState('');

  // =========================================================================
  // Categorization State
  // =========================================================================
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [topicIds, setTopicIds] = useState<number[]>([]);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [toolIds, setToolIds] = useState<number[]>([]);
  const [allTools, setAllTools] = useState<ToolSummary[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Taxonomy[]>([]);
  const [availableListingTypes, setAvailableListingTypes] = useState<Taxonomy[]>([]);
  const [availableTopics, setAvailableTopics] = useState<Taxonomy[]>([]);
  const [availableTags, setAvailableTags] = useState<Taxonomy[]>([]);

  // =========================================================================
  // Media State
  // =========================================================================
  const [featuredImageUrl, setFeaturedImageUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [isUploadingFeatured, setIsUploadingFeatured] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  // =========================================================================
  // Pricing State
  // =========================================================================
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState<number | null>(null);
  const [pricingType, setPricingType] = useState<PricingType>('free');
  const [currency, setCurrency] = useState('USD');
  const [acceptsCredits, setAcceptsCredits] = useState(true);
  const [creditPrice, setCreditPrice] = useState<number | null>(null);

  // =========================================================================
  // Budget State
  // =========================================================================
  const [budgetMin, setBudgetMin] = useState<number | null>(null);
  const [budgetMax, setBudgetMax] = useState<number | null>(null);
  const [isNegotiable, setIsNegotiable] = useState(false);

  // =========================================================================
  // Availability State
  // =========================================================================
  const [isAvailable, setIsAvailable] = useState(true);
  const [capacity, setCapacity] = useState<number | null>(null);
  const [responseTime, setResponseTime] = useState('');

  // =========================================================================
  // Timeline State
  // =========================================================================
  const [deadline, setDeadline] = useState('');

  // =========================================================================
  // Location State
  // =========================================================================
  const [location, setLocation] = useState('');
  const [timezone, setTimezone] = useState('');

  // =========================================================================
  // Requirements State
  // =========================================================================
  const [requirements, setRequirements] = useState('');
  const [idealMatch, setIdealMatch] = useState('');

  // =========================================================================
  // Recurring State
  // =========================================================================
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType | ''>('');

  // =========================================================================
  // Links State
  // =========================================================================
  const [externalUrl, setExternalUrl] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  // =========================================================================
  // Publishing State
  // =========================================================================
  const [status, setStatus] = useState<ListingStatus>('draft');
  const [visibility, setVisibility] = useState<ListingVisibility>('public');
  const [isArchived, setIsArchived] = useState(false);

  // =========================================================================
  // Ownership State
  // =========================================================================
  const [ownerId, setOwnerId] = useState<number | null>(null);

  // =========================================================================
  // Computed
  // =========================================================================
  const listingTypeSlug = useMemo(() => {
    if (!listingTypeId || !availableListingTypes.length) return null;
    const type = availableListingTypes.find((t) => t.id === listingTypeId);
    return type?.slug || null;
  }, [listingTypeId, availableListingTypes]);

  // =========================================================================
  // Initialize from listing prop
  // =========================================================================
  useEffect(() => {
    if (!listing) return;

    // Core
    setTitle(listing.title || '');
    setSlug(listing.slug || '');
    setDescription(listing.description || '');
    setBody(listing.body || '');

    // Intent & Type
    setIntent(listing.intent || 'offer');
    setListingTypeId(listing.listingType || null);

    // Categorization
    setCategoryId(listing.category || null);
    setTopicIds(listing.topics || []);
    setTagIds(listing.tags || []);
    setToolIds(listing.tools || []);

    // Media
    setFeaturedImageUrl(listing.featuredImageUrl || '');
    setBannerUrl(listing.bannerUrl || '');
    setLogoUrl(listing.logoUrl || '');

    // Pricing
    setIsPaid(listing.isPaid || false);
    setPrice(listing.price ?? null);
    setPricingType(listing.pricingType || 'free');
    setCurrency(listing.currency || 'USD');
    setAcceptsCredits(listing.acceptsCredits ?? true);
    setCreditPrice(listing.creditPrice ?? null);

    // Budget
    setBudgetMin(listing.budgetMin ?? null);
    setBudgetMax(listing.budgetMax ?? null);
    setIsNegotiable(listing.isNegotiable || false);

    // Availability
    setIsAvailable(listing.isAvailable ?? true);
    setCapacity(listing.capacity ?? null);
    setResponseTime(listing.responseTime || '');

    // Timeline
    setDeadline(listing.deadline || '');

    // Location
    setLocation(listing.location || '');
    setTimezone(listing.timezone || '');

    // Requirements
    setRequirements(listing.requirements || '');
    setIdealMatch(listing.idealMatch || '');

    // Recurring
    setIsRecurring(listing.isRecurring || false);
    setRecurrenceType(listing.recurrenceType || '');

    // Links
    setExternalUrl(listing.externalUrl || '');
    setSourceUrl(listing.sourceUrl || '');

    // Publishing
    setStatus(listing.status || 'draft');
    setVisibility(listing.visibility || 'public');
    setIsArchived(listing.isArchived || false);

    // Ownership
    setOwnerId(listing.owner ?? null);

    // Mark initial load complete after grace period
    setTimeout(() => {
      isInitialLoadRef.current = false;
    }, INITIAL_LOAD_GRACE_PERIOD_MS);
  }, [listing]);

  // =========================================================================
  // Load taxonomies and tools
  // =========================================================================
  useEffect(() => {
    // Load categories
    api.get('/taxonomies/', { params: { taxonomy_type: 'category', is_active: true } })
      .then((res) => setAvailableCategories(res.data.results || res.data))
      .catch(console.error);

    // Load listing types (get all with larger page size)
    api.get('/taxonomies/', { params: { taxonomy_type: 'listing_type', is_active: true, page_size: 100 } })
      .then((res) => setAvailableListingTypes(res.data.results || res.data))
      .catch(console.error);

    // Load topics
    api.get('/taxonomies/', { params: { taxonomy_type: 'topic', is_active: true, page_size: 100 } })
      .then((res) => setAvailableTopics(res.data.results || res.data))
      .catch(console.error);

    // Load tags (interests + skills)
    api.get('/taxonomies/', { params: { taxonomy_type__in: 'interest,skill', is_active: true, page_size: 200 } })
      .then((res) => setAvailableTags(res.data.results || res.data))
      .catch(console.error);

    // Load tools
    getTools()
      .then((res) => setAllTools(res.results as ToolSummary[]))
      .catch(console.error);
  }, []);

  // =========================================================================
  // Form data for change detection
  // =========================================================================
  const formData = useMemo(
    () => ({
      title,
      slug,
      description,
      body,
      intent,
      listingTypeId,
      customListingType,
      categoryId,
      topicIds,
      tagIds,
      toolIds,
      featuredImageUrl,
      bannerUrl,
      logoUrl,
      isPaid,
      price,
      pricingType,
      currency,
      acceptsCredits,
      creditPrice,
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
      isArchived,
      ownerId,
    }),
    [
      title, slug, description, body, intent, listingTypeId, customListingType, categoryId,
      topicIds, tagIds, toolIds, featuredImageUrl, bannerUrl, logoUrl,
      isPaid, price, pricingType, currency, acceptsCredits, creditPrice,
      budgetMin, budgetMax, isNegotiable, isAvailable, capacity, responseTime,
      deadline, location, timezone, requirements, idealMatch, isRecurring,
      recurrenceType, externalUrl, sourceUrl, status, visibility, isArchived, ownerId,
    ]
  );

  // =========================================================================
  // Mark unsaved changes
  // =========================================================================
  useEffect(() => {
    if (!isInitialLoadRef.current) {
      setHasUnsavedChanges(true);
    }
  }, [formData]);

  // =========================================================================
  // Auto-save with debounce
  // =========================================================================
  const handleSave = useCallback(async () => {
    if (!listing?.id) return;

    setIsSaving(true);
    saveVersionRef.current += 1;
    const currentSaveVersion = saveVersionRef.current;

    const payload: ListingPayload = {
      title,
      slug,
      description,
      body,
      intent,
      listingType: listingTypeId ?? undefined,
      category: categoryId,
      topics: topicIds,
      tags: tagIds,
      tools: toolIds,
      featuredImageUrl,
      bannerUrl,
      logoUrl,
      isPaid,
      price,
      pricingType,
      currency,
      acceptsCredits,
      creditPrice,
      budgetMin,
      budgetMax,
      isNegotiable,
      isAvailable,
      capacity,
      responseTime,
      deadline: deadline || null,
      location,
      timezone,
      requirements,
      idealMatch,
      isRecurring,
      recurrenceType: recurrenceType || undefined,
      externalUrl,
      sourceUrl,
      status,
      visibility,
      isArchived,
    };

    try {
      const updatedListing = await updateListing(listing.id, payload);

      if (currentSaveVersion === saveVersionRef.current) {
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        onListingUpdate(updatedListing);

        // Handle slug change for navigation
        if (slug !== listing.slug && onSlugChange) {
          onSlugChange(slug);
        }
      }
    } catch (err: any) {
      console.error('Save failed:', err);
      if (err?.details) {
        console.warn('Backend validation:', JSON.stringify(err.details, null, 2));
      }
    } finally {
      if (currentSaveVersion === saveVersionRef.current) {
        setIsSaving(false);
      }
    }
  }, [
    listing, title, slug, description, body, intent, listingTypeId, categoryId,
    topicIds, tagIds, toolIds, featuredImageUrl, bannerUrl, logoUrl,
    isPaid, price, pricingType, currency, acceptsCredits, creditPrice,
    budgetMin, budgetMax, isNegotiable, isAvailable, capacity, responseTime,
    deadline, location, timezone, requirements, idealMatch, isRecurring,
    recurrenceType, externalUrl, sourceUrl, status, visibility, isArchived,
    onListingUpdate, onSlugChange,
  ]);

  // Auto-save effect
  useEffect(() => {
    if (!hasUnsavedChanges || !listing) return;

    const timer = setTimeout(() => {
      handleSave();
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [hasUnsavedChanges, listing, handleSave]);

  // =========================================================================
  // Upload handlers
  // =========================================================================
  const handleFeaturedImageUpload = useCallback(async (file: File) => {
    setIsUploadingFeatured(true);
    try {
      const response = await uploadImage(file);
      setFeaturedImageUrl(response.url);
    } catch (err) {
      console.error('Featured image upload failed:', err);
    } finally {
      setIsUploadingFeatured(false);
    }
  }, []);

  const handleBannerUpload = useCallback(async (file: File) => {
    setIsUploadingBanner(true);
    try {
      const response = await uploadImage(file);
      setBannerUrl(response.url);
    } catch (err) {
      console.error('Banner upload failed:', err);
    } finally {
      setIsUploadingBanner(false);
    }
  }, []);

  // =========================================================================
  // Render props
  // =========================================================================
  const renderProps: ListingEditorRenderProps = {
    // State
    title,
    slug,
    customSlugSet,
    description,
    body,
    intent,
    listingTypeId,
    listingTypeSlug,
    customListingType,
    categoryId,
    topicIds,
    tagIds,
    toolIds,
    allTools,
    availableCategories,
    availableListingTypes,
    availableTopics,
    availableTags,
    featuredImageUrl,
    bannerUrl,
    logoUrl,
    isUploadingFeatured,
    isUploadingBanner,
    isPaid,
    price,
    pricingType,
    currency,
    acceptsCredits,
    creditPrice,
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
    isArchived,
    ownerId,
    isSaving,
    lastSaved,
    hasUnsavedChanges,
    isOwner: true, // TODO: Compute from auth context

    // Setters
    setTitle,
    setSlug,
    setCustomSlugSet,
    setDescription,
    setBody,
    setIntent,
    setListingTypeId,
    setCustomListingType,
    setCategoryId,
    setTopicIds,
    setTagIds,
    setToolIds,
    setFeaturedImageUrl,
    setBannerUrl,
    setLogoUrl,
    setIsPaid,
    setPrice,
    setPricingType,
    setCurrency,
    setAcceptsCredits,
    setCreditPrice,
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
    setIsArchived,
    setOwnerId,

    // Handlers
    handleSave,
    handleFeaturedImageUpload,
    handleBannerUpload,
  };

  return <>{children(renderProps)}</>;
}

export default ListingEditor;
