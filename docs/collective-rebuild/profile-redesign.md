# Profile Redesign: Asks + Offers Side-by-Side

> **Last Updated:** January 2025
>
> This document defines the new profile layout for the Ask & Offer AI Collective.

---

## Design Philosophy

Profiles are **creative hubs** that prominently feature **Asks and Offers side-by-side**, while also showcasing the person's work and interests.

**Key insight:** An app isn't an offer — it's a thing. The *offer* is what you do with it (mentoring, consulting, courses). The *ask* is what you need for it (testers, feedback, collaborators). By separating "Things I'm Working On" from Asks/Offers, we avoid forcing creative content into transactional boxes.

**Structure:**
1. **Header** — Name, tagline, stats, social links
2. **Asks + Offers** — Side-by-side columns (the core marketplace)
3. **Things I'm Working On or Thinking About** — Projects, apps, WIPs, ideas, blog posts (creative showcase)
4. **Things I Love** — Curated links and recommendations
5. **Recent Activity** — Shows engagement
6. **Achievements** — Gamification/badges

**Key principles:**
- Asks and Offers are **equal and prominent** — side-by-side, not sequential
- Creative content (apps, WIPs, ideas, blog posts) lives in its own section
- Each project card shows its linked asks and offers
- Empty sections are hidden automatically

---

## Full Profile Example

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  @gina                                                     [Follow] [Share] │
│  "Helping founders grow IRL"                                                │
│                                                                             │
│  🌱 2,480 pts  •  🚀 4 asks  •  💫 3 offers  •  👀 892 followers              │
│  [Twitter] [LinkedIn] [GitHub]                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Bio: Founder of Kinlia. Former PM at Stripe. I love helping early-stage    │
│  founders figure out their AI strategy.                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🚀 MY ASKS                              💫 MY OFFERS                       │
│  ────────────────────                    ────────────────────               │
│  • Beta testers for Kinlia [Open]        • "Zero to Launch" Course          │
│  • Technical co-founder for                - $99 [Enroll]                   │
│    new project [Open]                    • 1:1 Founder Coaching             │
│  • Feedback on landing page [Open]         - $250/hr [Book]                 │
│  • Intro to AI investors [Open]          • Free office hours                │
│                                            - Fridays [Request]              │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  🛠️ THINGS I'M WORKING ON OR THINKING ABOUT                                 │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌────────────────────────────────────┐  ┌────────────────────────────────┐ │
│  │ [IMAGE]                            │  │ [IMAGE]                        │ │
│  │ Kinlia                             │  │ FounderBot                     │ │
│  │ "AI-powered customer onboarding"   │  │ "Your AI co-founder that       │ │
│  │                                    │  │  never sleeps"                 │ │
│  │ Tags: [SaaS] [Onboarding] [AI]     │  │                                │ │
│  │ Tools: [Claude] [Vercel]           │  │ Tags: [Agents] [Productivity]  │ │
│  │ Status: Live                       │  │ Tools: [Claude] [MCP]          │ │
│  │                                    │  │ Status: Coming Soon            │ │
│  │ ASK: Beta testers needed [Open]    │  │                                │ │
│  │ OFFER: Onboarding strategy         │  │ ASK: Technical co-founder      │ │
│  │        consult - $150/hr [Book]    │  │      [Open]                    │ │
│  └────────────────────────────────────┘  └────────────────────────────────┘ │
│                                                                             │
│  ┌────────────────────────────────────┐  ┌────────────────────────────────┐ │
│  │ [IMAGE]                            │  │ [IMAGE]                        │ │
│  │ "How I Got My First 1000 Users"    │  │ AI Voice App for Podcasters    │ │
│  │ "The unconventional playbook       │  │ "Clone your voice for show     │ │
│  │  that worked for Kinlia"           │  │  notes and promos"             │ │
│  │                                    │  │                                │ │
│  │ Tags: [Growth] [Startups]          │  │ Tags: [Voice] [Podcasting]     │ │
│  │ Type: Blog Post                    │  │ Tools: [ElevenLabs] [Claude]   │ │
│  │                                    │  │ Status: Idea                   │ │
│  │ [Read on Substack]                 │  │                                │ │
│  │                                    │  │ ASK: Would anyone use this?    │ │
│  │ OFFER: Growth strategy session     │  │      Looking for feedback      │ │
│  │        - $200/hr [Book]            │  │      [Open]                    │ │
│  └────────────────────────────────────┘  └────────────────────────────────┘ │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ❤️ THINGS I LOVE                                                           │
│  ─────────────────────────────────────────────────────────────────────────  │
│  • "The best Claude prompting guide I've found" [Link]                      │
│  • "How Linear builds product - incredible process doc" [Link]              │
│  • "My favorite MCP tutorial for beginners" [Link]                          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  📝 RECENT ACTIVITY                                                         │
│  ─────────────────────────────────────────────────────────────────────────  │
│  • Helped @marcus with pricing strategy - 2 days ago                        │
│  • Shipped Kinlia v2.0 with AI suggestions - 1 week ago                     │
│  • Posted "How I Got My First 1000 Users" - 2 weeks ago                     │
│  • Helped @jenny with landing page feedback - 3 weeks ago                   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  🏆 ACHIEVEMENTS                                                            │
│  [🌱 Helper x50] [🚀 Builder] [🎓 Mentor] [⭐ Top Contributor]               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Header Section

### Stats to Display

| Stat | Icon | Description |
|------|------|-------------|
| Points | 🌱 | Total contribution points |
| Asks | 🚀 | Number of open asks |
| Offers | 💫 | Number of active offers |
| Followers | 👀 | Follower count |

### Header Elements

- **Username** — `@username`
- **Tagline** — User's bio/description (one line)
- **Stats row** — Points, asks count, offers count, followers
- **Social links** — Twitter, LinkedIn, GitHub, etc.
- **Actions** — Follow button, Share button

---

## Asks + Offers Section (Side-by-Side)

Two columns displayed together at the top — the core marketplace interaction.

### Asks Column (🚀 MY ASKS)

What this person needs help with. Categories are flexible and user-defined, but common types include:

| Category | Subcategories |
|----------|---------------|
| **Testers** | beta_testers, alpha_testers, ux_testers |
| **Feedback** | landing_page, pitch_deck, product, pricing, copy |
| **Collaborators** | cofounder, technical, creative, marketing |
| **Growth** | users, subscribers, followers, attendees |
| **Learning** | skill, tool, concept |
| **Hiring** | fulltime, contract, freelance |
| **Advice** | strategy, technical, business, career |
| **Introductions** | investors, customers, partners, mentors |

Each ask shows:
- **Title** — What they need
- **Category badge** — Visual indicator
- **Status** — Open, In Progress, Fulfilled
- **[CTA]** button — Opens right-side tray

### Offers Column (💫 MY OFFERS)

What this person can provide to others. Categories include:

| Category | Subcategories |
|----------|---------------|
| **Testing** | will_test, qa_review |
| **Feedback** | landing_page, pitch_deck, product, code_review |
| **Collaboration** | cofounder, partner, contributor |
| **Teaching** | course, mentorship, workshop, office_hours |
| **Services** | consulting, coaching, implementation, strategy |
| **Products** | template, tool, download, resource |
| **Introductions** | network, referrals |

Each offer shows:
- **Title** — What they're offering
- **Price** — Free, $ amount, or "from $X"
- **[CTA]** button — Opens right-side tray

---

## Things I'm Working On or Thinking About

Rich project cards displayed 2 per row on desktop, 1 per row on mobile.

### Project Card Contents

| Element | Description |
|---------|-------------|
| **Image** | Screenshot or logo |
| **Title** | Name of the project |
| **Description** | Brief tagline |
| **Tags** | Categories (Productivity, Marketing, etc.) |
| **Tools** | AI tools used (Claude, Midjourney, etc.) — links to Tools Directory |
| **Status** | Live, Coming Soon, WIP, Idea |
| **ASK** | What they need for this project (linked) |
| **OFFER** | What they can provide related to this project (linked) |

### Item Types

- **Apps** — Finished products
- **Agents** — AI agents, MCPs
- **Blog posts** — Content they've written
- **Ideas** — Things they're considering building
- **WIPs** — Work in progress
- **Games** — Interactive projects

### Project-Linked Asks & Offers

**Data model:** Asks and Offers have an optional `project` foreign key.

When viewing a project card:
- Shows attached asks (e.g., "ASK: Looking for beta testers [Open]")
- Shows attached offers (e.g., "OFFER: Setup consulting - $50/hr [Book]")
- Clicking opens the right-side tray

When creating an ask or offer:
- User can optionally link it to one of their projects
- "What project is this for?" dropdown

---

## Things I Love

Curated external resources and recommendations.

Each item shows:
- **Title** — What they're recommending
- **Source** — Domain or creator
- **[Link]** button — External link

---

## Recent Activity

Shows engagement and that the person is active.

| Activity Type | Display Format |
|---------------|----------------|
| Helped someone | "Helped @username with [ask title]" |
| Shipped update | "Shipped [project] v2.0" |
| Posted content | "Posted '[title]'" |
| New offer | "Added '[offer title]'" |
| Ask fulfilled | "[Ask title] was fulfilled" |

Display rules:
- Show last 5-10 activities
- Include relative timestamps ("2 days ago")
- Link to relevant content

---

## Achievements

Gamification badges earned through platform activity.

Display as horizontal badge row with tooltips showing badge name and how it was earned.

---

## CTA Interaction: Right-Side Tray

When a user clicks any CTA button on someone's profile, it opens a **right-side tray** (similar to Ava's chat drawer).

### Tray Flow Templates

**Flow A: Message Only (free asks/offers)**
```
┌──────────────────────────────────┐
│  ▶ RESPOND TO ASK                │
│  ─────────────────────────────── │
│  "Beta testers for Kinlia"       │
│  from @gina                      │
│                                  │
│  Send a message:                 │
│  ┌─────────────────────────────┐ │
│  │ I'd like to help test...    │ │
│  └─────────────────────────────┘ │
│                                  │
│  [Send Request]                  │
│  @gina will be notified via SMS  │
└──────────────────────────────────┘
```

**Flow B: Message + Payment (paid services)**
```
┌──────────────────────────────────┐
│  ▶ BOOK SESSION                  │
│  ─────────────────────────────── │
│  1:1 Founder Coaching            │
│  with @gina                      │
│  $250/hr                         │
│                                  │
│  Send a message:                 │
│  ┌─────────────────────────────┐ │
│  │ I'd like to book a session  │ │
│  │ to discuss...               │ │
│  └─────────────────────────────┘ │
│                                  │
│  💳 Payment                      │
│  [Pay $250]                      │
│                                  │
│  @gina will be notified via SMS  │
└──────────────────────────────────┘
```

**Flow C: External Link (subscribers, attendees, etc.)**
```
┌──────────────────────────────────┐
│  ▶ SUBSCRIBE                     │
│  ─────────────────────────────── │
│  @gina's Substack                │
│                                  │
│  You'll be taken to:             │
│  substack.com/...                │
│                                  │
│  [Open Link ↗]                   │
│                                  │
│  Optional: Send @gina            │
│  a message too?                  │
│  [Add Message]                   │
└──────────────────────────────────┘
```

**Flow D: Instant Delivery (digital products)**
```
┌──────────────────────────────────┐
│  ▶ BUY TEMPLATE                  │
│  ─────────────────────────────── │
│  "AI Strategy Template"          │
│  by @gina                        │
│  $19                             │
│                                  │
│  Preview:                        │
│  [Template preview image]        │
│                                  │
│  💳 Payment                      │
│  [Pay $19 & Download]            │
│                                  │
│  Delivered instantly             │
└──────────────────────────────────┘
```

### CTA to Tray Flow Mapping

| CTA | Tray Flow | Pre-filled Message |
|-----|-----------|-------------------|
| **Asks** | | |
| [I'll Test] | A (message) | "I'd like to help test [project]..." |
| [Give Feedback] | A (message) | "I can give you feedback on..." |
| [Let's Talk] | A (message) | "I'm interested in collaborating..." |
| [Try It] | C (external) | — |
| [Subscribe] | C (external) | — |
| [RSVP] | C (external) | — |
| [I Can Help] | A (message) | "I can help with..." |
| [Apply] | A (message) | "I'm interested in this role..." |
| [I Can Teach] | A (message) | "I can teach you..." |
| **Offers** | | |
| [Book] (paid) | B (message + pay) | "I'd like to book..." |
| [Request] (free) | A (message) | "I'd like to request..." |
| [Enroll] (course) | D (instant) | — |
| [Buy] (template) | D (instant) | — |
| [Download] (free) | D (instant) | — |

---

## Category Matching System

Categories enable matching asks to offers. The system uses main categories with subcategories for specificity.

### Matching Pairs

| Ask Category | Matches Offer Category |
|--------------|------------------------|
| Testers | Testing |
| Feedback | Feedback |
| Collaborators | Collaboration |
| Learning | Teaching |
| Hiring | Services |
| Advice | Services, Teaching |
| Introductions | Introductions |
| Growth | (browse/external) |

### Discovery Integration

On the Discover page, we can show matches:

```
┌─────────────────────────────────────────────────────────────┐
│  🔥 MATCHES FOR YOU                                         │
│  Based on your asks and offers                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Your Ask: "Need beta testers for Kinlia"                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ @marcus offered to help                              │   │
│  │ "I love testing new SaaS tools"                      │   │
│  │ Helped 12 people • [Accept] [Message]                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Your Offer: "1:1 Founder Coaching"                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ @jenny is asking for coaching                        │   │
│  │ "Need help with go-to-market strategy"               │   │
│  │ Tags: [GTM] [Strategy] • [Reach Out]                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Category Flexibility

Categories are **not hardcoded** — users can add custom categories. The matching system uses:
1. **Category match** — Main category pairing
2. **Tag overlap** — Shared tags (AI, Marketing, etc.)
3. **Tool overlap** — Both use Claude, etc.
4. **Recency** — Newer = more relevant
5. **Reputation** — Helped count, ratings

---

## Mobile Layout

```
┌─────────────────────────────┐
│  @gina           [Follow]   │
│  "Helping founders grow..." │
│  🌱 2,480 • 🚀 4 • 💫 3 • 👀 892 │
├─────────────────────────────┤
│  🚀 MY ASKS                 │
│  • Beta testers [Open]      │
│  • Co-founder [Open]        │
├─────────────────────────────┤
│  💫 MY OFFERS               │
│  • Course - $99 [Enroll]    │
│  • Coaching [Book]          │
├─────────────────────────────┤
│  🛠️ THINGS I'M WORKING ON   │
│  (cards stack vertically)   │
├─────────────────────────────┤
│  ❤️ THINGS I LOVE           │
│  (collapsible)              │
├─────────────────────────────┤
│  📝 RECENT ACTIVITY         │
│  (3-5 items max)            │
├─────────────────────────────┤
│  🏆 ACHIEVEMENTS            │
└─────────────────────────────┘
```

---

## Data Model

### Project Model (Things I'm Working On)

```python
class Project(models.Model):
    PROJECT_TYPES = [
        ('app', 'App'),
        ('agent', 'Agent'),
        ('mcp', 'MCP Server'),
        ('post', 'Blog Post'),
        ('game', 'Game'),
        ('idea', 'Idea'),
        ('wip', 'Work in Progress'),
    ]

    STATUS_CHOICES = [
        ('live', 'Live'),
        ('coming_soon', 'Coming Soon'),
        ('wip', 'Work in Progress'),
        ('idea', 'Idea'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='projects')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    project_type = models.CharField(max_length=20, choices=PROJECT_TYPES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='wip')
    featured_image_url = models.URLField(blank=True)
    url = models.URLField(blank=True)  # Link to try it / read it
    tags = models.ManyToManyField('taxonomy.Taxonomy', blank=True)
    tools = models.ManyToManyField('tools.Tool', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

### Ask Model (with project link)

```python
class Ask(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='asks')
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name='asks')  # Optional link to project
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.ForeignKey('taxonomy.Taxonomy', on_delete=models.SET_NULL, null=True)
    tags = models.ManyToManyField('taxonomy.Taxonomy', blank=True, related_name='tagged_asks')
    status = models.CharField(max_length=20, default='open')
    created_at = models.DateTimeField(auto_now_add=True)
```

### Offer Model (with project link)

```python
class Offer(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='offers')
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name='offers')  # Optional link to project
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.ForeignKey('taxonomy.Taxonomy', on_delete=models.SET_NULL, null=True)
    tags = models.ManyToManyField('taxonomy.Taxonomy', blank=True, related_name='tagged_offers')
    price_cents = models.PositiveIntegerField(null=True, blank=True)
    pricing_type = models.CharField(max_length=20)  # free, one_time, hourly, monthly
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

### Link Model (Things I Love)

```python
class Link(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='links')
    title = models.CharField(max_length=200)
    url = models.URLField()
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

---

## Profile API Response

```typescript
interface ProfileData {
  user: {
    id: number;
    username: string;
    tagline: string;
    avatarUrl: string;
    totalPoints: number;
    asksCount: number;
    offersCount: number;
    followersCount: number;
    socialLinks: {
      twitter?: string;
      linkedin?: string;
      github?: string;
      website?: string;
    };
  };
  asks: Ask[];
  offers: Offer[];
  projects: Project[];  // Things I'm Working On
  links: Link[];        // Things I Love
  recentActivity: Activity[];
  achievements: Achievement[];
  isFollowing: boolean;
}
```

---

## Implementation Files

```
frontend/src/components/profile/
  ProfileHeader.tsx              # Name, tagline, stats, social links
  AsksOffersSection.tsx          # Side-by-side columns container
  AskColumn.tsx                  # List of asks
  OfferColumn.tsx                # List of offers
  AskCard.tsx                    # Individual ask item
  OfferCard.tsx                  # Individual offer item
  ProjectsSection.tsx            # Things I'm Working On
  ProjectCard.tsx                # Rich card with image, tags, tools, ASK/OFFER
  LinksSection.tsx               # Things I Love
  LinkCard.tsx                   # Individual link item
  RecentActivitySection.tsx      # Activity feed
  ActivityItem.tsx               # Activity feed item
  AchievementsSection.tsx        # Badge display

frontend/src/components/tray/
  ActionTray.tsx                 # Right-side tray container
  MessageOnlyTray.tsx            # Flow A
  MessagePaymentTray.tsx         # Flow B
  ExternalLinkTray.tsx           # Flow C
  InstantDeliveryTray.tsx        # Flow D

frontend/src/pages/
  ProfilePage.tsx                # Main profile page

frontend/src/types/
  profile.ts                     # TypeScript interfaces
```

---

## Key Design Decisions

1. **Asks and Offers are equal** — Neither is subordinate. Side-by-side layout emphasizes this.

2. **Stats show asks and offers counts** — Reinforces the marketplace identity.

3. **Creative content is separate** — Apps, WIPs, blog posts, ideas don't need to be "offers." They live in "Things I'm Working On or Thinking About."

4. **Projects link to asks/offers** — Each project card shows its attached asks ("Need testers") and offers ("Consulting available").

5. **Right-side tray for all actions** — Consistent interaction pattern. CTAs open a tray with message composer and optional payment.

6. **Categories are flexible** — Users can add custom categories. Matching uses categories + tags + tools.

7. **SMS notifications** — All connections trigger SMS to recipient for immediate attention.
