# Team Meeting Questions - Collective Rebuild

> **Date:** January 13, 2025
>
> Questions to discuss for The AI Network Collective pivot.

---

## Positioning & Messaging

1. **New tagline:** "Offer your skills, ask for what you need, connect with people and AI agents who can help." Does this land?

2. **"Marketplace" vs "Collective"** — We decided not to lead with "marketplace" but the functionality is transactional. Do we call it a marketplace anywhere, or avoid the word entirely?

3. **People vs Humans** — DNA says "people and AI agents." Are we comfortable with AI agents being first-class citizens in all marketing?

4. **Money messaging** — How do we communicate that creators can get paid without sounding transactional? Current approach: emphasize generosity culture, let paid offerings speak for themselves.

---

## Sprint Prioritization

5. **Current sprint focus:** Are we still on Sprint 1 (hide legacy nav, placeholder home) or have we moved past that?

6. **Landing page vs core platform:** How much time on the landing page vs building the actual Offer/Ask/Connection models?

7. **Onboarding flow:** Chat-based onboarding with Ava vs simple form wizard — is the chat flow still the plan? It's elegant but complex.

8. **SMS notifications:** This is listed for Sprint 7. Should we move it earlier since it's a core differentiator?

---

## Data Model Decisions

9. **Project vs Offer:** The profile redesign doc shows Projects AND Offers as separate concepts (apps are "things you're working on," consulting is an "offer"). The data model has them merged. Which approach?

10. **Ask/Offer linked to Project:** Should asks and offers optionally link to a project? E.g., "Beta testers needed" linked to "Kinlia" app card.

11. **Integer vs UUID primary keys:** Data model doc says integer (consistent with User model). Confirm?

12. **Categories:** Use existing Taxonomy system with new `offer_category` type, or create separate category model?

---

## AI Agents

13. **Sage ownership:** Sage becomes @allierays's AI agent. When do we implement AgentProfile model and make this visible?

14. **Agent hosting model (Sprint 9):** Still deferred? Options:
    - All Thrive hosted (we pay API costs)
    - Self-hosted (creator BYOK)
    - Hybrid

15. **Agent accountability:** Every agent action traces to human owner. Is this clearly communicated in UI?

---

## Profile Redesign

16. **Asks + Offers side-by-side:** The profile redesign doc shows them in two columns at top of profile. Still the plan?

17. **"Things I'm Working On" section:** Is this necessary, or do we simplify to just Asks/Offers on profiles?

18. **"Things I Love" section:** Curated links feature — priority or cut it?

19. **Right-side tray for all CTAs:** Consistent interaction pattern. Does this conflict with Ava's chat drawer?

---

## Discovery & Matching

20. **Problem-based discovery:** User selects "Marketing & Content" then sees tools, experts, courses, asks. Is this still the vision for `/discover`?

21. **Matching algorithm:** How sophisticated? Just category matching, or also tags, tools, reputation scoring?

22. **Search:** Natural language search with Ava? Or traditional filters only?

---

## Points & Gamification

23. **Generosity-based points:** Sprint 8 redesigns points to reward helping. Is the point allocation correct?
    - Respond to ask: +15
    - Complete help: +25
    - Receive "helpful" rating: +20

24. **"Helped X people" metric:** Show this instead of raw points on profiles?

25. **Leaderboards:** "Top Helpers This Week" — priority or deferred?

---

## Technical Decisions

26. **New Django app:** `core/collective/` for Offer, Ask, Connection, Follow models. Confirm location?

27. **API routes:** `/api/v1/offers/`, `/api/v1/asks/`, `/api/v1/connections/` — no "collective" in URLs. Correct?

28. **Stripe integration:** Offers link to existing CreatorAccount for Stripe Connect. Any changes needed?

29. **SMS provider:** Twilio? Other options?

---

## Migration & Existing Users

30. **16 beta users:** Re-onboard them manually or create migration script?

31. **Existing Projects → Offers:** Auto-migrate or let users recreate?

32. **Hide vs Delete strategy:** We're hiding Learn/Play pages, keeping routes working. When do we fully delete?

---

## Open Questions from Docs

33. **Lounge/Community Chat:** Currently marked KEEP. Does it fit the Ask/Offer model, or should it evolve?

34. **Creator Subscriptions:** Substack-style paid subscriptions to creators — Phase 2 or defer further?

35. **Content Gating:** Can some offers be subscriber-only?

---

## For This Week

36. What's the single most important thing to ship this week?

37. What's blocking progress right now?

38. Who owns what?
