/**
 * Types for the Listings feature (The Collective - Asks & Offers)
 */

import type { Taxonomy, ToolSummary } from './models';

// Listing intent - Ask (need help) or Offer (providing value)
export type ListingIntent = 'ask' | 'offer';

// Listing status values
export type ListingStatus =
  | 'draft'
  | 'published'
  | 'archived'
  | 'paused'
  | 'open'
  | 'in_progress'
  | 'fulfilled'
  | 'closed';

// Listing visibility
export type ListingVisibility = 'public' | 'unlisted' | 'private';

// Pricing type
export type PricingType = 'free' | 'one_time' | 'hourly' | 'monthly' | 'custom';

// Recurrence type for services/mentorship
export type RecurrenceType = 'weekly' | 'monthly' | 'as_needed';

// Minimal user info for owner/creator
export interface ListingUser {
  id: number;
  username: string;
  avatarUrl?: string;
  displayName?: string;
}

// Parent listing reference
export interface ListingParent {
  id: number;
  title: string;
  slug: string;
  username: string;
}

// Full Listing model
export interface Listing {
  // Identity
  id: number;
  username: string;
  userAvatarUrl?: string;
  userDisplayName?: string;
  slug: string;

  // Core content
  title: string;
  description: string;
  body: string;
  bodyHtml: string;

  // Intent & Type
  intent: ListingIntent;
  listingType: number; // Taxonomy ID
  listingTypeDetails?: Taxonomy;

  // Categorization
  category?: number;
  categoryDetails?: Taxonomy;
  topics?: number[];
  topicsDetails?: Taxonomy[];
  tags?: number[];
  tagsDetails?: Taxonomy[];
  tools?: number[];
  toolsDetails?: ToolSummary[];

  // Ownership (for agents)
  owner?: number;
  ownerDetails?: ListingUser;

  // Media
  featuredImageUrl?: string;
  bannerUrl?: string;
  logoUrl?: string;
  media?: Array<{
    type: string;
    url: string;
    caption?: string;
    order: number;
  }>;

  // Pricing (for Offers)
  isPaid: boolean;
  price?: number;
  pricingType: PricingType;
  currency: string;
  stripeProductId?: string;
  stripePriceId?: string;
  acceptsCredits: boolean;
  creditPrice?: number;

  // Budget (for Asks)
  budgetMin?: number;
  budgetMax?: number;
  isNegotiable: boolean;

  // Availability & Capacity
  isAvailable: boolean;
  capacity?: number;
  responseTime?: string;

  // Timeline
  deadline?: string; // ISO date string

  // Location & Timezone
  location?: string;
  timezone?: string;

  // Requirements & Matching
  requirements?: string;
  idealMatch?: string;

  // Recurring
  isRecurring: boolean;
  recurrenceType?: RecurrenceType;

  // Links
  externalUrl?: string;
  sourceUrl?: string;

  // Publishing & Status
  status: ListingStatus;
  visibility: ListingVisibility;
  scheduledPublishAt?: string;
  isFeatured: boolean;
  isArchived: boolean;
  version: number;

  // Relationships
  parent?: number;
  parentDetails?: ListingParent;

  // Engagement (read-only)
  heartCount: number;
  commentCount: number;
  shareCount: number;
  saveCount: number;
  viewCount: number;
  connectionCount: number;
  conversionRate: number;
  isHeartedByUser: boolean;
  isSavedByUser: boolean;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

// Lightweight listing for cards/feeds
export interface ListingCard {
  id: number;
  username: string;
  userAvatarUrl?: string;
  slug: string;
  title: string;
  description: string;
  intent: ListingIntent;
  listingType: number;
  listingTypeDetails?: Taxonomy;
  category?: number;
  categoryDetails?: Taxonomy;
  tools?: number[];
  toolsDetails?: ToolSummary[];
  featuredImageUrl?: string;
  bannerUrl?: string;
  isPaid: boolean;
  price?: number;
  pricingType: PricingType;
  isAvailable: boolean;
  status: ListingStatus;
  heartCount: number;
  isHeartedByUser: boolean;
  createdAt: string;
}

// Payload for creating/updating listings
export interface ListingPayload {
  // Core
  title?: string;
  slug?: string;
  description?: string;
  body?: string;

  // Intent & Type
  intent?: ListingIntent;
  listingType?: number;

  // Categorization
  category?: number | null;
  topics?: number[];
  tags?: number[];
  tools?: number[];

  // Ownership
  owner?: number | null;

  // Media
  featuredImageUrl?: string;
  bannerUrl?: string;
  logoUrl?: string;
  media?: Array<{
    type: string;
    url: string;
    caption?: string;
    order: number;
  }>;

  // Pricing
  isPaid?: boolean;
  price?: number | null;
  pricingType?: PricingType;
  currency?: string;
  acceptsCredits?: boolean;
  creditPrice?: number | null;

  // Budget
  budgetMin?: number | null;
  budgetMax?: number | null;
  isNegotiable?: boolean;

  // Availability
  isAvailable?: boolean;
  capacity?: number | null;
  responseTime?: string;

  // Timeline
  deadline?: string | null;

  // Location
  location?: string;
  timezone?: string;

  // Requirements
  requirements?: string;
  idealMatch?: string;

  // Recurring
  isRecurring?: boolean;
  recurrenceType?: RecurrenceType;

  // Links
  externalUrl?: string;
  sourceUrl?: string;

  // Publishing
  status?: ListingStatus;
  visibility?: ListingVisibility;
  scheduledPublishAt?: string | null;
  isArchived?: boolean;
}

// Listing comment
export interface ListingComment {
  id: number;
  user: ListingUser;
  body: string;
  parent?: number;
  replies?: ListingComment[];
  isEdited: boolean;
  isDeleted: boolean;
  moderationStatus: 'pending' | 'approved' | 'rejected' | 'flagged';
  createdAt: string;
  updatedAt: string;
}

// Listing version (history)
export interface ListingVersion {
  id: number;
  version: number;
  title: string;
  description: string;
  body: string;
  data: Record<string, unknown>;
  changeSummary: string;
  createdBy: ListingUser;
  createdAt: string;
}

// Heart/save toggle response
export interface ToggleResponse {
  hearted?: boolean;
  heartCount?: number;
  saved?: boolean;
  saveCount?: number;
}

// Listing type metadata (from taxonomy description)
export interface ListingTypeInfo {
  slug: string;
  name: string;
  description: string;
  intent: ListingIntent;
  hasPricing: boolean;
  hasBudget: boolean;
  requiresOwner: boolean;
  icon: string;
}

// Field groups for conditional display
export type FieldGroup =
  | 'core'
  | 'media'
  | 'tools'        // AI tools used or needed (critical for matching!)
  | 'categorization' // Topics and tags for discovery
  | 'pricing'
  | 'budget'
  | 'availability'
  | 'timeline'
  | 'location'
  | 'recurring'
  | 'requirements'
  | 'ownership'    // For agents - who owns/operates it
  | 'publishing'
  | 'links';

// Map listing type slugs to field groups
// Note: Intent (ask/offer) also influences which fields appear (see INTENT_FIELD_RULES)
// Categories and their subtypes share field groups
export const LISTING_TYPE_FIELD_GROUPS: Record<string, FieldGroup[]> = {
  // ============================================================
  // PROJECT CATEGORY - Showcasing things you built
  // ============================================================
  // Offer: "Check out my app" - show what you built, what tools/tech used
  // Ask: "Looking for apps like X" - describe what you need
  'project': ['core', 'categorization', 'media', 'tools', 'links', 'publishing'],
  'app': ['core', 'categorization', 'media', 'tools', 'links', 'publishing'],
  'agent': ['core', 'categorization', 'media', 'tools', 'links', 'ownership', 'publishing'], // Agents need owner
  'listing-mcp-server': ['core', 'categorization', 'media', 'tools', 'links', 'publishing'], // MCP servers
  'side-project': ['core', 'categorization', 'media', 'tools', 'links', 'publishing'],

  // ============================================================
  // CONTENT CATEGORY - Educational/informational content
  // ============================================================
  // Offer: "Here's my article/course" - share educational content
  // Ask: "Looking for courses on X" - describe what you want to learn
  'content': ['core', 'categorization', 'media', 'tools', 'links', 'publishing'],
  'article': ['core', 'categorization', 'media', 'tools', 'links', 'publishing'],
  'newsletter': ['core', 'categorization', 'media', 'tools', 'links', 'pricing', 'recurring', 'publishing'],
  'course': ['core', 'categorization', 'media', 'tools', 'links', 'pricing', 'publishing'],
  'download': ['core', 'categorization', 'media', 'tools', 'links', 'pricing', 'publishing'],
  'recommendation': ['core', 'categorization', 'media', 'tools', 'links', 'publishing'],

  // ============================================================
  // SERVICES CATEGORY - Professional work for hire
  // ============================================================
  // Offer (Consulting/Freelance): pricing, availability, location, what tools you know
  // Ask (Hiring): budget, timeline, location, what tools needed
  'services': ['core', 'categorization', 'media', 'tools', 'pricing', 'availability', 'location', 'requirements', 'publishing'],
  'listing-consulting': ['core', 'categorization', 'media', 'tools', 'pricing', 'availability', 'location', 'requirements', 'publishing'],
  'listing-freelance': ['core', 'categorization', 'media', 'tools', 'pricing', 'availability', 'location', 'requirements', 'publishing'],
  'listing-hiring': ['core', 'categorization', 'media', 'tools', 'budget', 'location', 'timeline', 'requirements', 'publishing'],

  // ============================================================
  // MENTORSHIP CATEGORY - Guidance and learning together
  // ============================================================
  // Offer (Mentor): what tools/topics you teach, pricing, availability
  // Ask (Learning): what tools/topics you want to learn
  'mentorship': ['core', 'categorization', 'media', 'tools', 'pricing', 'availability', 'recurring', 'requirements', 'publishing'],
  'listing-mentor': ['core', 'categorization', 'media', 'tools', 'pricing', 'availability', 'recurring', 'requirements', 'publishing'],
  'listing-accountability': ['core', 'categorization', 'media', 'tools', 'availability', 'recurring', 'requirements', 'publishing'],
  'listing-learning': ['core', 'categorization', 'media', 'tools', 'availability', 'recurring', 'requirements', 'publishing'],

  // ============================================================
  // FEEDBACK CATEGORY - Getting input from the community
  // ============================================================
  // Ask: "Need feedback on my X" - link to what needs review, timeline, what tools it uses
  // Offer: "I'll review your code" - availability, maybe pricing, what tools you know
  'listing-feedback': ['core', 'categorization', 'media', 'tools', 'links', 'availability', 'timeline', 'requirements', 'publishing'],
  'listing-beta-testing': ['core', 'categorization', 'media', 'tools', 'links', 'availability', 'timeline', 'requirements', 'publishing'],
  'listing-code-review': ['core', 'categorization', 'media', 'tools', 'links', 'availability', 'timeline', 'requirements', 'publishing'],
  'listing-design-critique': ['core', 'categorization', 'media', 'tools', 'links', 'availability', 'timeline', 'requirements', 'publishing'],
  'listing-general-feedback': ['core', 'categorization', 'media', 'tools', 'links', 'availability', 'timeline', 'requirements', 'publishing'],

  // ============================================================
  // GROWTH CATEGORY - Promotion, networking, partnerships
  // ============================================================
  // Offer (Promotion/Intro): what you can offer, requirements for who you'll help
  // Ask (Collaboration): budget, timeline, what tools involved
  'growth': ['core', 'categorization', 'media', 'tools', 'links', 'availability', 'requirements', 'publishing'],
  'listing-promotion': ['core', 'categorization', 'media', 'links', 'availability', 'requirements', 'publishing'],
  'listing-introduction': ['core', 'categorization', 'media', 'links', 'availability', 'requirements', 'publishing'],
  'listing-collaboration': ['core', 'categorization', 'media', 'tools', 'links', 'budget', 'timeline', 'requirements', 'publishing'],
};

// Intent-based field rules
// These override type-based rules to ensure the right fields show for asks vs offers
const INTENT_FIELD_RULES: Record<ListingIntent, { alwaysShow: FieldGroup[]; alwaysHide: FieldGroup[] }> = {
  offer: {
    // Offers: What you're providing, your price, your availability
    alwaysShow: ['pricing', 'availability'],
    alwaysHide: ['budget'], // Budget is for asks (what they'll pay)
  },
  ask: {
    // Asks: What you need, your budget, when you need it
    alwaysShow: ['budget', 'timeline', 'requirements'],
    alwaysHide: ['pricing', 'availability'], // Pricing/availability is for offers
  },
};

// Helper to check if a field group should be shown
// Combines listing type fields with intent-based overrides
export function shouldShowFieldGroup(
  listingTypeSlug: string | undefined,
  fieldGroup: FieldGroup,
  intent?: ListingIntent
): boolean {
  // Core and publishing always shown
  if (fieldGroup === 'core' || fieldGroup === 'publishing') return true;

  // Get type-based groups (or empty if no type selected)
  const typeGroups = listingTypeSlug
    ? LISTING_TYPE_FIELD_GROUPS[listingTypeSlug] || []
    : [];

  // Check if this field is in the type's groups
  const typeAllows = typeGroups.includes(fieldGroup);

  // If no intent specified, just use type-based rules
  if (!intent) return typeAllows;

  // Apply intent-based rules
  const intentRules = INTENT_FIELD_RULES[intent];

  // If intent always hides this field, don't show it
  if (intentRules.alwaysHide.includes(fieldGroup)) return false;

  // If intent always shows this field, show it (regardless of type)
  if (intentRules.alwaysShow.includes(fieldGroup)) return true;

  // Otherwise, use type-based rules
  return typeAllows;
}
